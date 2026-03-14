import type { DBService, PGKVDatabase } from '../common/db.service';
import { NotificationService } from './notification.service';
import { NotificationType } from './dto/notification-type.enum';

jest.mock('../common/db.service', () => ({
  DBService: class DBService {},
  PGKVDatabase: class PGKVDatabase {},
}));

type SearchJsonOptions = {
  contains?: Record<string, unknown>;
  limit?: number;
  offset?: number;
  include_total?: boolean;
  order_by?: 'ASC' | 'DESC';
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
      return Promise.resolve((store.get(key) as T) || null);
    },
    delete(key: string): Promise<boolean> {
      return Promise.resolve(store.delete(key));
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

      rows.sort((left, right) => {
        const leftCreatedAt =
          typeof (left.value as { createdAt?: unknown })?.createdAt === 'string'
            ? ((left.value as { createdAt: string }).createdAt ?? '')
            : '';
        const rightCreatedAt =
          typeof (right.value as { createdAt?: unknown })?.createdAt ===
          'string'
            ? ((right.value as { createdAt: string }).createdAt ?? '')
            : '';

        return options.order_by === 'ASC'
          ? leftCreatedAt.localeCompare(rightCreatedAt)
          : rightCreatedAt.localeCompare(leftCreatedAt);
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

function createNotificationRecord(params: {
  id: string;
  userId: string;
  type?: NotificationType;
  readAt?: string;
  createdAt: string;
}) {
  return {
    entityType: 'NOTIFICATION' as const,
    id: params.id,
    userId: params.userId,
    type: params.type ?? NotificationType.SYSTEM,
    title: `Title ${params.id}`,
    message: `Message ${params.id}`,
    targetPath: '/profile',
    readAt: params.readAt,
    createdAt: params.createdAt,
    updatedAt: params.createdAt,
  };
}

describe('NotificationService', () => {
  it('paginates beyond the first 200 notifications without truncation', async () => {
    const initial: Record<string, unknown> = {};

    for (let index = 0; index < 240; index += 1) {
      const createdAt = new Date(
        Date.UTC(2026, 2, 14, 0, 0, index),
      ).toISOString();
      initial[`notification:ntf_${index}`] = createNotificationRecord({
        id: `ntf_${index}`,
        userId: 'user_1',
        createdAt,
      });
    }

    const { db } = createInMemoryTravelDB(initial);
    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };

    const service = new NotificationService(dbServiceMock as DBService);

    const page = await service.listMyNotifications('user_1', {
      page: {
        limit: 30,
        offset: 210,
      },
    });

    expect(page.total).toBe(240);
    expect(page.items).toHaveLength(30);
    expect(page.hasMore).toBe(false);

    const exported = await service.exportNotificationsByUser('user_1');
    expect(exported).toHaveLength(240);
  });

  it('keeps unread-only pagination correct after the first batch', async () => {
    const initial: Record<string, unknown> = {};

    for (let index = 0; index < 260; index += 1) {
      const createdAt = new Date(
        Date.UTC(2026, 2, 14, 1, 0, index),
      ).toISOString();
      initial[`notification:unread_${index}`] = createNotificationRecord({
        id: `unread_${index}`,
        userId: 'user_2',
        createdAt,
        ...(index < 40
          ? {
              readAt: new Date(
                Date.UTC(2026, 2, 15, 0, 0, index),
              ).toISOString(),
            }
          : {}),
      });
    }

    const { db } = createInMemoryTravelDB(initial);
    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };

    const service = new NotificationService(dbServiceMock as DBService);

    const page = await service.listMyNotifications('user_2', {
      unreadOnly: true,
      page: {
        limit: 30,
        offset: 200,
      },
    });

    expect(page.total).toBe(220);
    expect(page.items).toHaveLength(20);
    expect(page.hasMore).toBe(false);
    expect(page.items.every((item) => !item.readAt)).toBe(true);
  });
});
