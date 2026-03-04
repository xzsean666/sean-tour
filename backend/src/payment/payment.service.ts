import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BookingService } from '../booking/booking.service';
import { BookingStatus } from '../booking/dto/booking-status.enum';
import { DBService, PGKVDatabase } from '../common/db.service';
import { CreateUsdtPaymentInput } from './dto/create-usdt-payment.input';
import { PaymentIntent } from './dto/payment-intent.dto';
import { PaymentStatus } from './dto/payment-status.enum';
import { UpdatePaymentStatusInput } from './dto/update-payment-status.input';

type PaymentRecord = PaymentIntent & {
  entityType: 'PAYMENT';
};

type SearchJsonRow = {
  key: string;
  value: unknown;
  created_at?: Date;
  updated_at?: Date;
};

@Injectable()
export class PaymentService {
  private readonly travelDB: PGKVDatabase;

  constructor(
    private readonly bookingService: BookingService,
    private readonly dbService: DBService,
  ) {
    this.travelDB = this.dbService.getDBInstance('travel_kv');
  }

  async createUsdtPayment(
    userId: string,
    input: CreateUsdtPaymentInput,
  ): Promise<PaymentIntent> {
    const booking = await this.bookingService.getBookingByIdForUser(
      userId,
      input.bookingId,
    );

    if (booking.status !== BookingStatus.PENDING_PAYMENT) {
      throw new BadRequestException(
        'Only PENDING_PAYMENT booking can create payment intent',
      );
    }

    const existing = await this.findReusablePendingPayment(booking.id, userId);
    if (existing) {
      return this.toPaymentIntent(existing);
    }

    const expectedAmount = (
      booking.serviceSnapshot.basePrice.amount * booking.travelerCount
    ).toFixed(2);
    const createdAt = new Date();
    const expiredAt = new Date(createdAt.getTime() + 30 * 60 * 1000);

    const payment: PaymentRecord = {
      entityType: 'PAYMENT',
      id: this.generatePaymentId(),
      bookingId: booking.id,
      userId,
      token: 'USDT',
      network: 'BSC',
      tokenStandard: 'ERC20',
      expectedAmount,
      paidAmount: '0.00',
      payAddress: '0x0000000000000000000000000000000000BEEF',
      txHash: undefined,
      confirmations: 0,
      status: PaymentStatus.PENDING,
      expiredAt: expiredAt.toISOString(),
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
    };

    await this.travelDB.put(`payment:${payment.id}`, payment);
    return this.toPaymentIntent(payment);
  }

  async getPaymentByBooking(
    userId: string,
    bookingId: string,
  ): Promise<PaymentIntent | null> {
    await this.bookingService.getBookingByIdForUser(userId, bookingId);

    const payments = await this.getPaymentsByBooking(userId, bookingId);
    if (payments.length === 0) {
      return null;
    }

    return this.toPaymentIntent(payments[0]);
  }

  async updatePaymentStatus(
    input: UpdatePaymentStatusInput,
  ): Promise<PaymentIntent> {
    const payment = await this.resolvePaymentForUpdate(input);
    const paidAmount = this.resolvePaidAmount(payment, input.paidAmount);
    const status = this.resolveStatus(payment, input.status, paidAmount);

    const updated: PaymentRecord = {
      ...payment,
      status,
      paidAmount,
      txHash: this.resolveTxHash(payment, input.txHash),
      confirmations: this.resolveConfirmations(
        payment.confirmations,
        input.confirmations,
      ),
      updatedAt: new Date().toISOString(),
    };

    await this.travelDB.put(`payment:${updated.id}`, updated);
    await this.syncBookingStatus(updated);
    return this.toPaymentIntent(updated);
  }

  private async findReusablePendingPayment(
    bookingId: string,
    userId: string,
  ): Promise<PaymentRecord | null> {
    const payments = await this.getPaymentsByBooking(userId, bookingId);

    for (const payment of payments) {
      if (this.isPendingStatus(payment.status)) {
        return payment;
      }
    }

    return null;
  }

  private async getPaymentsByBooking(
    userId: string,
    bookingId: string,
  ): Promise<PaymentRecord[]> {
    const result = await this.travelDB.searchJson({
      contains: {
        entityType: 'PAYMENT',
        bookingId,
        userId,
      },
      limit: 50,
      order_by: 'DESC',
      order_by_field: 'created_at',
    });

    const now = Date.now();
    const payments: PaymentRecord[] = [];

    for (const row of result.data as SearchJsonRow[]) {
      const payment = this.toPaymentRecord(row.value);
      if (!payment) {
        continue;
      }

      payments.push(await this.normalizeExpiredPayment(payment, now));
    }

    return payments;
  }

