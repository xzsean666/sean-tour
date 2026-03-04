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

describe('BookingService', () => {
  it('creates booking when service is active and traveler count fits seats', async () => {
    const { db } = createInMemoryTravelDB();

    const catalogServiceMock: Partial<CatalogService> = {
      getServiceOrThrow: jest.fn().mockResolvedValue(createCarService()),
    };
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

    const catalogServiceMock: Partial<CatalogService> = {
      getServiceOrThrow: jest.fn().mockResolvedValue(createCarService()),
    };
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

    const catalogServiceMock: Partial<CatalogService> = {
      getServiceOrThrow: jest.fn().mockResolvedValue(createCarService()),
    };
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

    const catalogServiceMock: Partial<CatalogService> = {
      getServiceOrThrow: jest.fn().mockResolvedValue(createCarService()),
    };
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
});
