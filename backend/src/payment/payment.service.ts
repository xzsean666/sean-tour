import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { BookingService } from '../booking/booking.service';
import { BookingStatus } from '../booking/dto/booking-status.enum';
import { DBService, PGKVDatabase } from '../common/db.service';
import { config } from '../config';
import { CreateUsdtPaymentInput } from './dto/create-usdt-payment.input';
import { PaymentEventListInput } from './dto/payment-event-list.input';
import { PaymentEventPage } from './dto/payment-event-page.dto';
import { PaymentEventSource } from './dto/payment-event-source.enum';
import { PaymentIntent } from './dto/payment-intent.dto';
import { PaymentStatus } from './dto/payment-status.enum';
import { UpdatePaymentStatusInput } from './dto/update-payment-status.input';
import {
  type PaymentAddressAllocation,
  PaymentWalletService,
} from './payment-wallet.service';

type PaymentRecord = PaymentIntent & {
  entityType: 'PAYMENT';
  walletOrderHash?: string;
  walletIndex?: number;
};

export type PaymentEventLog = {
  eventId: string;
  paymentId: string;
  bookingId: string;
  source: PaymentEventSource;
  status: PaymentStatus;
  paidAmount: string;
  txHash?: string;
  confirmations: number;
  actor: string;
  replayOfEventId?: string;
  createdAt: string;
};

type PaymentEventRecord = {
  entityType: 'PAYMENT_EVENT';
  id: string;
  eventId: string;
  paymentId: string;
  bookingId: string;
  source: PaymentEventSource;
  status: PaymentStatus;
  paidAmount: string;
  txHash?: string;
  confirmations: number;
  actor: string;
  replayOfEventId?: string;
  signature?: string;
  payload: UpdatePaymentStatusInput;
  createdAt: string;
};

