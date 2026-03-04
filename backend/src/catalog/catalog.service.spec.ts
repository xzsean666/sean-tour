import type { DBService, PGKVDatabase } from '../common/db.service';
import { CatalogService } from './catalog.service';
import { ServiceAuditAction } from './dto/service-audit-action.enum';
import { ServiceType } from './dto/service-type.enum';

jest.mock('../common/db.service', () => ({
  DBService: class DBService {},
  PGKVDatabase: class PGKVDatabase {},
}));

type SearchJsonOptions = {
  contains?: Record<string, unknown>;
  limit?: number;
  offset?: number;
  order_by?: 'ASC' | 'DESC';
  order_by_field?: 'key' | 'created_at' | 'updated_at';
  include_total?: boolean;
};

type InMemoryRow = {
  value: unknown;
  created_at: Date;
  updated_at: Date;
};

function createInMemoryTravelDB(initial?: Record<string, unknown>): {
  db: PGKVDatabase;
  store: Map<string, InMemoryRow>;
} {
  const store = new Map<string, InMemoryRow>();
  const now = new Date();

  for (const [key, value] of Object.entries(initial || {})) {
    store.set(key, {
      value,
      created_at: now,
      updated_at: now,
    });
  }

  const dbMock = {
    put(key: string, value: unknown): Promise<void> {
      const existing = store.get(key);
      const timestamp = new Date();
      store.set(key, {
        value,
        created_at: existing?.created_at || timestamp,
        updated_at: timestamp,
      });
      return Promise.resolve();
    },
    get<T = unknown>(key: string): Promise<T | null> {
      return Promise.resolve((store.get(key)?.value as T) || null);
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
    searchJson(options: SearchJsonOptions): Promise<{
      data: Array<{
        key: string;
        value: unknown;
        created_at: Date;
        updated_at: Date;
      }>;
      next_cursor: string | null;
      total?: number;
    }> {
      const contains = options.contains;
      const rows = Array.from(store.entries())
        .map(([key, row]) => ({
          key,
          value: row.value,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }))
        .filter((row) => {
          if (!contains) {
            return true;
          }

          if (!row.value || typeof row.value !== 'object') {
            return false;
          }

          const candidate = row.value as Record<string, unknown>;
          return Object.entries(contains).every(
            ([field, expected]) => candidate[field] === expected,
          );
        });

      const orderByField = options.order_by_field || 'key';
      const orderBy = options.order_by || 'ASC';

      rows.sort((a, b) => {
        let compareResult = 0;
        if (orderByField === 'key') {
          compareResult = a.key.localeCompare(b.key);
        } else if (orderByField === 'created_at') {
          compareResult = a.created_at.getTime() - b.created_at.getTime();
        } else {
          compareResult = a.updated_at.getTime() - b.updated_at.getTime();
        }
        return orderBy === 'ASC' ? compareResult : -compareResult;
      });

      const offset = Math.max(options.offset || 0, 0);
      const limit = Math.max(options.limit || rows.length, 1);
      const paged = rows.slice(offset, offset + limit);

      return Promise.resolve({
        data: paged,
        next_cursor: null,
        ...(options.include_total ? { total: rows.length } : {}),
      });
    },
  };

  return {
    db: dbMock as unknown as PGKVDatabase,
    store,
  };
}

function buildPackageInput(id: string) {
  return {
    id,
    type: ServiceType.PACKAGE,
    title: `Package ${id}`,
    city: 'Beijing',
    description: 'Test package',
    images: ['https://example.com/image-1.jpg'],
    languages: ['English'],
    basePriceAmount: 99,
    status: 'ACTIVE',
    packageDetail: {
      durationDays: 2,
      itinerary: ['Day 1', 'Day 2'],
    },
  };
}

describe('CatalogService', () => {
  function createService() {
    const { db } = createInMemoryTravelDB();
    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };
    const service = new CatalogService(dbServiceMock as DBService);
    return { service };
  }

  it('updates service status and writes audit logs', async () => {
    const { service } = createService();
    const serviceId = 'svc_pkg_test_status';

    const created = await service.upsertService(buildPackageInput(serviceId));
    const updated = await service.setServiceStatus({
      id: created.id,
      status: 'INACTIVE',
    });

    expect(updated.status).toBe('INACTIVE');

    const allLogs = await service.listServiceAuditLogs({
      serviceId,
      page: { limit: 20, offset: 0 },
    });
    expect(allLogs.total).toBe(2);
    expect(allLogs.items.map((item) => item.action)).toEqual(
      expect.arrayContaining([
        ServiceAuditAction.STATUS_CHANGE,
        ServiceAuditAction.UPSERT,
      ]),
    );

    const statusLogs = await service.listServiceAuditLogs({
      serviceId,
      action: ServiceAuditAction.STATUS_CHANGE,
      page: { limit: 20, offset: 0 },
    });
    expect(statusLogs.total).toBe(1);
    expect(statusLogs.items[0].afterStatus).toBe('INACTIVE');
  });

  it('supports soft delete with DELETED status and audit log', async () => {
    const { service } = createService();
    const serviceId = 'svc_pkg_test_soft_delete';

    await service.upsertService(buildPackageInput(serviceId));
    const deleted = await service.deleteService({
      id: serviceId,
      hardDelete: false,
    });
    expect(deleted).toBe(true);

    const detail = await service.getServiceOrThrow(serviceId);
    expect(detail.status).toBe('DELETED');

    const logs = await service.listServiceAuditLogs({
      serviceId,
      action: ServiceAuditAction.DELETE,
      page: { limit: 20, offset: 0 },
    });
    expect(logs.total).toBe(1);
    expect(logs.items[0].beforeStatus).toBe('ACTIVE');
    expect(logs.items[0].afterStatus).toBe('DELETED');
  });

  it('supports hard delete and keeps deletion audit trail', async () => {
    const { service } = createService();
    const serviceId = 'svc_pkg_test_hard_delete';

    await service.upsertService(buildPackageInput(serviceId));
    const deleted = await service.deleteService({
      id: serviceId,
      hardDelete: true,
    });
    expect(deleted).toBe(true);

    await expect(service.getServiceOrThrow(serviceId)).rejects.toThrow(
      `Service ${serviceId} not found`,
    );

    const logs = await service.listServiceAuditLogs({
      serviceId,
      action: ServiceAuditAction.DELETE,
      page: { limit: 20, offset: 0 },
    });
    expect(logs.total).toBe(1);
    expect(logs.items[0].beforeStatus).toBe('ACTIVE');
    expect(logs.items[0].afterStatus).toBeUndefined();
  });
});
