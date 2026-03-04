import { createHmac } from 'crypto';
import type { BookingService } from '../booking/booking.service';
import type { DBService, PGKVDatabase } from '../common/db.service';
import { config } from '../config';
import { PaymentEventSource } from './dto/payment-event-source.enum';
import { PaymentStatus } from './dto/payment-status.enum';
import { UpdatePaymentStatusInput } from './dto/update-payment-status.input';
import { PaymentService } from './payment.service';

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

function signCallbackInput(
  input: UpdatePaymentStatusInput,
  callbackSecret: string,
): string {
  const payload = [
    input.eventId?.trim() || '',
    input.paymentId?.trim() || '',
    input.bookingId?.trim() || '',
    input.status || '',
    input.paidAmount?.trim() || '',
    input.txHash?.trim() || '',
    input.confirmations !== undefined ? String(input.confirmations) : '',
  ].join('|');

  return createHmac('sha256', callbackSecret).update(payload).digest('hex');
}

describe('PaymentService', () => {
  const originalCallbackSecret = config.payment.CALLBACK_SECRET;
  const originalReplayCooldownSeconds = config.payment.REPLAY_COOLDOWN_SECONDS;

  const now = new Date().toISOString();
  const paymentRecord = {
    entityType: 'PAYMENT' as const,
    id: 'pay_1001',
    bookingId: 'bk_1001',
    userId: 'user_1001',
    token: 'USDT',
    network: 'BSC',
    tokenStandard: 'ERC20',
    expectedAmount: '100.00',
    paidAmount: '0.00',
    payAddress: '0x0000000000000000000000000000000000BEEF',
    txHash: undefined,
    confirmations: 0,
    status: PaymentStatus.PENDING,
    expiredAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    createdAt: now,
    updatedAt: now,
  };

  afterEach(() => {
    config.payment.CALLBACK_SECRET = originalCallbackSecret;
    config.payment.REPLAY_COOLDOWN_SECONDS = originalReplayCooldownSeconds;
  });

  it('rejects callback update when signature is invalid', async () => {
    config.payment.CALLBACK_SECRET = 'callback-secret';

    const { db } = createInMemoryTravelDB({
      'payment:pay_1001': paymentRecord,
    });

    const bookingServiceMock: Partial<BookingService> = {
      markBookingPaidById: jest.fn(),
    };
    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };
    const service = new PaymentService(
      bookingServiceMock as BookingService,
      dbServiceMock as DBService,
    );

    const input: UpdatePaymentStatusInput = {
      paymentId: 'pay_1001',
      status: PaymentStatus.PAID,
      paidAmount: '100.00',
      confirmations: 12,
      eventId: 'evt_invalid_sig',
      signature: 'invalid-signature',
    };

    await expect(
      service.updatePaymentStatus(input, {
        requireSignature: true,
        source: PaymentEventSource.CALLBACK,
      }),
    ).rejects.toThrow('Invalid callback signature');
  });

  it('rejects callback update when PAYMENT_CALLBACK_SECRET is missing', async () => {
    config.payment.CALLBACK_SECRET = '';

    const { db } = createInMemoryTravelDB({
      'payment:pay_1001': paymentRecord,
    });

    const bookingServiceMock: Partial<BookingService> = {
      markBookingPaidById: jest.fn(),
    };
    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };
    const service = new PaymentService(
      bookingServiceMock as BookingService,
      dbServiceMock as DBService,
    );

    const input: UpdatePaymentStatusInput = {
      paymentId: 'pay_1001',
      status: PaymentStatus.PAID,
      paidAmount: '100.00',
      eventId: 'evt_missing_secret',
      signature: 'whatever',
    };

    await expect(
      service.updatePaymentStatus(input, {
        requireSignature: true,
        source: PaymentEventSource.CALLBACK,
      }),
    ).rejects.toThrow('PAYMENT_CALLBACK_SECRET is not configured');
  });

  it('deduplicates callback events by eventId and syncs booking only once', async () => {
    const callbackSecret = 'callback-secret';
    config.payment.CALLBACK_SECRET = callbackSecret;

    const { db, store } = createInMemoryTravelDB({
      'payment:pay_1001': paymentRecord,
    });

    const bookingServiceMock: Partial<BookingService> = {
      markBookingPaidById: jest.fn().mockResolvedValue(null),
    };
    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };
    const service = new PaymentService(
      bookingServiceMock as BookingService,
      dbServiceMock as DBService,
    );

    const input: UpdatePaymentStatusInput = {
      paymentId: 'pay_1001',
      status: PaymentStatus.PAID,
      paidAmount: '100.00',
      txHash: '0xabc123',
      confirmations: 20,
      eventId: 'evt_idempotent_1001',
    };

    input.signature = signCallbackInput(input, callbackSecret);

    const firstResult = await service.updatePaymentStatus(input, {
      requireSignature: true,
      source: PaymentEventSource.CALLBACK,
    });
    const secondResult = await service.updatePaymentStatus(input, {
      requireSignature: true,
      source: PaymentEventSource.CALLBACK,
    });

    expect(firstResult.status).toBe(PaymentStatus.PAID);
    expect(secondResult.status).toBe(PaymentStatus.PAID);
    expect(bookingServiceMock.markBookingPaidById).toHaveBeenCalledTimes(1);
    expect(bookingServiceMock.markBookingPaidById).toHaveBeenCalledWith(
      'bk_1001',
    );

    const updatedPayment = store.get('payment:pay_1001') as {
      status: PaymentStatus;
      paidAmount: string;
    };
    expect(updatedPayment.status).toBe(PaymentStatus.PAID);
    expect(updatedPayment.paidAmount).toBe('100.00');
    expect(store.has('payment_event:evt_idempotent_1001')).toBe(true);

    const logged = await service.adminListPaymentEvents({
      eventId: 'evt_idempotent_1001',
    });
    expect(logged.total).toBe(1);
    expect(logged.items[0].actor).toBe('callback_webhook');
  });

  it('skips duplicated admin replay updates within cooldown window', async () => {
    config.payment.REPLAY_COOLDOWN_SECONDS = 300;

    const { db, store } = createInMemoryTravelDB({
      'payment:pay_1001': paymentRecord,
    });

    const bookingServiceMock: Partial<BookingService> = {
      markBookingPaidById: jest.fn().mockResolvedValue(null),
    };
    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };
    const service = new PaymentService(
      bookingServiceMock as BookingService,
      dbServiceMock as DBService,
    );

    const first = await service.updatePaymentStatus(
      {
        paymentId: 'pay_1001',
        status: PaymentStatus.PAID,
        paidAmount: '100.00',
        txHash: '0xreplay',
        confirmations: 12,
        eventId: 'evt_replay_1',
      },
      { source: PaymentEventSource.ADMIN },
    );

    const second = await service.updatePaymentStatus(
      {
        paymentId: 'pay_1001',
        status: PaymentStatus.PAID,
        paidAmount: '100.00',
        txHash: '0xreplay',
        confirmations: 12,
        eventId: 'evt_replay_2',
      },
      { source: PaymentEventSource.ADMIN },
    );

    expect(first.status).toBe(PaymentStatus.PAID);
    expect(second.status).toBe(PaymentStatus.PAID);
    expect(bookingServiceMock.markBookingPaidById).toHaveBeenCalledTimes(1);
    expect(store.has('payment_event:evt_replay_1')).toBe(true);
    expect(store.has('payment_event:evt_replay_2')).toBe(false);

    const events = await service.adminListPaymentEvents({
      paymentId: 'pay_1001',
      source: PaymentEventSource.ADMIN,
    });
    expect(events.total).toBe(1);
    expect(events.items[0].eventId).toBe('evt_replay_1');
  });

  it('lists payment events with filters for admin troubleshooting', async () => {
    const { db } = createInMemoryTravelDB({
      'payment:pay_1001': paymentRecord,
    });

    const bookingServiceMock: Partial<BookingService> = {
      markBookingPaidById: jest.fn().mockResolvedValue(null),
    };
    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };
    const service = new PaymentService(
      bookingServiceMock as BookingService,
      dbServiceMock as DBService,
    );

    await service.updatePaymentStatus(
      {
        paymentId: 'pay_1001',
        status: PaymentStatus.PARTIALLY_PAID,
        paidAmount: '20.00',
        eventId: 'evt_obs_1',
        replayOfEventId: 'evt_origin_1',
      },
      { source: PaymentEventSource.ADMIN },
    );

    await service.updatePaymentStatus(
      {
        paymentId: 'pay_1001',
        status: PaymentStatus.PAID,
        paidAmount: '100.00',
        eventId: 'evt_obs_2',
      },
      { source: PaymentEventSource.SYNC },
    );

    const filtered = await service.adminListPaymentEvents({
      paymentId: 'pay_1001',
      source: PaymentEventSource.SYNC,
      status: PaymentStatus.PAID,
      page: { limit: 10, offset: 0 },
    });
    expect(filtered.total).toBe(1);
    expect(filtered.items[0].eventId).toBe('evt_obs_2');
    expect(filtered.items[0].source).toBe(PaymentEventSource.SYNC);
    expect(filtered.items[0].actor).toBe('sync_job');

    const byEventId = await service.adminListPaymentEvents({
      eventId: 'evt_obs_1',
    });
    expect(byEventId.total).toBe(1);
    expect(byEventId.items[0].status).toBe(PaymentStatus.PARTIALLY_PAID);
    expect(byEventId.items[0].actor).toBe('admin_auth_code');
    expect(byEventId.items[0].replayOfEventId).toBe('evt_origin_1');

    const replayAuditFilter = await service.adminListPaymentEvents({
      actor: 'admin_auth_code',
      replayOfEventId: 'evt_origin_1',
    });
    expect(replayAuditFilter.total).toBe(1);
    expect(replayAuditFilter.items[0].eventId).toBe('evt_obs_1');
  });
});
