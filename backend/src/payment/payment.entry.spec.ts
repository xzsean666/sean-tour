import { createHmac } from 'crypto';
import { Global, Module, type INestApplication } from '@nestjs/common';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import type { Request, Response } from 'express';
import request from 'supertest';
import { AuthModule } from '../auth/auth.module';
import { BookingService } from '../booking/booking.service';
import { DBService, type PGKVDatabase } from '../common/db.service';
import { config } from '../config';
import { PaymentController } from './payment.controller';
import { PaymentStatus } from './dto/payment-status.enum';
import type { UpdatePaymentStatusInput } from './dto/update-payment-status.input';
import { PaymentResolver } from './payment.resolver';
import { PaymentService } from './payment.service';

jest.mock('../helpers/sdk', () => ({
  JWTHelper: class JWTHelper {
    verifyToken(token?: string) {
      if (token === 'admin-user-token') {
        return {
          user_id: 'admin_user_1',
          email: 'admin@example.com',
        };
      }

      return { user_id: 'test_user' };
    }
  },
}));

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
  include_total?: boolean;
  order_by?: 'ASC' | 'DESC';
  order_by_field?: 'key' | 'created_at' | 'updated_at';
};

type InMemoryRow = {
  value: unknown;
  created_at: Date;
  updated_at: Date;
};

type GraphQLErrorResponse = {
  errors?: Array<{ message?: string }>;
};

type GraphQLUpdatePaymentResponse = GraphQLErrorResponse & {
  data?: {
    adminUpdatePaymentStatus?: {
      id: string;
      bookingId: string;
      status: string;
      paidAmount: string;
      confirmations: number;
    };
  };
};

type GraphQLEventQueryResponse = GraphQLErrorResponse & {
  data?: {
    adminPaymentEvents?: {
      total: number;
      items: Array<{
        eventId: string;
        source: string;
        status?: string;
      }>;
    };
  };
};

function firstGraphQLErrorMessage(
  body: GraphQLErrorResponse,
): string | undefined {
  return body.errors?.[0]?.message;
}

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

function buildPaymentRecord(params: {
  id: string;
  bookingId: string;
  userId?: string;
  expectedAmount?: string;
}): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    entityType: 'PAYMENT',
    id: params.id,
    bookingId: params.bookingId,
    userId: params.userId || 'test_user',
    token: 'USDT',
    network: 'BSC',
    tokenStandard: 'ERC20',
    expectedAmount: params.expectedAmount || '100.00',
    paidAmount: '0.00',
    payAddress: '0x0000000000000000000000000000000000BEEF',
    txHash: undefined,
    confirmations: 0,
    status: PaymentStatus.PENDING,
    expiredAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    createdAt: now,
    updatedAt: now,
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
    TestGlobalModule,
    AuthModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      context: ({ req, res }: { req: Request; res: Response }) => ({
        req,
        res,
      }),
    }),
  ],
  controllers: [PaymentController],
  providers: [PaymentResolver, PaymentService, BookingService],
})
class PaymentEntryTestModule {}

