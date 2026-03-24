import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { DBService, PGKVDatabase } from '../common/db.service';
import { config } from '../config';
import { AdminAccessService } from './admin-access.service';
import { RoleAccessAuditAction } from './dto/role-access-audit-action.enum';

jest.mock('../common/db.service', () => ({
  DBService: class DBService {},
  PGKVDatabase: class PGKVDatabase {},
}));

type InMemoryRow = {
  value: unknown;
  created_at: Date;
  updated_at: Date;
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
        const now = new Date();
        const existing = store.get(key);
        store.set(key, {
          value,
          created_at: existing?.created_at || now,
          updated_at: now,
        });
        return Promise.resolve();
      },
      delete(key: string): Promise<boolean> {
        return Promise.resolve(store.delete(key));
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
      searchJson(options: {
        contains?: Record<string, unknown>;
        limit?: number;
        offset?: number;
        include_total?: boolean;
      }): Promise<{
        data: Array<{
          key: string;
          value: unknown;
          created_at: Date;
          updated_at: Date;
        }>;
        next_cursor: null;
        total?: number;
      }> {
        const entries = [...store.entries()]
          .filter(([, row]) =>
            matchesContains(row.value, options.contains || {}),
          )
          .sort(
            (left, right) =>
              right[1].created_at.getTime() - left[1].created_at.getTime(),
          );
        const offset = Math.max(options.offset ?? 0, 0);
        const limit = Math.max(options.limit ?? entries.length, 0);
        const page = entries
          .slice(offset, offset + limit)
          .map(([key, row]) => ({
            key,
            value: row.value,
            created_at: row.created_at,
            updated_at: row.updated_at,
          }));

        return Promise.resolve({
          data: page,
          next_cursor: null,
          ...(options.include_total ? { total: entries.length } : {}),
        });
      },
    } as PGKVDatabase,
  };
}

function matchesContains(
  value: unknown,
  contains: Record<string, unknown>,
): boolean {
  if (!contains || Object.keys(contains).length === 0) {
    return true;
  }

  if (!value || typeof value !== 'object') {
    return false;
  }

  return Object.entries(contains).every(
    ([key, expected]) => (value as Record<string, unknown>)[key] === expected,
  );
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

  it('records admin access audit logs for create and disable actions', async () => {
    config.auth.ADMIN_USER_IDS = 'bootstrap_admin';

    await service.setAdminAccess(
      {
        userId: 'db_admin_1',
        email: 'db-admin@example.com',
        displayName: 'DB Admin',
        enabled: true,
      },
      { user_id: 'seed_admin' },
    );

    await service.setAdminAccess(
      {
        userId: 'db_admin_1',
        enabled: false,
      },
      { user_id: 'seed_admin' },
    );

    const result = await service.listRoleAccessAuditLogs(
      'ADMIN',
      'user:db_admin_1',
      {
        limit: 10,
        offset: 0,
      },
    );

    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(
      result.items.every((item) => item.recordId === 'user:db_admin_1'),
    ).toBe(true);
    expect(
      result.items.every((item) => item.actor === 'admin:seed_admin'),
    ).toBe(true);

    const actions = result.items.map((item) => item.action).sort();
    expect(actions).toEqual([
      RoleAccessAuditAction.CREATED,
      RoleAccessAuditAction.DISABLED,
    ]);

    const disabled = result.items.find(
      (item) => item.action === RoleAccessAuditAction.DISABLED,
    );
    expect(disabled).toMatchObject({
      enabled: false,
      previousEnabled: true,
      userId: 'db_admin_1',
      email: 'db-admin@example.com',
      displayName: 'DB Admin',
    });
  });

  it('migrates an email grant to userId without leaving duplicate records', async () => {
    await service.setAdminAccess(
      {
        email: 'ops@example.com',
        displayName: 'Ops Lead',
        enabled: true,
      },
      { user_id: 'seed_admin' },
    );

    const migrated = await service.setAdminAccess(
      {
        recordId: 'email:ops@example.com',
        userId: 'ops_user_1',
        email: 'ops@example.com',
        displayName: 'Ops Lead',
        enabled: true,
      },
      { user_id: 'seed_admin' },
    );

    expect(migrated.id).toBe('user:ops_user_1');
    expect(store.has('role_access:ADMIN:email:ops@example.com')).toBe(false);
    expect(store.has('role_access:ADMIN:user:ops_user_1')).toBe(true);

    const entries = await service.listAdminAccessEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.id).toBe('user:ops_user_1');
    expect(entries[0]?.email).toBe('ops@example.com');
  });
});
