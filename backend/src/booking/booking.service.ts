import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CatalogService } from '../catalog/catalog.service';
import { ServiceResource } from '../catalog/dto/service-resource.dto';
import { ServiceType } from '../catalog/dto/service-type.enum';
import { DBService, PGKVDatabase } from '../common/db.service';
import { NotificationType } from '../notification/dto/notification-type.enum';
import { NotificationService } from '../notification/notification.service';
import { Booking } from './dto/booking.dto';
import { BookingListInput } from './dto/booking-list.input';
import { BookingPage } from './dto/booking-page.dto';
import { BookingStatus } from './dto/booking-status.enum';
import { CreateBookingInput } from './dto/create-booking.input';
import { ReassignBookingResourceInput } from './dto/reassign-booking-resource.input';
import {
  ServiceResourceSchedule,
  ServiceResourceScheduleBooking,
} from './dto/service-resource-schedule.dto';
import { UpdateBookingStatusInput } from './dto/update-booking-status.input';

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
    @Optional()
    private readonly notificationService?: NotificationService,
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

    if (service.status !== 'ACTIVE') {
      throw new BadRequestException('Service is not available for booking');
    }

    if (service.capacity && service.capacity.remaining <= 0) {
      throw new BadRequestException('Service is sold out');
    }

    if (
      service.type !== ServiceType.CAR &&
      service.capacity &&
      (input.travelerCount < service.capacity.min ||
        input.travelerCount > service.capacity.max)
    ) {
      throw new BadRequestException(
        `travelerCount must be between ${service.capacity.min} and ${service.capacity.max}`,
      );
    }

    if (
      service.type === ServiceType.CAR &&
      service.detail.__typename === 'CarServiceDetail' &&
      input.travelerCount > service.detail.seats
    ) {
      throw new BadRequestException(
        `travelerCount exceeds car seats limit (${service.detail.seats})`,
      );
    }

    const timeSlot = this.normalizeOptionalText(input.timeSlot);
    const availableTimeSlots = service.availableTimeSlots ?? [];

    if (availableTimeSlots.length > 0) {
      if (!timeSlot) {
        throw new BadRequestException('timeSlot is required for this service');
      }

      if (!availableTimeSlots.includes(timeSlot)) {
        throw new BadRequestException('Selected timeSlot is not available');
      }
    }

    await this.assertNoOverlappingBooking(
      userId,
      service.id,
      input.startDate,
      input.endDate,
      timeSlot,
    );

    const now = new Date().toISOString();
    let assignedResource:
      | {
          id: string;
          label: string;
        }
      | undefined;
    let capacityReserved = false;

    if (timeSlot) {
      const reservedResource =
        await this.catalogService.reserveServiceAssignment({
          id: service.id,
          timeSlot,
          travelerCount: input.travelerCount,
        });

      if (reservedResource) {
        assignedResource = {
          id: reservedResource.id,
          label: reservedResource.label,
        };
      }
    }

    await this.catalogService.reserveServiceCapacity(service.id);
    capacityReserved = true;

    const booking: BookingRecord = {
      entityType: 'BOOKING',
      id: this.generateBookingId(),
      userId,
      serviceId: service.id,
      serviceType: service.type,
      startDate: input.startDate,
      endDate: input.endDate,
      timeSlot,
      travelerCount: input.travelerCount,
      assignedResource,
      status: BookingStatus.PENDING_PAYMENT,
      cancelReason: undefined,
      serviceSnapshot: {
        title: service.title,
        city: service.city,
        basePrice: service.basePrice,
        cancellationPolicy: service.cancellationPolicy,
        supportContact: service.supportContact,
        voucherTemplate: service.voucherTemplate,
      },
      rating: undefined,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.travelDB.put(`booking:${booking.id}`, booking);
      await this.notifyBooking(
        userId,
        'Booking created',
        `${service.title} has been reserved and is waiting for payment.`,
        `/checkout/${booking.id}`,
      );
      return this.toBooking(booking);
    } catch (error) {
      if (capacityReserved) {
        await this.catalogService.releaseServiceCapacity(service.id);
      }

      if (assignedResource && timeSlot) {
        await this.catalogService.releaseServiceAssignment({
          id: service.id,
          resourceId: assignedResource.id,
          timeSlot,
        });
      }

      throw error;
    }
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
    return this.updateBookingStatusInternal(
      bookingId,
      BookingStatus.PAID,
      undefined,
      false,
    );
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
    await this.catalogService.releaseServiceCapacity(record.serviceId);
    await this.catalogService.releaseServiceAssignment({
      id: record.serviceId,
      resourceId: record.assignedResource?.id,
      timeSlot: record.timeSlot,
    });
    await this.notifyBooking(
      record.userId,
      'Booking canceled',
      `${record.serviceSnapshot.title} has been canceled.`,
      `/orders/${record.id}`,
    );
    return this.toBooking(updated);
  }

  async expireBookingById(bookingId: string): Promise<Booking> {
    const record = await this.getBookingRecordById(bookingId);

    if (record.status !== BookingStatus.PENDING_PAYMENT) {
      return this.toBooking(record);
    }

    const updated: BookingRecord = {
      ...record,
      status: BookingStatus.CANCELED,
      cancelReason: 'Payment expired',
      updatedAt: new Date().toISOString(),
    };

    await this.travelDB.put(`booking:${updated.id}`, updated);
    await this.catalogService.releaseServiceCapacity(record.serviceId);
    await this.catalogService.releaseServiceAssignment({
      id: record.serviceId,
      resourceId: record.assignedResource?.id,
      timeSlot: record.timeSlot,
    });
    await this.notifyBooking(
      record.userId,
      'Payment expired',
      `${record.serviceSnapshot.title} was released because payment expired.`,
      `/orders/${record.id}`,
    );
    return this.toBooking(updated);
  }

  async updateBookingStatusByAdmin(
    input: UpdateBookingStatusInput,
  ): Promise<Booking> {
    const bookingId = this.requireText(input.bookingId, 'bookingId');
    const reason = this.normalizeOptionalText(input.reason);

    return this.updateBookingStatusInternal(
      bookingId,
      input.status,
      reason,
      true,
    );
  }

  async listAllBookingsForAdmin(filters?: {
    userId?: string;
    status?: BookingStatus;
  }): Promise<Booking[]> {
    const records =
      await this.travelDB.getWithPrefix<BookingRecord>('booking:');

    return Object.values(records)
      .map((value) => this.toBookingRecord(value))
      .filter((value): value is BookingRecord => value !== null)
      .filter((record) => {
        if (
          filters?.userId?.trim() &&
          record.userId !== filters.userId.trim()
        ) {
          return false;
        }

        if (filters?.status && record.status !== filters.status) {
          return false;
        }

        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((record) => this.toBooking(record));
  }

  async getBookingByIdForAdmin(bookingId: string): Promise<Booking> {
    const record = await this.getBookingRecordById(bookingId);
    return this.toBooking(record);
  }

  async listAssignableResourcesByAdmin(
    bookingId: string,
  ): Promise<ServiceResource[]> {
    const record = await this.getBookingRecordById(bookingId);

    if (!record.timeSlot) {
      return [];
    }

    const service = await this.catalogService.getServiceOrThrow(
      record.serviceId,
    );

    return this.getAssignableResources(
      record,
      service.type,
      service.resources || [],
    );
  }

  async getServiceResourceScheduleByAdmin(
    serviceId: string,
    date?: string,
  ): Promise<ServiceResourceSchedule> {
    const normalizedServiceId = this.requireText(serviceId, 'serviceId');
    const normalizedDate = this.normalizeOptionalDate(date, 'date');
    const service =
      await this.catalogService.getServiceOrThrow(normalizedServiceId);
    const records =
      await this.travelDB.getWithPrefix<BookingRecord>('booking:');
    const bookings = Object.values(records)
      .map((value) => this.toBookingRecord(value))
      .filter((value): value is BookingRecord => value !== null)
      .filter((record) => {
        return (
          record.serviceId === normalizedServiceId &&
          !!record.timeSlot &&
          record.status !== BookingStatus.CANCELED &&
          this.matchesScheduleDate(record, normalizedDate)
        );
      })
      .sort((left, right) => {
        const leftSlot = left.timeSlot || '';
        const rightSlot = right.timeSlot || '';

        if (leftSlot !== rightSlot) {
          return leftSlot.localeCompare(rightSlot);
        }

        return left.createdAt.localeCompare(right.createdAt);
      });

    const bookingsByResource = new Map<
      string,
      ServiceResourceScheduleBooking[]
    >();
    const unassignedBookings: ServiceResourceScheduleBooking[] = [];

    for (const record of bookings) {
      const scheduleBooking = this.toServiceResourceScheduleBooking(record);

      if (record.assignedResource?.id) {
        const items = bookingsByResource.get(record.assignedResource.id) || [];
        items.push(scheduleBooking);
        bookingsByResource.set(record.assignedResource.id, items);
        continue;
      }

      unassignedBookings.push(scheduleBooking);
    }

    return {
      serviceId: service.id,
      serviceTitle: service.title,
      resources: (service.resources || []).map((resource) => {
        const resourceBookings = bookingsByResource.get(resource.id) || [];
        const slotCounts = new Map<string, number>();

        for (const booking of resourceBookings) {
          if (!booking.timeSlot) {
            continue;
          }

          slotCounts.set(
            booking.timeSlot,
            (slotCounts.get(booking.timeSlot) || 0) + 1,
          );
        }

        return {
          resourceId: resource.id,
          resourceLabel: resource.label,
          status: resource.status,
          languages: resource.languages,
          seats: resource.seats,
          availableTimeSlots: resource.availableTimeSlots,
          bookings: resourceBookings,
          conflictTimeSlots: Array.from(slotCounts.entries())
            .filter(([, count]) => count > 1)
            .map(([slot]) => slot),
        };
      }),
      unassignedBookings,
    };
  }

  async reassignBookingResourceByAdmin(
    input: ReassignBookingResourceInput,
  ): Promise<Booking> {
    const bookingId = this.requireText(input.bookingId, 'bookingId');
    const resourceId = this.requireText(input.resourceId, 'resourceId');
    const record = await this.getBookingRecordById(bookingId);

    if (!record.timeSlot) {
      throw new BadRequestException(
        'Only time-slot bookings can be reassigned to a resource',
      );
    }

    if (
      record.status === BookingStatus.CANCELED ||
      record.status === BookingStatus.COMPLETED ||
      record.status === BookingStatus.REFUNDED
    ) {
      throw new BadRequestException(
        `Booking ${bookingId} cannot be reassigned in status ${record.status}`,
      );
    }

    if (record.assignedResource?.id === resourceId) {
      return this.toBooking(record);
    }

    const service = await this.catalogService.getServiceOrThrow(
      record.serviceId,
    );
    const assignableResources = this.getAssignableResources(
      record,
      service.type,
      service.resources || [],
    );
    const nextResource = assignableResources.find(
      (resource) => resource.id === resourceId,
    );

    if (!nextResource) {
      throw new BadRequestException(
        `Resource ${resourceId} is not assignable for booking ${bookingId}`,
      );
    }

    let newReservationCreated = false;
    let previousReservationReleased = false;

    try {
      await this.catalogService.reserveServiceAssignment({
        id: record.serviceId,
        timeSlot: record.timeSlot,
        travelerCount: record.travelerCount,
        resourceId: nextResource.id,
      });
      newReservationCreated = true;

      if (record.assignedResource?.id) {
        await this.catalogService.releaseServiceAssignment({
          id: record.serviceId,
          resourceId: record.assignedResource.id,
          timeSlot: record.timeSlot,
        });
        previousReservationReleased = true;
      }

      const updated: BookingRecord = {
        ...record,
        assignedResource: {
          id: nextResource.id,
          label: nextResource.label,
        },
        updatedAt: new Date().toISOString(),
      };

      await this.travelDB.put(`booking:${updated.id}`, updated);
      await this.notifyBooking(
        record.userId,
        'Resource updated',
        `${record.serviceSnapshot.title} is now assigned to ${nextResource.label}.`,
        `/orders/${record.id}`,
      );
      return this.toBooking(updated);
    } catch (error) {
      if (previousReservationReleased && record.assignedResource?.id) {
        await this.catalogService
          .reserveServiceAssignment({
            id: record.serviceId,
            timeSlot: record.timeSlot,
            travelerCount: record.travelerCount,
            resourceId: record.assignedResource.id,
          })
          .catch(() => undefined);
      }

      if (newReservationCreated) {
        await this.catalogService
          .releaseServiceAssignment({
            id: record.serviceId,
            resourceId: nextResource.id,
            timeSlot: record.timeSlot,
          })
          .catch(() => undefined);
      }

      throw error;
    }
  }

  async markBookingRefundingById(bookingId: string): Promise<Booking> {
    return this.updateBookingStatusInternal(
      bookingId,
      BookingStatus.REFUNDING,
      undefined,
      false,
    );
  }

  async markBookingRefundedById(bookingId: string): Promise<Booking> {
    return this.updateBookingStatusInternal(
      bookingId,
      BookingStatus.REFUNDED,
      undefined,
      false,
    );
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

  private async updateBookingStatusInternal(
    bookingId: string,
    nextStatus: BookingStatus,
    reason?: string,
    validateTransition = true,
  ): Promise<Booking> {
    const record = await this.getBookingRecordById(bookingId);

    if (record.status === nextStatus) {
      return this.toBooking(record);
    }

    if (validateTransition) {
      this.assertBookingTransition(record.status, nextStatus);
    }

    const updated: BookingRecord = {
      ...record,
      status: nextStatus,
      cancelReason:
        nextStatus === BookingStatus.CANCELED
          ? reason || record.cancelReason || 'Canceled by admin'
          : record.cancelReason,
      updatedAt: new Date().toISOString(),
    };

    await this.travelDB.put(`booking:${updated.id}`, updated);

    if (
      record.status !== BookingStatus.CANCELED &&
      nextStatus === BookingStatus.CANCELED
    ) {
      await this.catalogService.releaseServiceCapacity(record.serviceId);
      await this.catalogService.releaseServiceAssignment({
        id: record.serviceId,
        resourceId: record.assignedResource?.id,
        timeSlot: record.timeSlot,
      });
    }

    await this.notifyBooking(
      record.userId,
      `Booking ${nextStatus}`,
      `${record.serviceSnapshot.title} moved to ${nextStatus}.`,
      `/orders/${record.id}`,
    );

    return this.toBooking(updated);
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

  private async assertNoOverlappingBooking(
    userId: string,
    serviceId: string,
    startDate: string,
    endDate: string,
    timeSlot?: string,
  ): Promise<void> {
    const result = await this.travelDB.searchJson({
      contains: {
        entityType: 'BOOKING',
        userId,
        serviceId,
      },
      limit: 100,
      order_by: 'DESC',
      order_by_field: 'created_at',
    });

    for (const row of result.data as SearchJsonRow[]) {
      const existing = this.toBookingRecord(row.value);
      if (!existing || existing.status === BookingStatus.CANCELED) {
        continue;
      }

      if (timeSlot && existing.timeSlot && existing.timeSlot !== timeSlot) {
        continue;
      }

      if (
        this.isDateRangeOverlapping(
          startDate,
          endDate,
          existing.startDate,
          existing.endDate,
        )
      ) {
        throw new BadRequestException(
          `Duplicate booking overlap detected with booking ${existing.id}`,
        );
      }
    }
  }

  private isDateRangeOverlapping(
    startA: string,
    endA: string,
    startB: string,
    endB: string,
  ): boolean {
    const rangeAStart = new Date(startA).getTime();
    const rangeAEnd = new Date(endA).getTime();
    const rangeBStart = new Date(startB).getTime();
    const rangeBEnd = new Date(endB).getTime();

    if (
      Number.isNaN(rangeAStart) ||
      Number.isNaN(rangeAEnd) ||
      Number.isNaN(rangeBStart) ||
      Number.isNaN(rangeBEnd)
    ) {
      return false;
    }

    return rangeAStart <= rangeBEnd && rangeBStart <= rangeAEnd;
  }

  private generateBookingId(): string {
    return `bk_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
  }

  private assertBookingTransition(
    currentStatus: BookingStatus,
    nextStatus: BookingStatus,
  ): void {
    const transitions: Record<BookingStatus, BookingStatus[]> = {
      [BookingStatus.PENDING_PAYMENT]: [
        BookingStatus.PAID,
        BookingStatus.CANCELED,
      ],
      [BookingStatus.PAID]: [BookingStatus.CONFIRMED, BookingStatus.REFUNDING],
      [BookingStatus.CONFIRMED]: [
        BookingStatus.IN_SERVICE,
        BookingStatus.REFUNDING,
      ],
      [BookingStatus.IN_SERVICE]: [BookingStatus.COMPLETED],
      [BookingStatus.COMPLETED]: [],
      [BookingStatus.CANCELED]: [],
      [BookingStatus.REFUNDING]: [BookingStatus.REFUNDED],
      [BookingStatus.REFUNDED]: [],
    };

    if (transitions[currentStatus]?.includes(nextStatus)) {
      return;
    }

    throw new BadRequestException(
      `Invalid booking status transition: ${currentStatus} -> ${nextStatus}`,
    );
  }

  private requireText(value: string | undefined, fieldName: string): string {
    const normalized = value?.trim();

    if (!normalized) {
      throw new BadRequestException(`${fieldName} is required`);
    }

    return normalized;
  }

  private normalizeOptionalText(value?: string): string | undefined {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }

  private normalizeOptionalDate(
    value: string | undefined,
    fieldName: string,
  ): string | undefined {
    const normalized = this.normalizeOptionalText(value);

    if (!normalized) {
      return undefined;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      throw new BadRequestException(
        `${fieldName} must be in YYYY-MM-DD format`,
      );
    }

    return normalized;
  }

  private matchesScheduleDate(record: BookingRecord, date?: string): boolean {
    if (!date) {
      return true;
    }

    return record.startDate <= date && record.endDate >= date;
  }

  private getAssignableResources(
    record: BookingRecord,
    serviceType: ServiceType,
    resources: ServiceResource[],
  ): ServiceResource[] {
    const currentResourceId = record.assignedResource?.id;
    const bookingTimeSlot = record.timeSlot;

    if (!bookingTimeSlot || resources.length === 0) {
      return [];
    }

    return resources
      .filter((resource) => {
        if (resource.id === currentResourceId) {
          return true;
        }

        if (resource.status !== 'ACTIVE') {
          return false;
        }

        if (!resource.availableTimeSlots.includes(bookingTimeSlot)) {
          return false;
        }

        if (
          serviceType === ServiceType.CAR &&
          resource.seats !== undefined &&
          record.travelerCount > resource.seats
        ) {
          return false;
        }

        return true;
      })
      .sort((left, right) => {
        if (left.id === currentResourceId) {
          return -1;
        }

        if (right.id === currentResourceId) {
          return 1;
        }

        return left.label.localeCompare(right.label);
      });
  }

  private toServiceResourceScheduleBooking(
    record: BookingRecord,
  ): ServiceResourceScheduleBooking {
    return {
      bookingId: record.id,
      userId: record.userId,
      bookingStatus: record.status,
      startDate: record.startDate,
      endDate: record.endDate,
      timeSlot: record.timeSlot,
      travelerCount: record.travelerCount,
      assignedResourceId: record.assignedResource?.id,
      assignedResourceLabel: record.assignedResource?.label,
    };
  }

  private async notifyBooking(
    userId: string,
    title: string,
    message: string,
    targetPath: string,
  ): Promise<void> {
    if (!this.notificationService) {
      return;
    }

    await this.notificationService.createNotification({
      userId,
      type: NotificationType.BOOKING,
      title,
      message,
      targetPath,
    });
  }
}
