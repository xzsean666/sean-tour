import type { CatalogService } from '../catalog/catalog.service';
import { ServiceType } from '../catalog/dto/service-type.enum';
import type { DBService, PGKVDatabase } from '../common/db.service';
import { BookingService } from './booking.service';
import { BookingStatus } from './dto/booking-status.enum';

jest.mock('../catalog/catalog.service', () => ({
  CatalogService: class CatalogService {},
}));

jest.mock('../common/db.service', () => ({
  DBService: class DBService {},
  PGKVDatabase: class PGKVDatabase {},
}));

type SearchJsonOptions = {
  contains?: Record<string, unknown>;
  limit?: number;
  offset?: number;
  order_by?: 'ASC' | 'DESC';
  include_total?: boolean;
};

function createInMemoryTravelDB(initial?: Record<string, unknown>): {
  db: PGKVDatabase;
  store: Map<string, unknown>;
} {
  const store = new Map<string, unknown>(Object.entries(initial || {}));

  const dbMock = {
    put(key: string, value: unknown): Promise<void> {
      store.set(key, value);
      return Promise.resolve();
    },
    get<T = unknown>(key: string): Promise<T | null> {
      if (!store.has(key)) {
        return Promise.resolve(null);
      }

      return Promise.resolve(store.get(key) as T);
    },
    getWithPrefix<T = unknown>(prefix: string): Promise<Record<string, T>> {
      const result: Record<string, T> = {};
      for (const [key, value] of store.entries()) {
        if (key.startsWith(prefix)) {
          result[key] = value as T;
        }
      }
      return Promise.resolve(result);
    },
    searchJson(options: SearchJsonOptions): Promise<{
      data: Array<{ key: string; value: unknown }>;
      total?: number;
    }> {
      const rows = Array.from(store.entries())
        .map(([key, value]) => ({ key, value }))
        .filter((row) => {
          const contains = options.contains;
          if (!contains) {
            return true;
          }

          if (!row.value || typeof row.value !== 'object') {
            return false;
          }

          const candidate = row.value as Record<string, unknown>;
          return Object.entries(contains).every(
            ([field, expectedValue]) => candidate[field] === expectedValue,
          );
        });

      rows.sort((a, b) => {
        const aCreatedAt =
          typeof (a.value as { createdAt?: unknown })?.createdAt === 'string'
            ? ((a.value as { createdAt: string }).createdAt ?? '')
            : '';
        const bCreatedAt =
          typeof (b.value as { createdAt?: unknown })?.createdAt === 'string'
            ? ((b.value as { createdAt: string }).createdAt ?? '')
            : '';

        return options.order_by === 'ASC'
          ? aCreatedAt.localeCompare(bCreatedAt)
          : bCreatedAt.localeCompare(aCreatedAt);
      });

      const offset = Math.max(options.offset || 0, 0);
      const limit = Math.max(options.limit || rows.length, 1);
      const paged = rows.slice(offset, offset + limit);

      return Promise.resolve({
        data: paged,
        ...(options.include_total ? { total: rows.length } : {}),
      });
    },
  };

  return {
    db: dbMock as unknown as PGKVDatabase,
    store,
  };
}

function createCarService(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: 'svc_car_1',
    type: ServiceType.CAR,
    title: 'Shenzhen 7-Seater Chauffeur Service',
    city: 'Shenzhen',
    status: 'ACTIVE',
    basePrice: {
      amount: 259,
      currency: 'USDT',
    },
    detail: {
      __typename: 'CarServiceDetail',
      seats: 7,
      carType: 'Business Van',
      luggageCapacity: '4 large suitcases',
    },
    ...overrides,
  };
}

function createCatalogServiceMock(
  service = createCarService(),
): Partial<CatalogService> {
  return {
    getServiceOrThrow: jest.fn().mockResolvedValue(service),
    reserveServiceCapacity: jest.fn().mockResolvedValue(undefined),
    releaseServiceCapacity: jest.fn().mockResolvedValue(undefined),
    reserveServiceAssignment: jest.fn().mockResolvedValue(undefined),
    releaseServiceAssignment: jest.fn().mockResolvedValue(undefined),
  };
}

