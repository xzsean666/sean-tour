import { requestBackendGraphQL } from "./backendGraphqlClient";

export type PaymentEventSource = "ADMIN" | "CALLBACK" | "SYNC";
export type PaymentStatus =
  | "PENDING"
  | "PARTIALLY_PAID"
  | "PAID"
  | "UNDERPAID"
  | "EXPIRED"
  | "REFUNDING"
  | "REFUNDED";

export interface PaymentEventItem {
  eventId: string;
  paymentId: string;
  bookingId: string;
  source: PaymentEventSource;
  status: PaymentStatus;
  paidAmount: string;
  txHash?: string;
  confirmations: number;
  actor: string;
  replayOfEventId?: string;
  createdAt: string;
}

export interface AdminUpdatePaymentStatusInput {
  paymentId?: string;
  bookingId?: string;
  status?: PaymentStatus;
  paidAmount?: string;
  txHash?: string;
  confirmations?: number;
  eventId?: string;
  replayOfEventId?: string;
}

type AdminPaymentEventsGraphQL = {
  adminPaymentEvents: {
    items: PaymentEventItem[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};

type AdminUpdatePaymentStatusGraphQL = {
  adminUpdatePaymentStatus: {
    id: string;
    bookingId: string;
    status: PaymentStatus;
    paidAmount: string;
    txHash?: string;
    confirmations: number;
    updatedAt: string;
  };
};

export const adminPaymentService = {
  async listPaymentEvents(params?: {
    eventId?: string;
    paymentId?: string;
    bookingId?: string;
    actor?: string;
    replayOfEventId?: string;
    source?: PaymentEventSource;
    status?: PaymentStatus;
    limit?: number;
    offset?: number;
  }): Promise<{
    items: PaymentEventItem[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  }> {
    const limit = Math.min(Math.max(params?.limit ?? 50, 1), 100);
    const offset = Math.max(params?.offset ?? 0, 0);

    const data = await requestBackendGraphQL<AdminPaymentEventsGraphQL>({
      query: `
        query AdminPaymentEvents($input: PaymentEventListInput) {
          adminPaymentEvents(input: $input) {
            items {
              eventId
              paymentId
              bookingId
              source
              status
              paidAmount
              txHash
              confirmations
              actor
              replayOfEventId
              createdAt
            }
            total
            limit
            offset
            hasMore
          }
        }
      `,
      variables: {
        input: {
          ...(params?.eventId ? { eventId: params.eventId } : {}),
          ...(params?.paymentId ? { paymentId: params.paymentId } : {}),
          ...(params?.bookingId ? { bookingId: params.bookingId } : {}),
          ...(params?.actor ? { actor: params.actor } : {}),
          ...(params?.replayOfEventId
            ? { replayOfEventId: params.replayOfEventId }
            : {}),
          ...(params?.source ? { source: params.source } : {}),
          ...(params?.status ? { status: params.status } : {}),
          page: {
            limit,
            offset,
          },
        },
      },
    });

    return data.adminPaymentEvents;
  },

  async updatePaymentStatus(input: AdminUpdatePaymentStatusInput): Promise<{
    id: string;
    bookingId: string;
    status: PaymentStatus;
    paidAmount: string;
    txHash?: string;
    confirmations: number;
    updatedAt: string;
  }> {
    const data = await requestBackendGraphQL<AdminUpdatePaymentStatusGraphQL>({
      query: `
        mutation AdminUpdatePaymentStatus($input: UpdatePaymentStatusInput!) {
          adminUpdatePaymentStatus(input: $input) {
            id
            bookingId
            status
            paidAmount
            txHash
            confirmations
            updatedAt
          }
        }
      `,
      variables: {
        input,
      },
    });

    return data.adminUpdatePaymentStatus;
  },
};
