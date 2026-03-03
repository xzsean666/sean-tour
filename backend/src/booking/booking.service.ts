import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CatalogService } from '../catalog/catalog.service';
import { Booking } from './dto/booking.dto';
import { BookingListInput } from './dto/booking-list.input';
import { BookingPage } from './dto/booking-page.dto';
import { BookingStatus } from './dto/booking-status.enum';
import { CreateBookingInput } from './dto/create-booking.input';

const bookingStore = new Map<string, Booking>();

@Injectable()
export class BookingService {
  constructor(private readonly catalogService: CatalogService) {}

  createBooking(userId: string, input: CreateBookingInput): Booking {
    this.assertDateRange(input.startDate, input.endDate);

    if (!Number.isInteger(input.travelerCount) || input.travelerCount < 1) {
      throw new BadRequestException('travelerCount must be at least 1');
    }

    const service = this.catalogService.getServiceOrThrow(input.serviceId);
    const now = new Date().toISOString();
    const booking: Booking = {
      id: this.generateBookingId(),
      userId,
      serviceId: service.id,
      serviceType: service.type,
      startDate: input.startDate,
      endDate: input.endDate,
      travelerCount: input.travelerCount,
      status: BookingStatus.PENDING_PAYMENT,
      cancelReason: undefined,
      serviceSnapshot: {
        title: service.title,
        basePrice: service.basePrice,
      },
      rating: undefined,
      createdAt: now,
      updatedAt: now,
    };

    bookingStore.set(booking.id, booking);
    return booking;
  }

  listMyBookings(userId: string, input?: BookingListInput): BookingPage {
    const limit = Math.min(Math.max(input?.page?.limit ?? 10, 1), 50);
    const offset = Math.max(input?.page?.offset ?? 0, 0);

    const filtered = Array.from(bookingStore.values())
      .filter((item) => {
        if (item.userId !== userId) {
          return false;
        }

        if (input?.status && item.status !== input.status) {
          return false;
        }

        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const items = filtered.slice(offset, offset + limit);

    return {
      items,
      total: filtered.length,
      limit,
      offset,
      hasMore: offset + items.length < filtered.length,
    };
  }

  getBookingByIdForUser(userId: string, bookingId: string): Booking {
    const booking = bookingStore.get(bookingId);

    if (!booking) {
      throw new NotFoundException(`Booking ${bookingId} not found`);
    }

    if (booking.userId !== userId) {
      throw new ForbiddenException('Booking access denied');
    }

    return booking;
  }

  cancelBooking(userId: string, bookingId: string, reason?: string): Booking {
    const booking = this.getBookingByIdForUser(userId, bookingId);

    if (booking.status !== BookingStatus.PENDING_PAYMENT) {
      throw new BadRequestException(
        'Only PENDING_PAYMENT bookings can be canceled',
      );
    }

    const updated: Booking = {
      ...booking,
      status: BookingStatus.CANCELED,
      cancelReason: reason?.trim() || 'Canceled by user',
      updatedAt: new Date().toISOString(),
    };

    bookingStore.set(updated.id, updated);
    return updated;
  }

  private assertDateRange(startDate: string, endDate: string): void {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Invalid startDate or endDate');
    }

    if (end.getTime() < start.getTime()) {
      throw new BadRequestException('endDate must be on or after startDate');
    }
  }

  private generateBookingId(): string {
    return `bk_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
  }
}