describe('Payment entry integration (GraphQL + REST)', () => {
  const originalAdminAuthCode = config.auth.ADMIN_AUTH_CODE;
  const originalAdminUserIds = config.auth.ADMIN_USER_IDS;
  const originalCallbackSecret = config.payment.CALLBACK_SECRET;
  const originalReplayCooldown = config.payment.REPLAY_COOLDOWN_SECONDS;

  const adminAuthCode = 'test-admin-auth-code';
  const callbackSecret = 'test-callback-secret';

  const { db, store } = createInMemoryTravelDB();
  const bookingServiceMock: Partial<BookingService> = {
    getBookingByIdForUser: jest.fn(),
    markBookingPaidById: jest.fn().mockResolvedValue(null),
  };
  const dbServiceMock: Partial<DBService> = {
    getDBInstance: jest.fn().mockReturnValue(db),
  };

  let app: INestApplication;

  beforeAll(async () => {
    config.auth.ADMIN_AUTH_CODE = adminAuthCode;
    config.auth.ADMIN_USER_IDS = '';
    config.payment.CALLBACK_SECRET = callbackSecret;
    config.payment.REPLAY_COOLDOWN_SECONDS = 0;

    const moduleRef = await Test.createTestingModule({
      imports: [PaymentEntryTestModule],
    })
      .overrideProvider(BookingService)
      .useValue(bookingServiceMock)
      .overrideProvider(DBService)
      .useValue(dbServiceMock)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    store.clear();
    store.set('admin_access:user:admin_user_1', {
      value: {
        entityType: 'ADMIN_ACCESS',
        id: 'user:admin_user_1',
        principalType: 'USER_ID',
        principalValue: 'admin_user_1',
        userId: 'admin_user_1',
        enabled: true,
        grantedBy: 'admin_auth_code',
        updatedBy: 'admin_auth_code',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      created_at: new Date(),
      updated_at: new Date(),
    });
    store.set('payment:pay_gql_1', {
      value: buildPaymentRecord({
        id: 'pay_gql_1',
        bookingId: 'bk_gql_1',
      }),
      created_at: new Date(),
      updated_at: new Date(),
    });
    store.set('payment:pay_rest_1', {
      value: buildPaymentRecord({
        id: 'pay_rest_1',
        bookingId: 'bk_rest_1',
        expectedAmount: '88.00',
      }),
      created_at: new Date(),
      updated_at: new Date(),
    });
    (bookingServiceMock.markBookingPaidById as jest.Mock).mockClear();
  });

  afterAll(async () => {
    config.auth.ADMIN_AUTH_CODE = originalAdminAuthCode;
    config.auth.ADMIN_USER_IDS = originalAdminUserIds;
    config.payment.CALLBACK_SECRET = originalCallbackSecret;
    config.payment.REPLAY_COOLDOWN_SECONDS = originalReplayCooldown;
    await app.close();
  });

  it('updates payment through GraphQL admin mutation and exposes event query', async () => {
    const server = getHttpServer(app);

    const updateResponse = await request(server)
      .post('/graphql')
      .set('Authorization', 'Bearer admin-user-token')
      .send({
        query: `
          mutation UpdatePayment($input: UpdatePaymentStatusInput!) {
            adminUpdatePaymentStatus(input: $input) {
              id
              bookingId
              status
              paidAmount
              confirmations
            }
          }
        `,
        variables: {
          input: {
            paymentId: 'pay_gql_1',
            status: 'PAID',
            paidAmount: '100.00',
            confirmations: 18,
            eventId: 'evt_gql_entry_1',
          },
        },
      });

    const updateBody = updateResponse.body as GraphQLUpdatePaymentResponse;
    expect(updateResponse.status).toBe(200);
    expect(updateBody.errors).toBeUndefined();
    expect(updateBody.data?.adminUpdatePaymentStatus?.status).toBe('PAID');
    expect(bookingServiceMock.markBookingPaidById).toHaveBeenCalledTimes(1);
    expect(bookingServiceMock.markBookingPaidById).toHaveBeenCalledWith(
      'bk_gql_1',
    );

    const queryResponse = await request(server)
      .post('/graphql')
      .set('Authorization', 'Bearer admin-user-token')
      .send({
        query: `
          query Events($input: PaymentEventListInput) {
            adminPaymentEvents(input: $input) {
              total
              items {
                eventId
                source
                status
              }
            }
          }
        `,
        variables: {
          input: {
            eventId: 'evt_gql_entry_1',
          },
        },
      });

    const queryBody = queryResponse.body as GraphQLEventQueryResponse;
    expect(queryResponse.status).toBe(200);
    expect(queryBody.errors).toBeUndefined();
    expect(queryBody.data?.adminPaymentEvents?.total).toBe(1);
    expect(queryBody.data?.adminPaymentEvents?.items[0]?.source).toBe('ADMIN');
    expect(queryBody.data?.adminPaymentEvents?.items[0]?.status).toBe('PAID');
  });

  it('allows GraphQL admin mutation with bearer token for configured admin user', async () => {
    const server = getHttpServer(app);

    const response = await request(server)
      .post('/graphql')
      .set('Authorization', 'Bearer admin-user-token')
      .send({
        query: `
          mutation UpdatePayment($input: UpdatePaymentStatusInput!) {
            adminUpdatePaymentStatus(input: $input) {
              id
              bookingId
              status
            }
          }
        `,
        variables: {
          input: {
            paymentId: 'pay_gql_1',
            status: 'PAID',
            paidAmount: '100.00',
            confirmations: 9,
            eventId: 'evt_gql_admin_token',
          },
        },
      });

    const body = response.body as GraphQLUpdatePaymentResponse;
    expect(response.status).toBe(200);
    expect(body.errors).toBeUndefined();
    expect(body.data?.adminUpdatePaymentStatus?.status).toBe('PAID');
    expect(
      (
        store.get('payment_event:evt_gql_admin_token')?.value as
          | { actor?: string }
          | undefined
      )?.actor,
    ).toBe('admin:admin_user_1');
  });

  it('rejects GraphQL admin mutation when only admin auth code is provided', async () => {
    const server = getHttpServer(app);

    const response = await request(server)
      .post('/graphql')
      .set('admin_auth_code', adminAuthCode)
      .send({
        query: `
          mutation UpdatePayment($input: UpdatePaymentStatusInput!) {
            adminUpdatePaymentStatus(input: $input) {
              id
            }
          }
        `,
        variables: {
          input: {
            paymentId: 'pay_gql_1',
            status: 'PAID',
            paidAmount: '100.00',
            eventId: 'evt_gql_forbidden_1',
          },
        },
      });

    const body = response.body as GraphQLErrorResponse;
    expect(response.status).toBe(200);
    expect(firstGraphQLErrorMessage(body)).toContain(
      'Unauthorized: Invalid Admin Auth Code',
    );
    expect(store.has('payment_event:evt_gql_forbidden_1')).toBe(false);
  });

  it('accepts signed REST callback and keeps event idempotent', async () => {
    const server = getHttpServer(app);
    const callbackInput: UpdatePaymentStatusInput = {
      paymentId: 'pay_rest_1',
      status: PaymentStatus.PAID,
      paidAmount: '88.00',
      txHash: '0xrestentry',
      confirmations: 12,
      eventId: 'evt_rest_entry_1',
    };
    callbackInput.signature = signCallbackInput(callbackInput, callbackSecret);

    const first = await request(server)
      .post('/payment/callback/usdt')
      .set('admin_auth_code', adminAuthCode)
      .send(callbackInput);

    const second = await request(server)
      .post('/payment/callback/usdt')
      .set('admin_auth_code', adminAuthCode)
      .send(callbackInput);

    const firstBody = first.body as { status?: string };
    const secondBody = second.body as { status?: string };
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(firstBody.status).toBe('PAID');
    expect(secondBody.status).toBe('PAID');
    expect(bookingServiceMock.markBookingPaidById).toHaveBeenCalledTimes(1);
    expect(store.has('payment_event:evt_rest_entry_1')).toBe(true);

    const queryResponse = await request(server)
      .post('/graphql')
      .set('Authorization', 'Bearer admin-user-token')
      .send({
        query: `
          query Events($input: PaymentEventListInput) {
            adminPaymentEvents(input: $input) {
              total
              items {
                eventId
                source
              }
            }
          }
        `,
        variables: {
          input: {
            eventId: 'evt_rest_entry_1',
          },
        },
      });

    const queryBody = queryResponse.body as GraphQLEventQueryResponse;
    expect(queryResponse.status).toBe(200);
    expect(queryBody.errors).toBeUndefined();
    expect(queryBody.data?.adminPaymentEvents?.total).toBe(1);
    expect(queryBody.data?.adminPaymentEvents?.items[0]?.source).toBe(
      'CALLBACK',
    );
  });

  it('rejects REST callback when signature is invalid', async () => {
    const server = getHttpServer(app);
    const callbackInput: UpdatePaymentStatusInput = {
      paymentId: 'pay_rest_1',
      status: PaymentStatus.PAID,
      paidAmount: '88.00',
      txHash: '0xrestentry_invalid',
      confirmations: 6,
      eventId: 'evt_rest_invalid_sig',
      signature: 'bad-signature',
    };

    const response = await request(server)
      .post('/payment/callback/usdt')
      .set('admin_auth_code', adminAuthCode)
      .send(callbackInput);

    const body = response.body as {
      message?: string | string[];
    };
    expect(response.status).toBe(400);

    const message = Array.isArray(body.message)
      ? body.message.join(' | ')
      : body.message || '';
    expect(message).toContain('Invalid callback signature');
    expect(store.has('payment_event:evt_rest_invalid_sig')).toBe(false);
    expect(bookingServiceMock.markBookingPaidById).not.toHaveBeenCalled();
  });
});
