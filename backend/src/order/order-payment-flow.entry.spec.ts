import { createHmac } from 'crypto';
import { Global, Module, type INestApplication } from '@nestjs/common';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';
import request from 'supertest';
import { AuthGuard } from '../auth/auth.guard.service';
import { DBService, type PGKVDatabase } from '../common/db.service';
import { config } from '../config';
import { OrderModule } from './order.module';
import { PaymentStatus } from '../payment/dto/payment-status.enum';
import type { UpdatePaymentStatusInput } from '../payment/dto/update-payment-status.input';

jest.mock('../common/db.service', () => ({
  DBService: class DBService {},
  PGKVDatabase: class PGKVDatabase {},
}));

jest.mock('../helpers/sdk', () => ({
  JWTHelper: class JWTHelper {
    verifyToken(token?: string) {
      if (!token) {
        return null;
      }

      return {
        user_id: token,
      };
    }
  },
}));

type SearchJsonOptions = {
  contains?: Record<string, unknown>;
  limit?: number;
  offset?: number;
  include_total?: boolean;
  order_by?: 'ASC' | 'DESC';
  order_by_field?: 'key' | 'created_at' | 'updated_at';
};

type InMemoryRow = {
  value: unknown;
  created_at: Date;
  updated_at: Date;
};

type GraphQLResponse<TData> = {
  data?: TData;
  errors?: Array<{ message?: string }>;
};

type CreateBookingData = {
  createBooking?: {
    id: string;
  };
};

type CreatePaymentData = {
  createUsdtPayment?: {
    id: string;
    expectedAmount: string;
    status: string;
  };
};

type OrderDetailData = {
  orderDetail?: {
    id: string;
    bookingStatus: string;
    paymentStatus: string;
    paymentEvents: Array<{
      eventId: string;
      source: string;
      status: string;
      paidAmount: string;
    }>;
  };
};

type AdminUpdatePaymentData = {
  adminUpdatePaymentStatus?: {
    id: string;
    status: string;
  };
};

function getHttpServer(app: INestApplication): Parameters<typeof request>[0] {
  return app.getHttpServer() as Parameters<typeof request>[0];
}

function createInMemoryTravelDB(): {
  db: PGKVDatabase;
  store: Map<string, InMemoryRow>;
} {
  const store = new Map<string, InMemoryRow>();

  const dbMock = {
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
      total?: number;
      next_cursor: string | null;
    }> {
      const rows = Array.from(store.entries())
        .map(([key, row]) => ({
          key,
          value: row.value,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }))
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
            ([field, expected]) => candidate[field] === expected,
          );
        });

      const orderBy = options.order_by || 'ASC';
      const orderByField = options.order_by_field || 'key';
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

@Global()
@Module({
  providers: [DBService],
  exports: [DBService],
})
class TestGlobalModule {}

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      context: ({ req, res }: { req: Request; res: Response }) => ({
        req,
        res,
      }),
    }),
    TestGlobalModule,
    OrderModule,
  ],
  providers: [AuthGuard],
})
class OrderPaymentFlowEntryTestModule {}