type UpdatePaymentStatusOptions = {
  requireSignature?: boolean;
  source?: PaymentEventSource;
  actor?: string;
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
    @Optional()
    private readonly paymentWalletService?: PaymentWalletService,
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
    const paymentId = this.generatePaymentId();
    const addressAllocation = await this.allocatePaymentAddress({
      paymentId,
      expectedAmount,
      createdAt,
    });

    const payment: PaymentRecord = {
      entityType: 'PAYMENT',
      id: paymentId,
      bookingId: booking.id,
      userId,
      token: 'USDT',
      network: 'BSC',
      tokenStandard: 'ERC20',
      expectedAmount,
      paidAmount: '0.00',
      payAddress: addressAllocation.payAddress,
      txHash: undefined,
      confirmations: 0,
      status: PaymentStatus.PENDING,
      expiredAt: addressAllocation.expiredAt,
      walletOrderHash: addressAllocation.walletOrderHash,
      walletIndex: addressAllocation.walletIndex,
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

  async listPaymentEventsByBooking(
    bookingId: string,
    options?: {
      limit?: number;
      offset?: number;
    },
  ): Promise<PaymentEventLog[]> {
    const normalizedBookingId = bookingId.trim();
    if (!normalizedBookingId) {
      throw new BadRequestException('bookingId is required');
    }

    const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
    const offset = Math.max(options?.offset ?? 0, 0);

    const result = await this.travelDB.searchJson({
      contains: {
        entityType: 'PAYMENT_EVENT',
        bookingId: normalizedBookingId,
      },
      limit,
      offset,
      order_by: 'DESC',
      order_by_field: 'created_at',
    });

    return (result.data as SearchJsonRow[])
      .map((row) => this.toPaymentEventRecord(row.value))
      .filter((row): row is PaymentEventRecord => row !== null)
      .map((row) => this.toPaymentEventLog(row));
  }

  async adminListPaymentEvents(
    input?: PaymentEventListInput,
  ): Promise<PaymentEventPage> {
    const limit = Math.min(Math.max(input?.page?.limit ?? 20, 1), 100);
    const offset = Math.max(input?.page?.offset ?? 0, 0);

    const contains: Record<string, unknown> = {
      entityType: 'PAYMENT_EVENT',
    };

    if (input?.eventId?.trim()) {
      contains.eventId = input.eventId.trim();
    }

    if (input?.paymentId?.trim()) {
      contains.paymentId = input.paymentId.trim();
    }

    if (input?.bookingId?.trim()) {
      contains.bookingId = input.bookingId.trim();
    }

    if (input?.actor?.trim()) {
      contains.actor = input.actor.trim();
    }

    if (input?.replayOfEventId?.trim()) {
      contains.replayOfEventId = input.replayOfEventId.trim();
    }

    if (input?.status) {
      contains.status = input.status;
    }

    if (input?.source) {
      contains.source = input.source;
    }

    const result = await this.travelDB.searchJson({
      contains,
      limit,
      offset,
      include_total: true,
      order_by: 'DESC',
      order_by_field: 'created_at',
    });

    const items = (result.data as SearchJsonRow[])
      .map((row) => this.toPaymentEventRecord(row.value))
      .filter((row): row is PaymentEventRecord => row !== null)
      .map((row) => this.toPaymentEventLog(row));

    const total = result.total ?? items.length;

    return {
      items,
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    };
  }

  async updatePaymentStatus(
    input: UpdatePaymentStatusInput,
    options: UpdatePaymentStatusOptions = {},
  ): Promise<PaymentIntent> {
    const source = options.source ?? PaymentEventSource.ADMIN;
    const actor = this.resolveActor(source, options.actor);

    this.assertCallbackSignature(input, options.requireSignature ?? false);

    const idempotentPayment = await this.findPaymentByEventId(input.eventId);
    if (idempotentPayment) {
      return this.toPaymentIntent(idempotentPayment);
    }

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

    if (await this.shouldSkipReplayUpdate(payment, updated, source)) {
      return this.toPaymentIntent(payment);
    }

    await this.travelDB.put(`payment:${updated.id}`, updated);
    await this.syncBookingStatus(updated);
    await this.logPaymentEvent(updated, input, source, actor);
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

  private async findPaymentByEventId(
    eventId?: string,
  ): Promise<PaymentRecord | null> {
    const normalizedEventId = eventId?.trim();
    if (!normalizedEventId) {
      return null;
    }

    const event = await this.travelDB.get<PaymentEventRecord>(
      `payment_event:${normalizedEventId}`,
    );
    const eventRecord = this.toPaymentEventRecord(event);
    if (!eventRecord) {
      return null;
    }

    const payment = await this.getPaymentById(eventRecord.paymentId);
    if (!payment) {
      return null;
    }

    return this.normalizeExpiredPayment(payment);
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

  private async allocatePaymentAddress(params: {
    paymentId: string;
    expectedAmount: string;
    createdAt: Date;
  }): Promise<PaymentAddressAllocation> {
    if (!this.paymentWalletService) {
      return this.buildFallbackAddressAllocation(params.createdAt);
    }

    try {
      return await this.paymentWalletService.allocateAddressForPayment({
        paymentId: params.paymentId,
        expectedAmount: params.expectedAmount,
      });
    } catch (error) {
      throw new BadRequestException(
        `Failed to allocate payment wallet address: ${this.getErrorMessage(error)}`,
      );
    }
  }

  private buildFallbackAddressAllocation(
    createdAt: Date,
  ): PaymentAddressAllocation {
    const expiryMs = config.payment.ORDER_EXPIRY_HOURS * 60 * 60 * 1000;
    return {
      payAddress: '0x0000000000000000000000000000000000BEEF',
      expiredAt: new Date(createdAt.getTime() + expiryMs).toISOString(),
    };
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

  private async shouldSkipReplayUpdate(
    currentPayment: PaymentRecord,
    nextPayment: PaymentRecord,
    source: PaymentEventSource,
  ): Promise<boolean> {
    if (!this.isReplayGuardSource(source)) {
      return false;
    }

    if (!this.isSamePaymentState(currentPayment, nextPayment)) {
      return false;
    }

    const cooldownSeconds = config.payment.REPLAY_COOLDOWN_SECONDS;
    if (cooldownSeconds <= 0) {
      return false;
    }

    const result = await this.travelDB.searchJson({
      contains: {
        entityType: 'PAYMENT_EVENT',
        paymentId: nextPayment.id,
        source,
      },
      limit: 20,
      order_by: 'DESC',
      order_by_field: 'created_at',
    });

    const cooldownMs = cooldownSeconds * 1000;
    const now = Date.now();

    for (const row of result.data as SearchJsonRow[]) {
      const record = this.toPaymentEventRecord(row.value);
      if (!record) {
        continue;
      }

      const createdAt = new Date(record.createdAt).getTime();
      if (!Number.isFinite(createdAt) || now - createdAt > cooldownMs) {
        continue;
      }

      if (this.isSameEventState(record, nextPayment)) {
        return true;
      }
    }

    return false;
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

  private async logPaymentEvent(
    payment: PaymentRecord,
    input: UpdatePaymentStatusInput,
    source: PaymentEventSource,
    actor: string,
  ): Promise<void> {
    const eventId = input.eventId?.trim() || this.generatePaymentEventId();
    const createdAt = new Date().toISOString();
    const eventRecord: PaymentEventRecord = {
      entityType: 'PAYMENT_EVENT',
      id: eventId,
      eventId,
      paymentId: payment.id,
      bookingId: payment.bookingId,
      source,
      status: payment.status,
      paidAmount: payment.paidAmount,
      txHash: payment.txHash,
      confirmations: payment.confirmations,
      actor,
      replayOfEventId: input.replayOfEventId?.trim() || undefined,
      signature: input.signature?.trim() || undefined,
      payload: {
        ...input,
        eventId,
      },
      createdAt,
    };

    await this.travelDB.put(`payment_event:${eventId}`, eventRecord);
  }

  private assertCallbackSignature(
    input: UpdatePaymentStatusInput,
    requireSignature: boolean,
  ): void {
    if (!requireSignature) {
      return;
    }

    const callbackSecret = config.payment.CALLBACK_SECRET.trim();
    if (!callbackSecret) {
      throw new BadRequestException(
        'PAYMENT_CALLBACK_SECRET is not configured',
      );
    }

    const signature = input.signature?.trim();
    if (!signature) {
      throw new BadRequestException('signature is required');
    }

    const expectedSignature = this.computeCallbackSignature(
      input,
      callbackSecret,
    );

    if (!this.safeEqual(signature, expectedSignature)) {
      throw new BadRequestException('Invalid callback signature');
    }
  }

  private computeCallbackSignature(
    input: UpdatePaymentStatusInput,
    callbackSecret: string,
  ): string {
    const payload = [
      input.eventId?.trim() || '',
      input.paymentId?.trim() || '',
      input.bookingId?.trim() || '',
      input.status || '',
      input.paidAmount?.trim() || '',
      input.txHash?.trim() || '',
      input.confirmations !== undefined ? String(input.confirmations) : '',
    ].join('|');

    return createHmac('sha256', callbackSecret).update(payload).digest('hex');
  }

  private safeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }

  private isPendingStatus(status: PaymentStatus): boolean {
    return (
      status === PaymentStatus.PENDING ||
      status === PaymentStatus.PARTIALLY_PAID
    );
  }

  private isReplayGuardSource(source: PaymentEventSource): boolean {
    return (
      source === PaymentEventSource.ADMIN || source === PaymentEventSource.SYNC
    );
  }

  private resolveActor(source: PaymentEventSource, actor?: string): string {
    const normalizedActor = actor?.trim();
    if (normalizedActor) {
      return normalizedActor;
    }

    if (source === PaymentEventSource.CALLBACK) {
      return 'callback_webhook';
    }

    if (source === PaymentEventSource.SYNC) {
      return 'sync_job';
    }

    return 'admin_auth_code';
  }

  private isSamePaymentState(a: PaymentRecord, b: PaymentRecord): boolean {
    return (
      a.status === b.status &&
      a.paidAmount === b.paidAmount &&
      this.normalizeTxHash(a.txHash) === this.normalizeTxHash(b.txHash) &&
      a.confirmations === b.confirmations
    );
  }

  private isSameEventState(
    event: PaymentEventRecord,
    nextPayment: PaymentRecord,
  ): boolean {
    return (
      event.status === nextPayment.status &&
      event.paidAmount === nextPayment.paidAmount &&
      this.normalizeTxHash(event.txHash) ===
        this.normalizeTxHash(nextPayment.txHash) &&
      event.confirmations === nextPayment.confirmations
    );
  }

  private normalizeTxHash(value?: string): string | undefined {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
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

  private toPaymentEventRecord(value: unknown): PaymentEventRecord | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const candidate = value as Partial<PaymentEventRecord>;
    if (candidate.entityType !== 'PAYMENT_EVENT') {
      return null;
    }

    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.eventId !== 'string' ||
      typeof candidate.paymentId !== 'string' ||
      typeof candidate.bookingId !== 'string' ||
      typeof candidate.source !== 'string' ||
      typeof candidate.status !== 'string' ||
      typeof candidate.paidAmount !== 'string' ||
      typeof candidate.confirmations !== 'number' ||
      typeof candidate.createdAt !== 'string'
    ) {
      return null;
    }

    const source = candidate.source;
    const actor =
      typeof candidate.actor === 'string'
        ? candidate.actor.trim()
        : this.resolveActor(source);
    const replayOfEventId =
      typeof candidate.replayOfEventId === 'string'
        ? candidate.replayOfEventId.trim() || undefined
        : undefined;

    return {
      ...(candidate as PaymentEventRecord),
      actor: actor || this.resolveActor(source),
      replayOfEventId,
    };
  }

  private toPaymentEventLog(record: PaymentEventRecord): PaymentEventLog {
    return {
      eventId: record.eventId,
      paymentId: record.paymentId,
      bookingId: record.bookingId,
      source: record.source,
      status: record.status,
      paidAmount: record.paidAmount,
      txHash: record.txHash,
      confirmations: record.confirmations,
      actor: record.actor,
      replayOfEventId: record.replayOfEventId,
      createdAt: record.createdAt,
    };
  }

  private toPaymentIntent(record: PaymentRecord): PaymentIntent {
    const { entityType, ...paymentIntent } = record;
    void entityType;
    return paymentIntent;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return 'Unexpected payment wallet error';
  }

  private generatePaymentId(): string {
    return `pay_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
  }

  private generatePaymentEventId(): string {
    return `evt_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
  }
}
