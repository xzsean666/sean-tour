import { ForbiddenException } from '@nestjs/common';
import type { BookingService } from '../booking/booking.service';
import { BookingStatus } from '../booking/dto/booking-status.enum';
import { ServiceType } from '../catalog/dto/service-type.enum';
import type { DBService, PGKVDatabase } from '../common/db.service';
import { AssistantService } from './assistant.service';
import { AssistantSessionStatus } from './dto/assistant-session-status.enum';

jest.mock('../booking/booking.service', () => ({
  BookingService: class BookingService {},
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

function createBooking(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: 'bk_assistant_1',
    userId: 'user_1',
    serviceId: 'svc_assistant_1',
    serviceType: ServiceType.ASSISTANT,
    startDate: '2026-03-10',
    endDate: '2026-03-10',
    travelerCount: 1,
    status: BookingStatus.PAID,
    serviceSnapshot: {
      title: 'Remote China Assistant (8 Hours)',
      city: 'Remote',
      basePrice: {
        amount: 99,
        currency: 'USDT',
      },
    },
    createdAt: '2026-03-04T09:00:00.000Z',
    updatedAt: '2026-03-04T09:00:00.000Z',
    ...overrides,
  };
}

describe('AssistantService', () => {
  it('creates assistant session and reuses existing session for same booking', async () => {
    const { db, store } = createInMemoryTravelDB();

    const bookingServiceMock: Partial<BookingService> = {
      getBookingByIdForUser: jest.fn().mockResolvedValue(createBooking()),
    };
    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };

    const service = new AssistantService(
      bookingServiceMock as BookingService,
      dbServiceMock as DBService,
    );

    const first = await service.requestAssistantSession('user_1', {
      bookingId: 'bk_assistant_1',
      topic: 'Need translation support for hotel check-in',
      preferredContact: 'WeChat: traveler001',
      preferredTimeSlots: ['2026-03-10 10:00-12:00 CST'],
      language: 'English',
    });

    const second = await service.requestAssistantSession('user_1', {
      bookingId: 'bk_assistant_1',
      topic: 'Need translation support for hotel check-in',
      preferredContact: 'WeChat: traveler001',
      preferredTimeSlots: ['2026-03-10 10:00-12:00 CST'],
      language: 'English',
    });

    expect(first.id).toBe(second.id);
    expect(first.status).toBe(AssistantSessionStatus.REQUESTED);

    const sessionEntries = Array.from(store.keys()).filter((key) =>
      key.startsWith('assistant_session:'),
    );
    expect(sessionEntries).toHaveLength(1);
  });

  it('rejects request for non-assistant booking', async () => {
    const { db } = createInMemoryTravelDB();

    const bookingServiceMock: Partial<BookingService> = {
      getBookingByIdForUser: jest.fn().mockResolvedValue(
        createBooking({
          serviceType: ServiceType.PACKAGE,
          serviceId: 'svc_pkg_1',
        }),
      ),
    };
    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };

    const service = new AssistantService(
      bookingServiceMock as BookingService,
      dbServiceMock as DBService,
    );

    await expect(
      service.requestAssistantSession('user_1', {
        bookingId: 'bk_assistant_1',
        topic: 'Need assistant',
        preferredContact: 'Email',
        preferredTimeSlots: ['2026-03-10 10:00-12:00 CST'],
      }),
    ).rejects.toThrow(
      'assistant session is only available for ASSISTANT bookings',
    );
  });

  it('allows admin status update and enforces user ownership on detail', async () => {
    const { db } = createInMemoryTravelDB();

    const bookingServiceMock: Partial<BookingService> = {
      getBookingByIdForUser: jest.fn().mockResolvedValue(createBooking()),
    };
    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };

    const service = new AssistantService(
      bookingServiceMock as BookingService,
      dbServiceMock as DBService,
    );

    const created = await service.requestAssistantSession('user_1', {
      bookingId: 'bk_assistant_1',
      topic: 'Need local support for emergency transport',
      preferredContact: 'WhatsApp: +1-000-111-2222',
      preferredTimeSlots: ['2026-03-10 18:00-20:00 CST'],
    });

    const updated = await service.adminUpdateAssistantSession({
      sessionId: created.id,
      status: AssistantSessionStatus.ASSIGNED,
      assignedAgent: 'Agent-Li',
      internalNote: 'priority',
    });

    expect(updated.status).toBe(AssistantSessionStatus.ASSIGNED);
    expect(updated.assignedAgent).toBe('Agent-Li');

    const mySessions = await service.listMyAssistantSessions('user_1', {
      status: AssistantSessionStatus.ASSIGNED,
      page: { limit: 10, offset: 0 },
    });
    expect(mySessions.total).toBe(1);
    expect(mySessions.items[0].id).toBe(created.id);

    await expect(
      service.getAssistantSessionDetailForUser('user_2', created.id),
    ).rejects.toThrow(ForbiddenException);
  });
});