describe('BookingService', () => {
  it('creates booking when service is active and traveler count fits seats', async () => {
    const { db } = createInMemoryTravelDB();

    const catalogServiceMock = createCatalogServiceMock();
    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };

    const service = new BookingService(
      catalogServiceMock as CatalogService,
      dbServiceMock as DBService,
    );

    const booking = await service.createBooking('user_1', {
      serviceId: 'svc_car_1',
      startDate: '2026-03-20',
      endDate: '2026-03-22',
      travelerCount: 5,
    });

    expect(booking.serviceId).toBe('svc_car_1');
    expect(booking.status).toBe(BookingStatus.PENDING_PAYMENT);
  });

  it('rejects booking when traveler count exceeds car seats', async () => {
    const { db } = createInMemoryTravelDB();

    const catalogServiceMock = createCatalogServiceMock();
    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };

    const service = new BookingService(
      catalogServiceMock as CatalogService,
      dbServiceMock as DBService,
    );

    await expect(
      service.createBooking('user_1', {
        serviceId: 'svc_car_1',
        startDate: '2026-03-20',
        endDate: '2026-03-22',
        travelerCount: 8,
      }),
    ).rejects.toThrow('travelerCount exceeds car seats limit (7)');
  });

  it('rejects overlapping booking for same user and service', async () => {
    const existingBooking = {
      entityType: 'BOOKING',
      id: 'bk_existing',
      userId: 'user_1',
      serviceId: 'svc_car_1',
      serviceType: ServiceType.CAR,
      startDate: '2026-03-21',
      endDate: '2026-03-23',
      travelerCount: 3,
      status: BookingStatus.PAID,
      serviceSnapshot: {
        title: 'Shenzhen 7-Seater Chauffeur Service',
        city: 'Shenzhen',
        basePrice: {
          amount: 259,
          currency: 'USDT',
        },
      },
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    };

    const { db } = createInMemoryTravelDB({
      'booking:bk_existing': existingBooking,
    });

    const catalogServiceMock = createCatalogServiceMock();
    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };

    const service = new BookingService(
      catalogServiceMock as CatalogService,
      dbServiceMock as DBService,
    );

    await expect(
      service.createBooking('user_1', {
        serviceId: 'svc_car_1',
        startDate: '2026-03-22',
        endDate: '2026-03-24',
        travelerCount: 2,
      }),
    ).rejects.toThrow(
      'Duplicate booking overlap detected with booking bk_existing',
    );
  });

  it('allows overlap when previous booking is canceled', async () => {
    const canceledBooking = {
      entityType: 'BOOKING',
      id: 'bk_existing',
      userId: 'user_1',
      serviceId: 'svc_car_1',
      serviceType: ServiceType.CAR,
      startDate: '2026-03-21',
      endDate: '2026-03-23',
      travelerCount: 3,
      status: BookingStatus.CANCELED,
      serviceSnapshot: {
        title: 'Shenzhen 7-Seater Chauffeur Service',
        city: 'Shenzhen',
        basePrice: {
          amount: 259,
          currency: 'USDT',
        },
      },
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    };

    const { db } = createInMemoryTravelDB({
      'booking:bk_existing': canceledBooking,
    });

    const catalogServiceMock = createCatalogServiceMock();
    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };

    const service = new BookingService(
      catalogServiceMock as CatalogService,
      dbServiceMock as DBService,
    );

    const booking = await service.createBooking('user_1', {
      serviceId: 'svc_car_1',
      startDate: '2026-03-22',
      endDate: '2026-03-24',
      travelerCount: 2,
    });

    expect(booking.id).toContain('bk_');
  });

  it('assigns a matching resource for timed bookings and releases it on cancel', async () => {
    const { db } = createInMemoryTravelDB();
    const timeSlot = '2026-03-20 09:00 Shenzhen Airport';
    const catalogServiceMock = createCatalogServiceMock(
      createCarService({
        capacity: {
          min: 1,
          max: 7,
          remaining: 2,
        },
        availableTimeSlots: [timeSlot],
        resources: [
          {
            id: 'car_sz_van_01',
            label: 'Van 01',
            status: 'ACTIVE',
            languages: ['English', 'Chinese'],
            seats: 7,
            availableTimeSlots: [timeSlot],
          },
        ],
        cancellationPolicy: 'Free cancellation up to 24 hours before pickup.',
        supportContact: {
          name: 'Shenzhen Transport Ops',
          channel: 'Phone',
          value: '+86-138-0000-1002',
        },
        voucherTemplate: 'Driver dispatch uses booking {bookingId}.',
      }),
    );

    (
      catalogServiceMock.reserveServiceAssignment as jest.Mock
    ).mockResolvedValue({
      id: 'car_sz_van_01',
      label: 'Van 01',
    });

    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };

    const service = new BookingService(
      catalogServiceMock as CatalogService,
      dbServiceMock as DBService,
    );

    const booking = await service.createBooking('user_1', {
      serviceId: 'svc_car_1',
      startDate: '2026-03-20',
      endDate: '2026-03-20',
      travelerCount: 3,
      timeSlot,
    });

    expect(booking.timeSlot).toBe(timeSlot);
    expect(booking.assignedResource).toEqual({
      id: 'car_sz_van_01',
      label: 'Van 01',
    });
    expect(catalogServiceMock.reserveServiceAssignment).toHaveBeenCalledWith({
      id: 'svc_car_1',
      timeSlot,
      travelerCount: 3,
    });

    await service.cancelBooking('user_1', booking.id);

    expect(catalogServiceMock.releaseServiceCapacity).toHaveBeenCalledWith(
      'svc_car_1',
    );
    expect(catalogServiceMock.releaseServiceAssignment).toHaveBeenCalledWith({
      id: 'svc_car_1',
      resourceId: 'car_sz_van_01',
      timeSlot,
    });
  });

  it('lists assignable resources and supports admin reassignment', async () => {
    const timeSlot = '2026-03-20 09:00 Shenzhen Airport';
    const existingBooking = {
      entityType: 'BOOKING',
      id: 'bk_reassign',
      userId: 'user_1',
      serviceId: 'svc_car_1',
      serviceType: ServiceType.CAR,
      startDate: '2026-03-20',
      endDate: '2026-03-20',
      timeSlot,
      travelerCount: 3,
      assignedResource: {
        id: 'car_sz_van_01',
        label: 'Van 01',
      },
      status: BookingStatus.CONFIRMED,
      serviceSnapshot: {
        title: 'Shenzhen 7-Seater Chauffeur Service',
        city: 'Shenzhen',
        basePrice: {
          amount: 259,
          currency: 'USDT',
        },
      },
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    };

    const { db } = createInMemoryTravelDB({
      'booking:bk_reassign': existingBooking,
    });
    const catalogServiceMock = createCatalogServiceMock(
      createCarService({
        capacity: {
          min: 1,
          max: 7,
          remaining: 1,
        },
        availableTimeSlots: [timeSlot],
        resources: [
          {
            id: 'car_sz_van_01',
            label: 'Van 01',
            status: 'ACTIVE',
            languages: ['English', 'Chinese'],
            seats: 7,
            availableTimeSlots: [],
          },
          {
            id: 'car_sz_van_02',
            label: 'Van 02',
            status: 'ACTIVE',
            languages: ['Chinese'],
            seats: 7,
            availableTimeSlots: [timeSlot],
          },
        ],
      }),
    );

    (
      catalogServiceMock.reserveServiceAssignment as jest.Mock
    ).mockResolvedValue({
      id: 'car_sz_van_02',
      label: 'Van 02',
    });

    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };

    const service = new BookingService(
      catalogServiceMock as CatalogService,
      dbServiceMock as DBService,
    );

    const resources =
      await service.listAssignableResourcesByAdmin('bk_reassign');
    expect(resources.map((resource) => resource.id)).toEqual([
      'car_sz_van_01',
      'car_sz_van_02',
    ]);

    const updated = await service.reassignBookingResourceByAdmin({
      bookingId: 'bk_reassign',
      resourceId: 'car_sz_van_02',
    });

    expect(updated.assignedResource).toEqual({
      id: 'car_sz_van_02',
      label: 'Van 02',
    });
    expect(catalogServiceMock.reserveServiceAssignment).toHaveBeenCalledWith({
      id: 'svc_car_1',
      timeSlot,
      travelerCount: 3,
      resourceId: 'car_sz_van_02',
    });
    expect(catalogServiceMock.releaseServiceAssignment).toHaveBeenCalledWith({
      id: 'svc_car_1',
      resourceId: 'car_sz_van_01',
      timeSlot,
    });
  });

  it('builds a service resource schedule with assigned and unassigned bookings', async () => {
    const slot = '2026-03-20 09:00 Shenzhen Airport';
    const { db } = createInMemoryTravelDB({
      'booking:bk_assigned': {
        entityType: 'BOOKING',
        id: 'bk_assigned',
        userId: 'user_1',
        serviceId: 'svc_car_1',
        serviceType: ServiceType.CAR,
        startDate: '2026-03-20',
        endDate: '2026-03-20',
        timeSlot: slot,
        travelerCount: 2,
        assignedResource: {
          id: 'car_sz_van_01',
          label: 'Van 01',
        },
        status: BookingStatus.CONFIRMED,
        serviceSnapshot: {
          title: 'Shenzhen 7-Seater Chauffeur Service',
          city: 'Shenzhen',
          basePrice: {
            amount: 259,
            currency: 'USDT',
          },
        },
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
      'booking:bk_unassigned': {
        entityType: 'BOOKING',
        id: 'bk_unassigned',
        userId: 'user_2',
        serviceId: 'svc_car_1',
        serviceType: ServiceType.CAR,
        startDate: '2026-03-20',
        endDate: '2026-03-20',
        timeSlot: '2026-03-20 13:00 Shenzhen City',
        travelerCount: 4,
        status: BookingStatus.PAID,
        serviceSnapshot: {
          title: 'Shenzhen 7-Seater Chauffeur Service',
          city: 'Shenzhen',
          basePrice: {
            amount: 259,
            currency: 'USDT',
          },
        },
        createdAt: '2026-03-01T00:10:00.000Z',
        updatedAt: '2026-03-01T00:10:00.000Z',
      },
    });

    const catalogServiceMock = createCatalogServiceMock(
      createCarService({
        title: 'Shenzhen 7-Seater Chauffeur Service',
        resources: [
          {
            id: 'car_sz_van_01',
            label: 'Van 01',
            status: 'ACTIVE',
            languages: ['English', 'Chinese'],
            seats: 7,
            availableTimeSlots: [],
          },
          {
            id: 'car_sz_van_02',
            label: 'Van 02',
            status: 'ACTIVE',
            languages: ['Chinese'],
            seats: 7,
            availableTimeSlots: ['2026-03-20 13:00 Shenzhen City'],
          },
        ],
      }),
    );

    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };

    const service = new BookingService(
      catalogServiceMock as CatalogService,
      dbServiceMock as DBService,
    );

    const schedule =
      await service.getServiceResourceScheduleByAdmin('svc_car_1');

    expect(schedule.serviceId).toBe('svc_car_1');
    expect(schedule.resources).toHaveLength(2);
    expect(schedule.resources[0]?.bookings[0]?.bookingId).toBe('bk_assigned');
    expect(schedule.resources[0]?.conflictTimeSlots).toEqual([]);
    expect(schedule.unassignedBookings.map((item) => item.bookingId)).toEqual([
      'bk_unassigned',
    ]);
  });

  it('marks duplicate resource bookings on the same slot as conflicts', async () => {
    const slot = '2026-03-20 09:00 Shenzhen Airport';
    const { db } = createInMemoryTravelDB({
      'booking:bk_conflict_1': {
        entityType: 'BOOKING',
        id: 'bk_conflict_1',
        userId: 'user_1',
        serviceId: 'svc_car_1',
        serviceType: ServiceType.CAR,
        startDate: '2026-03-20',
        endDate: '2026-03-20',
        timeSlot: slot,
        travelerCount: 2,
        assignedResource: {
          id: 'car_sz_van_01',
          label: 'Van 01',
        },
        status: BookingStatus.CONFIRMED,
        serviceSnapshot: {
          title: 'Shenzhen 7-Seater Chauffeur Service',
          city: 'Shenzhen',
          basePrice: {
            amount: 259,
            currency: 'USDT',
          },
        },
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
      'booking:bk_conflict_2': {
        entityType: 'BOOKING',
        id: 'bk_conflict_2',
        userId: 'user_2',
        serviceId: 'svc_car_1',
        serviceType: ServiceType.CAR,
        startDate: '2026-03-20',
        endDate: '2026-03-20',
        timeSlot: slot,
        travelerCount: 3,
        assignedResource: {
          id: 'car_sz_van_01',
          label: 'Van 01',
        },
        status: BookingStatus.PAID,
        serviceSnapshot: {
          title: 'Shenzhen 7-Seater Chauffeur Service',
          city: 'Shenzhen',
          basePrice: {
            amount: 259,
            currency: 'USDT',
          },
        },
        createdAt: '2026-03-01T00:10:00.000Z',
        updatedAt: '2026-03-01T00:10:00.000Z',
      },
    });

    const catalogServiceMock = createCatalogServiceMock(
      createCarService({
        resources: [
          {
            id: 'car_sz_van_01',
            label: 'Van 01',
            status: 'ACTIVE',
            languages: ['English', 'Chinese'],
            seats: 7,
            availableTimeSlots: [],
          },
        ],
      }),
    );

    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };

    const service = new BookingService(
      catalogServiceMock as CatalogService,
      dbServiceMock as DBService,
    );

    const schedule =
      await service.getServiceResourceScheduleByAdmin('svc_car_1');

    expect(schedule.resources).toHaveLength(1);
    expect(
      schedule.resources[0]?.bookings.map((item) => item.bookingId),
    ).toEqual(['bk_conflict_1', 'bk_conflict_2']);
    expect(schedule.resources[0]?.conflictTimeSlots).toEqual([slot]);
    expect(schedule.unassignedBookings).toEqual([]);
  });

  it('filters resource schedule by date when provided', async () => {
    const { db } = createInMemoryTravelDB({
      'booking:bk_day_1': {
        entityType: 'BOOKING',
        id: 'bk_day_1',
        userId: 'user_1',
        serviceId: 'svc_car_1',
        serviceType: ServiceType.CAR,
        startDate: '2026-03-20',
        endDate: '2026-03-20',
        timeSlot: '2026-03-20 09:00 Shenzhen Airport',
        travelerCount: 2,
        assignedResource: {
          id: 'car_sz_van_01',
          label: 'Van 01',
        },
        status: BookingStatus.CONFIRMED,
        serviceSnapshot: {
          title: 'Shenzhen 7-Seater Chauffeur Service',
          city: 'Shenzhen',
          basePrice: {
            amount: 259,
            currency: 'USDT',
          },
        },
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
      'booking:bk_day_2': {
        entityType: 'BOOKING',
        id: 'bk_day_2',
        userId: 'user_2',
        serviceId: 'svc_car_1',
        serviceType: ServiceType.CAR,
        startDate: '2026-03-21',
        endDate: '2026-03-21',
        timeSlot: '2026-03-21 13:00 Shenzhen City',
        travelerCount: 4,
        status: BookingStatus.PAID,
        serviceSnapshot: {
          title: 'Shenzhen 7-Seater Chauffeur Service',
          city: 'Shenzhen',
          basePrice: {
            amount: 259,
            currency: 'USDT',
          },
        },
        createdAt: '2026-03-01T00:10:00.000Z',
        updatedAt: '2026-03-01T00:10:00.000Z',
      },
    });

    const catalogServiceMock = createCatalogServiceMock(
      createCarService({
        resources: [
          {
            id: 'car_sz_van_01',
            label: 'Van 01',
            status: 'ACTIVE',
            languages: ['English', 'Chinese'],
            seats: 7,
            availableTimeSlots: [],
          },
        ],
      }),
    );

    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };

    const service = new BookingService(
      catalogServiceMock as CatalogService,
      dbServiceMock as DBService,
    );

    const schedule = await service.getServiceResourceScheduleByAdmin(
      'svc_car_1',
      '2026-03-21',
    );

    expect(schedule.resources).toHaveLength(1);
    expect(schedule.resources[0]?.bookings).toEqual([]);
    expect(schedule.unassignedBookings.map((item) => item.bookingId)).toEqual([
      'bk_day_2',
    ]);
  });
});