  private async resolvePaymentForUpdate(
    input: UpdatePaymentStatusInput,
  ): Promise<PaymentRecord> {
    if (input.paymentId?.trim()) {
      const payment = await this.getPaymentById(input.paymentId.trim());
      if (!payment) {
        throw new BadRequestException(`Payment ${input.paymentId} not found`);
      }

      return this.normalizeExpiredPayment(payment);
    }

    if (input.bookingId?.trim()) {
      const payment = await this.getLatestPaymentByBooking(input.bookingId);
      if (!payment) {
        throw new BadRequestException(
          `No payment found for booking ${input.bookingId}`,
        );
      }

      return this.normalizeExpiredPayment(payment);
    }

    throw new BadRequestException('paymentId or bookingId is required');
  }

  private async getPaymentById(
    paymentId: string,
  ): Promise<PaymentRecord | null> {
    const payment = await this.travelDB.get<PaymentRecord>(
      `payment:${paymentId}`,
    );
    return this.toPaymentRecord(payment);
  }

  private async getLatestPaymentByBooking(
    bookingId: string,
  ): Promise<PaymentRecord | null> {
    const result = await this.travelDB.searchJson({
      contains: {
        entityType: 'PAYMENT',
        bookingId: bookingId.trim(),
      },
      limit: 1,
      order_by: 'DESC',
      order_by_field: 'created_at',
    });

    const rows = result.data as SearchJsonRow[];
    if (rows.length === 0) {
      return null;
    }

    return this.toPaymentRecord(rows[0].value);
  }

  private resolvePaidAmount(
    payment: PaymentRecord,
    nextPaidAmount?: string,
  ): string {
    if (nextPaidAmount === undefined) {
      return payment.paidAmount;
    }

    const parsed = Number(nextPaidAmount);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new BadRequestException('paidAmount must be a non-negative number');
    }

    return parsed.toFixed(2);
  }

  private resolveStatus(
    payment: PaymentRecord,
    nextStatus: PaymentStatus | undefined,
    paidAmount: string,
  ): PaymentStatus {
    if (nextStatus) {
      return nextStatus;
    }

    const expected = Number(payment.expectedAmount);
    const paid = Number(paidAmount);

    if (!Number.isFinite(expected) || expected <= 0 || !Number.isFinite(paid)) {
      return payment.status;
    }

    if (paid >= expected) {
      return PaymentStatus.PAID;
    }

    if (paid > 0) {
      return PaymentStatus.PARTIALLY_PAID;
    }

    return PaymentStatus.PENDING;
  }

  private resolveTxHash(
    payment: PaymentRecord,
    txHash?: string,
  ): string | undefined {
    if (txHash === undefined) {
      return payment.txHash;
    }

    const normalized = txHash.trim();
    return normalized ? normalized : undefined;
  }

  private resolveConfirmations(
    currentConfirmations: number,
    nextConfirmations?: number,
  ): number {
    if (nextConfirmations === undefined) {
      return currentConfirmations;
    }

    if (!Number.isInteger(nextConfirmations) || nextConfirmations < 0) {
      throw new BadRequestException(
        'confirmations must be a non-negative integer',
      );
    }

    return Math.max(currentConfirmations, nextConfirmations);
  }

  private async syncBookingStatus(payment: PaymentRecord): Promise<void> {
    if (payment.status === PaymentStatus.PAID) {
      await this.bookingService.markBookingPaidById(payment.bookingId);
    }
  }

  private async normalizeExpiredPayment(
    payment: PaymentRecord,
    now = Date.now(),
  ): Promise<PaymentRecord> {
    const isExpired =
      this.isPendingStatus(payment.status) &&
      new Date(payment.expiredAt).getTime() <= now;

    if (!isExpired) {
      return payment;
    }

    const normalized: PaymentRecord = {
      ...payment,
      status: PaymentStatus.EXPIRED,
      updatedAt: new Date().toISOString(),
    };

    await this.travelDB.put(`payment:${payment.id}`, normalized);
    return normalized;
  }

  private isPendingStatus(status: PaymentStatus): boolean {
    return (
      status === PaymentStatus.PENDING ||
      status === PaymentStatus.PARTIALLY_PAID
    );
  }

  private toPaymentRecord(value: unknown): PaymentRecord | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const candidate = value as Partial<PaymentRecord>;

    if (candidate.entityType !== 'PAYMENT') {
      return null;
    }

    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.bookingId !== 'string' ||
      typeof candidate.userId !== 'string' ||
      typeof candidate.status !== 'string' ||
      typeof candidate.expiredAt !== 'string' ||
      typeof candidate.createdAt !== 'string' ||
      typeof candidate.updatedAt !== 'string'
    ) {
      return null;
    }

    return candidate as PaymentRecord;
  }

  private toPaymentIntent(record: PaymentRecord): PaymentIntent {
    const { entityType, ...paymentIntent } = record;
    void entityType;
    return paymentIntent;
  }

  private generatePaymentId(): string {
    return `pay_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
  }
}
