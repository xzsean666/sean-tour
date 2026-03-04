import { Injectable } from '@nestjs/common';
import { BookingService } from '../booking/booking.service';
import { Booking, BookingServiceSnapshot } from '../booking/dto/booking.dto';
import { BookingListInput } from '../booking/dto/booking-list.input';
import { BookingStatus } from '../booking/dto/booking-status.enum';
import { PaymentIntent } from '../payment/dto/payment-intent.dto';
import { PaymentStatus } from '../payment/dto/payment-status.enum';
import { PaymentService } from '../payment/payment.service';
import { OrderListInput } from './dto/order-list.input';
import { OrderPage } from './dto/order-page.dto';
import { OrderPaymentStatus } from './dto/order-payment-status.enum';
import { Order } from './dto/order.dto';

@Injectable()
export class OrderService {
  constructor(
    private readonly bookingService: BookingService,
    private readonly paymentService: PaymentService,
  ) {}

  async myOrders(userId: string, input?: OrderListInput): Promise<OrderPage> {
    const bookingInput: BookingListInput = {
      status: input?.bookingStatus,
      page: input?.page,
    };

    const bookingPage = await this.bookingService.listMyBookings(
      userId,
      bookingInput,
    );

    const items = await Promise.all(
      bookingPage.items.map(async (booking) => {
        return this.toOrder(userId, booking);
      }),
    );

    return {
      items,
      total: bookingPage.total,
      limit: bookingPage.limit,
      offset: bookingPage.offset,
      hasMore: bookingPage.hasMore,
    };
  }

  async orderDetail(userId: string, orderId: string): Promise<Order> {
    const booking = await this.bookingService.getBookingByIdForUser(
      userId,
      orderId,
    );
    return this.toOrder(userId, booking);
  }

  private async toOrder(userId: string, booking: Booking): Promise<Order> {
    const payment = await this.paymentService.getPaymentByBooking(
      userId,
      booking.id,
    );

    return {
      id: booking.id,
      bookingId: booking.id,
      serviceTitle: booking.serviceSnapshot.title,
      city: this.getSnapshotCity(booking.serviceSnapshot),
      bookingStatus: booking.status,
      paymentStatus: this.resolvePaymentStatus(booking.status, payment),
      expectedAmount: this.resolveExpectedAmount(booking, payment),
      createdAt: booking.createdAt,
    };
  }

  private getSnapshotCity(snapshot: BookingServiceSnapshot): string {
    if (typeof snapshot.city === 'string' && snapshot.city.trim()) {
      return snapshot.city;
    }

    return 'N/A';
  }

  private resolveExpectedAmount(
    booking: Booking,
    payment: PaymentIntent | null,
  ): string {
    if (payment?.expectedAmount) {
      return payment.expectedAmount;
    }

    return (
      booking.serviceSnapshot.basePrice.amount * booking.travelerCount
    ).toFixed(2);
  }

  private resolvePaymentStatus(
    bookingStatus: BookingStatus,
    payment: PaymentIntent | null,
  ): OrderPaymentStatus {
    if (payment) {
      if (payment.status === PaymentStatus.PAID) {
        return OrderPaymentStatus.PAID;
      }

      if (payment.status === PaymentStatus.EXPIRED) {
        return OrderPaymentStatus.EXPIRED;
      }

      return OrderPaymentStatus.PENDING;
    }

    if (
      bookingStatus === BookingStatus.PAID ||
      bookingStatus === BookingStatus.CONFIRMED ||
      bookingStatus === BookingStatus.IN_SERVICE ||
      bookingStatus === BookingStatus.COMPLETED ||
      bookingStatus === BookingStatus.REFUNDING ||
      bookingStatus === BookingStatus.REFUNDED
    ) {
      return OrderPaymentStatus.PAID;
    }

    if (bookingStatus === BookingStatus.CANCELED) {
      return OrderPaymentStatus.EXPIRED;
    }

    return OrderPaymentStatus.PENDING;
  }
}