describe('Order/payment flow integration', () => {
  const originalAdminAuthCode = config.auth.ADMIN_AUTH_CODE;
  const originalCallbackSecret = config.payment.CALLBACK_SECRET;
  const originalReplayCooldown = config.payment.REPLAY_COOLDOWN_SECONDS;

  const adminAuthCode = 'test-admin-auth-code';
  const callbackSecret = 'test-callback-secret';
  const userToken = 'user_flow_1001';

  const { db } = createInMemoryTravelDB();
  const dbServiceMock: Partial<DBService> = {
    getDBInstance: jest.fn().mockReturnValue(db),
  };
  let bookingRequestCount = 0;

  let app: INestApplication;

  beforeAll(async () => {
    config.auth.ADMIN_AUTH_CODE = adminAuthCode;
    config.payment.CALLBACK_SECRET = callbackSecret;
    config.payment.REPLAY_COOLDOWN_SECONDS = 0;

    const moduleRef = await Test.createTestingModule({
      imports: [OrderPaymentFlowEntryTestModule],
    })
      .overrideProvider(DBService)
      .useValue(dbServiceMock)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    config.auth.ADMIN_AUTH_CODE = originalAdminAuthCode;
    config.payment.CALLBACK_SECRET = originalCallbackSecret;
    config.payment.REPLAY_COOLDOWN_SECONDS = originalReplayCooldown;
    await app.close();
  });

  async function createBookingForUser(
    server: Parameters<typeof request>[0],
    token: string,
  ): Promise<string> {
    const baseDate = new Date('2026-06-10T00:00:00.000Z');
    baseDate.setUTCDate(baseDate.getUTCDate() + bookingRequestCount * 3);
    const startDate = baseDate.toISOString().slice(0, 10);

    const endDateValue = new Date(baseDate.getTime());
    endDateValue.setUTCDate(endDateValue.getUTCDate() + 2);
    const endDate = endDateValue.toISOString().slice(0, 10);

    bookingRequestCount += 1;

    const response = await request(server)
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({
        query: `
          mutation CreateBooking($input: CreateBookingInput!) {
            createBooking(input: $input) {
              id
            }
          }
        `,
        variables: {
          input: {
            serviceId: 'svc_pkg_beijing_001',
            startDate,
            endDate,
            travelerCount: 1,
          },
        },
      });

    const body = response.body as GraphQLResponse<CreateBookingData>;
    expect(response.status).toBe(200);
    expect(body.errors).toBeUndefined();
    expect(body.data?.createBooking?.id).toBeDefined();

    return body.data?.createBooking?.id || '';
  }

  async function createPaymentForBooking(
    server: Parameters<typeof request>[0],
    token: string,
    bookingId: string,
  ): Promise<{
    paymentId: string;
    expectedAmount: string;
  }> {
    const response = await request(server)
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({
        query: `
          mutation CreateUsdtPayment($input: CreateUsdtPaymentInput!) {
            createUsdtPayment(input: $input) {
              id
              expectedAmount
              status
            }
          }
        `,
        variables: {
          input: {
            bookingId,
          },
        },
      });

    const body = response.body as GraphQLResponse<CreatePaymentData>;
    expect(response.status).toBe(200);
    expect(body.errors).toBeUndefined();
    expect(body.data?.createUsdtPayment?.id).toBeDefined();
    expect(body.data?.createUsdtPayment?.expectedAmount).toBeDefined();

    return {
      paymentId: body.data?.createUsdtPayment?.id || '',
      expectedAmount: body.data?.createUsdtPayment?.expectedAmount || '0.00',
    };
  }

  it('keeps order detail consistent after callback payment update', async () => {
    const server = getHttpServer(app);

    const createBookingResponse = await request(server)
      .post('/graphql')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        query: `
          mutation CreateBooking($input: CreateBookingInput!) {
            createBooking(input: $input) {
              id
            }
          }
        `,
        variables: {
          input: {
            serviceId: 'svc_pkg_beijing_001',
            startDate: '2026-06-01',
            endDate: '2026-06-03',
            travelerCount: 1,
          },
        },
      });

    const bookingBody =
      createBookingResponse.body as GraphQLResponse<CreateBookingData>;
    expect(createBookingResponse.status).toBe(200);
    expect(bookingBody.errors).toBeUndefined();
    const bookingId = bookingBody.data?.createBooking?.id;
    expect(bookingId).toBeDefined();

    const createPaymentResponse = await request(server)
      .post('/graphql')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        query: `
          mutation CreateUsdtPayment($input: CreateUsdtPaymentInput!) {
            createUsdtPayment(input: $input) {
              id
              expectedAmount
              status
            }
          }
        `,
        variables: {
          input: {
            bookingId,
          },
        },
      });

    const paymentBody =
      createPaymentResponse.body as GraphQLResponse<CreatePaymentData>;
    expect(createPaymentResponse.status).toBe(200);
    expect(paymentBody.errors).toBeUndefined();
    const paymentId = paymentBody.data?.createUsdtPayment?.id;
    const expectedAmount = paymentBody.data?.createUsdtPayment?.expectedAmount;
    expect(paymentId).toBeDefined();
    expect(paymentBody.data?.createUsdtPayment?.status).toBe('PENDING');

    const callbackInput: UpdatePaymentStatusInput = {
      paymentId,
      status: PaymentStatus.PAID,
      paidAmount: expectedAmount,
      txHash: '0xflowcallback',
      confirmations: 16,
      eventId: 'evt_order_flow_1',
    };
    callbackInput.signature = signCallbackInput(callbackInput, callbackSecret);

    const callbackResponse = await request(server)
      .post('/payment/callback/usdt')
      .set('admin_auth_code', adminAuthCode)
      .send(callbackInput);

    const callbackBody = callbackResponse.body as { status?: string };
    expect(callbackResponse.status).toBe(201);
    expect(callbackBody.status).toBe('PAID');

    const orderDetailResponse = await request(server)
      .post('/graphql')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        query: `
          query OrderDetail($orderId: String!) {
            orderDetail(orderId: $orderId) {
              id
              bookingStatus
              paymentStatus
              paymentEvents {
                eventId
                source
                status
                paidAmount
              }
            }
          }
        `,
        variables: {
          orderId: bookingId,
        },
      });

    const orderBody =
      orderDetailResponse.body as GraphQLResponse<OrderDetailData>;
    expect(orderDetailResponse.status).toBe(200);
    expect(orderBody.errors).toBeUndefined();
    expect(orderBody.data?.orderDetail?.id).toBe(bookingId);
    expect(orderBody.data?.orderDetail?.bookingStatus).toBe('PAID');
    expect(orderBody.data?.orderDetail?.paymentStatus).toBe('PAID');
    expect(orderBody.data?.orderDetail?.paymentEvents.length).toBeGreaterThan(
      0,
    );
    expect(orderBody.data?.orderDetail?.paymentEvents[0]?.eventId).toBe(
      'evt_order_flow_1',
    );
    expect(orderBody.data?.orderDetail?.paymentEvents[0]?.source).toBe(
      'CALLBACK',
    );
  });

  it('rejects order detail access from another user', async () => {
    const server = getHttpServer(app);
    const bookingId = await createBookingForUser(server, userToken);

    const forbiddenResponse = await request(server)
      .post('/graphql')
      .set('Authorization', 'Bearer user_flow_forbidden')
      .send({
        query: `
          query OrderDetail($orderId: String!) {
            orderDetail(orderId: $orderId) {
              id
            }
          }
        `,
        variables: {
          orderId: bookingId,
        },
      });

    const forbiddenBody =
      forbiddenResponse.body as GraphQLResponse<OrderDetailData>;
    expect(forbiddenResponse.status).toBe(200);
    expect(forbiddenBody.errors?.[0]?.message).toContain(
      'Booking access denied',
    );
  });

  it('returns EXPIRED payment status for expired order flow', async () => {
    const server = getHttpServer(app);
    const bookingId = await createBookingForUser(server, userToken);
    const { paymentId } = await createPaymentForBooking(
      server,
      userToken,
      bookingId,
    );

    const markExpiredResponse = await request(server)
      .post('/graphql')
      .set('admin_auth_code', adminAuthCode)
      .send({
        query: `
          mutation AdminExpirePayment($input: UpdatePaymentStatusInput!) {
            adminUpdatePaymentStatus(input: $input) {
              id
              status
            }
          }
        `,
        variables: {
          input: {
            paymentId,
            status: 'EXPIRED',
            paidAmount: '0.00',
            eventId: 'evt_order_expired_1',
          },
        },
      });

    const markExpiredBody =
      markExpiredResponse.body as GraphQLResponse<AdminUpdatePaymentData>;
    expect(markExpiredResponse.status).toBe(200);
    expect(markExpiredBody.errors).toBeUndefined();
    expect(markExpiredBody.data?.adminUpdatePaymentStatus?.status).toBe(
      'EXPIRED',
    );

    const orderDetailResponse = await request(server)
      .post('/graphql')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        query: `
          query OrderDetail($orderId: String!) {
            orderDetail(orderId: $orderId) {
              id
              bookingStatus
              paymentStatus
              paymentEvents {
                eventId
                source
                status
              }
            }
          }
        `,
        variables: {
          orderId: bookingId,
        },
      });

    const orderBody =
      orderDetailResponse.body as GraphQLResponse<OrderDetailData>;
    expect(orderDetailResponse.status).toBe(200);
    expect(orderBody.errors).toBeUndefined();
    expect(orderBody.data?.orderDetail?.paymentStatus).toBe('EXPIRED');
    expect(orderBody.data?.orderDetail?.paymentEvents[0]?.eventId).toBe(
      'evt_order_expired_1',
    );
    expect(orderBody.data?.orderDetail?.paymentEvents[0]?.source).toBe('ADMIN');
  });
});
