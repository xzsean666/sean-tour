import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BookingService } from '../booking/booking.service';
import { BookingStatus } from '../booking/dto/booking-status.enum';
import { CreateUsdtPaymentInput } from './dto/create-usdt-payment.input';
import { PaymentIntent } from './dto/payment-intent.dto';
import { PaymentStatus } from './dto/payment-status.enum';

const paymentStore = new Map<string, PaymentIntent>();

@Injectable()
export class PaymentService {
  constructor(private readonly bookingService: BookingService) {}

  createUsdtPayment(
    userId: string,
    input: CreateUsdtPaymentInput,
  ): PaymentIntent {
    const booking = this.bookingService.getBookingByIdForUser(
      userId,
      input.bookingId,
    );

    if (booking.status !== BookingStatus.PENDING_PAYMENT) {
      throw new BadRequestException(
        'Only PENDING_PAYMENT booking can create payment intent',
      );
    }

    const existing = this.findPendingPayment(booking.id, userId);
    if (existing) {
      return existing;
    }

    const expectedAmount = (
      booking.serviceSnapshot.basePrice.amount * booking.travelerCount
    ).toFixed(2);
    const createdAt = new Date();
    const expiredAt = new Date(createdAt.getTime() + 30 * 60 * 1000);

    const payment: PaymentIntent = {
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

    paymentStore.set(payment.id, payment);
    return payment;
  }

  private findPendingPayment(
    bookingId: string,
    userId: string,
  ): PaymentIntent | null {
    for (const payment of paymentStore.values()) {
      if (payment.bookingId !== bookingId || payment.userId !== userId) {
        continue;
      }

      if (
        payment.status === PaymentStatus.PENDING ||
        payment.status === PaymentStatus.PARTIALLY_PAID
      ) {
        return payment;
      }
    }

    return null;
  }

  private generatePaymentId(): string {
    return `pay_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
  }
}
