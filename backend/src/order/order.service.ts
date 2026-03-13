import { Injectable } from '@nestjs/common';
import { BookingService } from '../booking/booking.service';
import { Booking, BookingServiceSnapshot } from '../booking/dto/booking.dto';
import { BookingListInput } from '../booking/dto/booking-list.input';
import { BookingStatus } from '../booking/dto/booking-status.enum';
import { PaymentIntent } from '../payment/dto/payment-intent.dto';
import { PaymentStatus } from '../payment/dto/payment-status.enum';
import { PaymentEventLog, PaymentService } from '../payment/payment.service';
import { OrderContact } from './dto/order-contact.dto';
import { OrderListInput } from './dto/order-list.input';
import { OrderPage } from './dto/order-page.dto';
import { OrderPaymentEvent } from './dto/order-payment-event.dto';
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
        return this.toOrder(userId, booking, false);
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
    return this.toOrder(userId, booking, true);
  }

  async adminOrders(input?: OrderListInput): Promise<OrderPage> {
    const limit = Math.min(Math.max(input?.page?.limit ?? 20, 1), 100);
    const offset = Math.max(input?.page?.offset ?? 0, 0);

    const bookings = await this.bookingService.listAllBookingsForAdmin({
      userId: input?.userId,
      status: input?.bookingStatus,
    });

    const orders = await Promise.all(
      bookings.map((booking) => this.toOrder(booking.userId, booking, false)),
    );

    const filtered = input?.paymentStatus
      ? orders.filter((order) => order.paymentStatus === input.paymentStatus)
      : orders;
    const bookingId = input?.bookingId?.trim();
    const serviceId = input?.serviceId?.trim();
    const filteredByIdentity = filtered.filter((order) => {
      if (bookingId && order.bookingId !== bookingId) {
        return false;
      }

      if (serviceId && order.serviceId !== serviceId) {
        return false;
      }

      return true;
    });

    const items = filteredByIdentity.slice(offset, offset + limit);

    return {
      items,
      total: filteredByIdentity.length,
      limit,
      offset,
      hasMore: offset + items.length < filteredByIdentity.length,
    };
  }

  async adminOrderDetail(orderId: string): Promise<Order> {
    const booking = await this.bookingService.getBookingByIdForAdmin(orderId);
    return this.toOrder(booking.userId, booking, true);
  }

  private async toOrder(
    userId: string,
    booking: Booking,
    includePaymentEvents: boolean,
  ): Promise<Order> {
    const payment = await this.paymentService.getPaymentByBooking(
      userId,
      booking.id,
    );
    const paymentEvents = includePaymentEvents
      ? await this.paymentService.listPaymentEventsByBooking(booking.id, {
          limit: 30,
          offset: 0,
        })
      : [];

    return {
      id: booking.id,
      bookingId: booking.id,
      serviceId: booking.serviceId,
      userId: booking.userId,
      serviceTitle: booking.serviceSnapshot.title,
      city: this.getSnapshotCity(booking.serviceSnapshot),
      bookingStatus: booking.status,
      paymentStatus: this.resolvePaymentStatus(booking.status, payment),
      expectedAmount: this.resolveExpectedAmount(booking, payment),
      startDate: booking.startDate,
      endDate: booking.endDate,
      timeSlot: booking.timeSlot,
      assignedResourceId: booking.assignedResource?.id,
      assignedResourceLabel: booking.assignedResource?.label,
      cancellationPolicy: booking.serviceSnapshot.cancellationPolicy,
      supportContact: this.getSupportContact(booking.serviceSnapshot),
      serviceVoucherCode: this.resolveVoucherCode(booking),
      serviceVoucherInstructions: this.resolveVoucherInstructions(booking),
      createdAt: booking.createdAt,
      paymentEvents: paymentEvents.map((event) =>
        this.toOrderPaymentEvent(event),
      ),
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
      return this.toOrderPaymentStatus(payment.status);
    }

    if (
      bookingStatus === BookingStatus.PAID ||
      bookingStatus === BookingStatus.CONFIRMED ||
      bookingStatus === BookingStatus.IN_SERVICE ||
      bookingStatus === BookingStatus.COMPLETED
    ) {
      return OrderPaymentStatus.PAID;
    }

    if (bookingStatus === BookingStatus.REFUNDING) {
      return OrderPaymentStatus.REFUNDING;
    }

    if (bookingStatus === BookingStatus.REFUNDED) {
      return OrderPaymentStatus.REFUNDED;
    }

    if (bookingStatus === BookingStatus.CANCELED) {
      return OrderPaymentStatus.EXPIRED;
    }

    return OrderPaymentStatus.PENDING;
  }

  private toOrderPaymentStatus(status: PaymentStatus): OrderPaymentStatus {
    switch (status) {
      case PaymentStatus.PENDING:
        return OrderPaymentStatus.PENDING;
      case PaymentStatus.PARTIALLY_PAID:
        return OrderPaymentStatus.PARTIALLY_PAID;
      case PaymentStatus.PAID:
        return OrderPaymentStatus.PAID;
      case PaymentStatus.UNDERPAID:
        return OrderPaymentStatus.UNDERPAID;
      case PaymentStatus.EXPIRED:
        return OrderPaymentStatus.EXPIRED;
      case PaymentStatus.REFUNDING:
        return OrderPaymentStatus.REFUNDING;
      case PaymentStatus.REFUNDED:
        return OrderPaymentStatus.REFUNDED;
      default:
        return OrderPaymentStatus.PENDING;
    }
  }

  private toOrderPaymentEvent(event: PaymentEventLog): OrderPaymentEvent {
    return {
      eventId: event.eventId,
      source: event.source,
      status: event.status,
      paidAmount: event.paidAmount,
      txHash: event.txHash,
      confirmations: event.confirmations,
      createdAt: event.createdAt,
    };
  }

  private getSupportContact(
    snapshot: BookingServiceSnapshot,
  ): OrderContact | undefined {
    if (!snapshot.supportContact) {
      return undefined;
    }

    return {
      name: snapshot.supportContact.name,
      channel: snapshot.supportContact.channel,
      value: snapshot.supportContact.value,
    };
  }

  private resolveVoucherCode(booking: Booking): string | undefined {
    if (
      booking.status === BookingStatus.PENDING_PAYMENT ||
      booking.status === BookingStatus.CANCELED
    ) {
      return undefined;
    }

    return `VCHR-${booking.id.toUpperCase()}`;
  }

  private resolveVoucherInstructions(booking: Booking): string | undefined {
    const template = booking.serviceSnapshot.voucherTemplate?.trim();
    if (!template) {
      return undefined;
    }

    return template.replaceAll('{bookingId}', booking.id);
  }
}
