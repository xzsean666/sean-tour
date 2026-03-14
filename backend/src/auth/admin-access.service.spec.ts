import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { DBService, PGKVDatabase } from '../common/db.service';
import { config } from '../config';
import { AdminAccessService } from './admin-access.service';

jest.mock('../common/db.service', () => ({
  DBService: class DBService {},
  PGKVDatabase: class PGKVDatabase {},
}));

type InMemoryRow = {
  value: unknown;
};

function createInMemoryTravelDB(): {
  db: PGKVDatabase;
  store: Map<string, InMemoryRow>;
} {
  const store = new Map<string, InMemoryRow>();

  return {
    store,
    db: {
      get<T = unknown>(key: string): Promise<T | null> {
        return Promise.resolve(
          ((store.get(key)?.value as T) || null) as T | null,
        );
      },
      put(key: string, value: unknown): Promise<void> {
        store.set(key, { value });
        return Promise.resolve();
      },
      getWithPrefix<T = unknown>(prefix: string): Promise<Record<string, T>> {
        const result: Record<string, T> = {};

        for (const [key, row] of store.entries()) {
          if (key.startsWith(prefix)) {
            result[key] = row.value as T;
          }
        }

        return Promise.resolve(result);
      },
    } as PGKVDatabase,
  };
}

describe('AdminAccessService', () => {
  const originalAdminUserIds = config.auth.ADMIN_USER_IDS;
  const originalAdminUserEmails = config.auth.ADMIN_USER_EMAILS;

  const { db, store } = createInMemoryTravelDB();
  const dbServiceMock: Partial<DBService> = {
    getDBInstance: jest.fn().mockReturnValue(db),
  };

  let service: AdminAccessService;

  beforeEach(() => {
    store.clear();
    config.auth.ADMIN_USER_IDS = '';
    config.auth.ADMIN_USER_EMAILS = '';
    service = new AdminAccessService(dbServiceMock as DBService);
  });

  afterAll(() => {
    config.auth.ADMIN_USER_IDS = originalAdminUserIds;
    config.auth.ADMIN_USER_EMAILS = originalAdminUserEmails;
  });

  it('recognizes db-managed admin access by user id', async () => {
    await service.setAdminAccess(
      {
        userId: 'admin_user_1',
        email: 'admin@example.com',
        enabled: true,
      },
      { user_id: 'seed_admin' },
    );

    await expect(
      service.isAdminIdentity({
        userId: 'admin_user_1',
        email: 'admin@example.com',
      }),
    ).resolves.toBe(true);
    expect(store.has('role_access:ADMIN:user:admin_user_1')).toBe(true);
  });

  it('lists env and db admin entries together', async () => {
    config.auth.ADMIN_USER_EMAILS = 'env-admin@example.com';

    await service.setAdminAccess(
      {
        userId: 'db_admin_1',
        enabled: true,
        displayName: 'DB Admin',
      },
      { user_id: 'seed_admin' },
    );

    const entries = await service.listAdminAccessEntries();

    expect(entries).toHaveLength(2);
    expect(entries.some((item) => item.source === 'ENV')).toBe(true);
    expect(entries.some((item) => item.source === 'DB')).toBe(true);
  });

  it('prevents removing the last effective admin', async () => {
    await service.setAdminAccess(
      {
        userId: 'db_admin_1',
        enabled: true,
      },
      { user_id: 'seed_admin' },
    );

    await expect(
      service.setAdminAccess(
        {
          userId: 'db_admin_1',
          enabled: false,
        },
        { user_id: 'seed_admin' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects disabling a missing admin entry', async () => {
    await expect(
      service.setAdminAccess(
        {
          email: 'missing@example.com',
          enabled: false,
        },
        { user_id: 'seed_admin' },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
