import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CatalogService } from '../catalog/catalog.service';
import { DBService, PGKVDatabase } from '../common/db.service';
import { Booking } from './dto/booking.dto';
import { BookingListInput } from './dto/booking-list.input';
import { BookingPage } from './dto/booking-page.dto';
import { BookingStatus } from './dto/booking-status.enum';
import { CreateBookingInput } from './dto/create-booking.input';

type BookingRecord = Booking & {
  entityType: 'BOOKING';
};

type SearchJsonRow = {
  key: string;
  value: unknown;
  created_at?: Date;
  updated_at?: Date;
};

@Injectable()
export class BookingService {
  private readonly travelDB: PGKVDatabase;

  constructor(
    private readonly catalogService: CatalogService,
    private readonly dbService: DBService,
  ) {
    this.travelDB = this.dbService.getDBInstance('travel_kv');
  }

  async createBooking(
    userId: string,
    input: CreateBookingInput,
  ): Promise<Booking> {
    this.assertDateRange(input.startDate, input.endDate);

    if (!Number.isInteger(input.travelerCount) || input.travelerCount < 1) {
      throw new BadRequestException('travelerCount must be at least 1');
    }

    const service = await this.catalogService.getServiceOrThrow(
      input.serviceId,
    );
    const now = new Date().toISOString();
    const booking: BookingRecord = {
      entityType: 'BOOKING',
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
        city: service.city,
        basePrice: service.basePrice,
      },
      rating: undefined,
      createdAt: now,
      updatedAt: now,
    };

    await this.travelDB.put(`booking:${booking.id}`, booking);
    return this.toBooking(booking);
  }

  async listMyBookings(
    userId: string,
    input?: BookingListInput,
  ): Promise<BookingPage> {
    const limit = Math.min(Math.max(input?.page?.limit ?? 10, 1), 50);
    const offset = Math.max(input?.page?.offset ?? 0, 0);

    const contains: Record<string, unknown> = {
      entityType: 'BOOKING',
      userId,
    };

    if (input?.status) {
      contains.status = input.status;
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
      .map((row) => this.toBookingRecord(row.value))
      .filter((value): value is BookingRecord => value !== null)
      .map((record) => this.toBooking(record));

    const total = result.total ?? items.length;

    return {
      items,
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    };
  }

  async getBookingByIdForUser(
    userId: string,
    bookingId: string,
  ): Promise<Booking> {
    const record = await this.getBookingRecordByIdForUser(userId, bookingId);
    return this.toBooking(record);
  }

  async markBookingPaidById(bookingId: string): Promise<Booking> {
    const record = await this.getBookingRecordById(bookingId);

    if (record.status !== BookingStatus.PENDING_PAYMENT) {
      return this.toBooking(record);
    }

    const updated: BookingRecord = {
      ...record,
      status: BookingStatus.PAID,
      updatedAt: new Date().toISOString(),
    };

    await this.travelDB.put(`booking:${updated.id}`, updated);
    return this.toBooking(updated);
  }

  async cancelBooking(
    userId: string,
    bookingId: string,
    reason?: string,
  ): Promise<Booking> {
    const record = await this.getBookingRecordByIdForUser(userId, bookingId);

    if (record.status !== BookingStatus.PENDING_PAYMENT) {
      throw new BadRequestException(
        'Only PENDING_PAYMENT bookings can be canceled',
      );
    }

    const updated: BookingRecord = {
      ...record,
      status: BookingStatus.CANCELED,
      cancelReason: reason?.trim() || 'Canceled by user',
      updatedAt: new Date().toISOString(),
    };

    await this.travelDB.put(`booking:${updated.id}`, updated);
    return this.toBooking(updated);
  }

  private async getBookingRecordByIdForUser(
    userId: string,
    bookingId: string,
  ): Promise<BookingRecord> {
    const record = await this.getBookingRecordById(bookingId);

    if (record.userId !== userId) {
      throw new ForbiddenException('Booking access denied');
    }

    return record;
  }

  private async getBookingRecordById(
    bookingId: string,
  ): Promise<BookingRecord> {
    const booking = await this.travelDB.get<BookingRecord>(
      `booking:${bookingId}`,
    );
    const record = this.toBookingRecord(booking);

    if (!record) {
      throw new NotFoundException(`Booking ${bookingId} not found`);
    }

    return record;
  }

  private toBookingRecord(value: unknown): BookingRecord | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const candidate = value as Partial<BookingRecord>;

    if (candidate.entityType !== 'BOOKING') {
      return null;
    }

    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.userId !== 'string' ||
      typeof candidate.serviceId !== 'string' ||
      typeof candidate.createdAt !== 'string' ||
      typeof candidate.updatedAt !== 'string'
    ) {
      return null;
    }

    return candidate as BookingRecord;
  }

  private toBooking(record: BookingRecord): Booking {
    const { entityType, ...booking } = record;
    void entityType;

    const snapshot = booking.serviceSnapshot;
    const city =
      typeof snapshot?.city === 'string' && snapshot.city.trim()
        ? snapshot.city
        : 'N/A';

    return {
      ...booking,
      serviceSnapshot: {
        ...snapshot,
        city,
      },
    };
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
