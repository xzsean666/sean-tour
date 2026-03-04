import { requestBackendGraphQL } from "./backendGraphqlClient";

export type ServiceType = "PACKAGE" | "GUIDE" | "CAR" | "ASSISTANT";
export type BookingStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "CONFIRMED"
  | "IN_SERVICE"
  | "COMPLETED"
  | "CANCELED"
  | "REFUNDING"
  | "REFUNDED";

type PaymentStatus =
  | "PENDING"
  | "PARTIALLY_PAID"
  | "PAID"
  | "UNDERPAID"
  | "EXPIRED"
  | "REFUNDING"
  | "REFUNDED";

export interface ServiceItem {
  id: string;
  type: ServiceType;
  title: string;
  city: string;
  description: string;
  languages: string[];
  priceAmount: number;
  currency: "USDT";
}

export interface ServicePage {
  items: ServiceItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface CheckoutPreview {
  bookingId: string;
  serviceTitle: string;
  travelerCount: number;
  travelDateRange: string;
  expectedAmount: string;
  currency: "USDT";
  network: "BSC";
  tokenStandard: "ERC20";
  payAddress: string;
  paymentStatus: "PENDING" | "PAID" | "EXPIRED";
  expiresInMinutes: number;
}

export interface OrderItem {
  id: string;
  bookingId: string;
  serviceTitle: string;
  city: string;
  bookingStatus: BookingStatus;
  paymentStatus: "PENDING" | "PAID" | "EXPIRED";
  expectedAmount: string;
  createdAt: string;
  paymentEvents: PaymentEvent[];
}

export interface PaymentEvent {
  eventId: string;
  source: string;
  status: PaymentStatus;
  paidAmount: string;
  txHash?: string;
  confirmations: number;
  createdAt: string;
}

export interface OrderPage {
  items: OrderItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

type ServiceListGraphQL = {
  serviceList: {
    items: Array<{
      id: string;
      type: ServiceType;
      title: string;
      city: string;
      description: string;
      languages: string[];
      basePrice: {
        amount: number;
        currency: "USDT";
      };
    }>;
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};

type BookingDetailGraphQL = {
  bookingDetail: {
    id: string;
    serviceSnapshot: {
      title: string;
      city: string;
      basePrice: {
        amount: number;
        currency: "USDT";
      };
    };
    travelerCount: number;
    status: BookingStatus;
    startDate: string;
    endDate: string;
    createdAt: string;
  };
};

type PaymentByBookingGraphQL = {
  paymentByBooking: {
    expectedAmount: string;
    paidAmount: string;
    payAddress: string;
    network: "BSC";
    tokenStandard: "ERC20";
    status: PaymentStatus;
    expiredAt: string;
  } | null;
};

type CreateUsdtPaymentGraphQL = {
  createUsdtPayment: {
    expectedAmount: string;
    paidAmount: string;
    payAddress: string;
    network: "BSC";
    tokenStandard: "ERC20";
    status: PaymentStatus;
    expiredAt: string;
  };
};

type CreateBookingGraphQL = {
  createBooking: {
    id: string;
  };
};

type MyOrdersGraphQL = {
  myOrders: {
    items: Array<{
      id: string;
      bookingId: string;
      serviceTitle: string;
      city: string;
      bookingStatus: BookingStatus;
      paymentStatus: "PENDING" | "PAID" | "EXPIRED";
      expectedAmount: string;
      createdAt: string;
    }>;
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};

type OrderDetailGraphQL = {
  orderDetail: {
    id: string;
    bookingId: string;
    serviceTitle: string;
    city: string;
    bookingStatus: BookingStatus;
      paymentStatus: "PENDING" | "PAID" | "EXPIRED";
      expectedAmount: string;
      createdAt: string;
      paymentEvents: Array<{
        eventId: string;
        source: string;
        status: PaymentStatus;
        paidAmount: string;
        txHash?: string;
        confirmations: number;
        createdAt: string;
      }>;
    };
};

function asError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === "string") {
    return new Error(error);
  }

  return new Error("Unexpected travel service error.");
}

function toExpectedAmount(amount: number, travelerCount: number): string {
  return (amount * travelerCount).toFixed(2);
}

function toCheckoutPaymentStatus(
  status: PaymentStatus,
): "PENDING" | "PAID" | "EXPIRED" {
  if (status === "PAID") {
    return "PAID";
  }

  if (status === "EXPIRED") {
    return "EXPIRED";
  }

  return "PENDING";
}

function toFallbackPaymentStatus(
  bookingStatus: BookingStatus,
): "PENDING" | "PAID" | "EXPIRED" {
  if (
    bookingStatus === "PAID" ||
    bookingStatus === "CONFIRMED" ||
    bookingStatus === "IN_SERVICE" ||
    bookingStatus === "COMPLETED" ||
    bookingStatus === "REFUNDING" ||
    bookingStatus === "REFUNDED"
  ) {
    return "PAID";
  }

  if (bookingStatus === "CANCELED") {
    return "EXPIRED";
  }

  return "PENDING";
}

export const travelService = {
  async getServiceList(params?: {
    type?: ServiceType;
    city?: string;
    language?: string;
    limit?: number;
    offset?: number;
  }): Promise<ServicePage> {
    const limit = Math.min(Math.max(params?.limit ?? 12, 1), 50);
    const offset = Math.max(params?.offset ?? 0, 0);

    const data = await requestBackendGraphQL<ServiceListGraphQL>({
      query: `
        query ServiceList($input: ServiceListInput) {
          serviceList(input: $input) {
            items {
              id
              type
              title
              city
              description
              languages
              basePrice {
                amount
                currency
              }
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
          ...(params?.type ? { type: params.type } : {}),
          ...(params?.city ? { city: params.city } : {}),
          ...(params?.language ? { language: params.language } : {}),
          page: {
            limit,
            offset,
          },
        },
      },
    });

    return {
      items: data.serviceList.items.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        city: item.city,
        description: item.description,
        languages: item.languages,
        priceAmount: item.basePrice.amount,
        currency: item.basePrice.currency,
      })),
      total: data.serviceList.total,
      limit: data.serviceList.limit,
      offset: data.serviceList.offset,
      hasMore: data.serviceList.hasMore,
    };
  },

  async createBooking(input: {
    serviceId: string;
    startDate: string;
    endDate: string;
    travelerCount: number;
  }): Promise<{ bookingId: string }> {
    const data = await requestBackendGraphQL<CreateBookingGraphQL>({
      query: `
        mutation CreateBooking($input: CreateBookingInput!) {
          createBooking(input: $input) {
            id
          }
        }
      `,
      variables: {
        input,
      },
    });

    return {
      bookingId: data.createBooking.id,
    };
  },

  async getCheckoutPreview(bookingId: string): Promise<CheckoutPreview> {
    try {
      const bookingData = await requestBackendGraphQL<BookingDetailGraphQL>({
        query: `
          query BookingDetail($bookingId: String!) {
            bookingDetail(bookingId: $bookingId) {
              id
              serviceSnapshot {
                title
                city
                basePrice {
                  amount
                  currency
                }
              }
              travelerCount
              status
              startDate
              endDate
              createdAt
            }
          }
        `,
        variables: {
          bookingId,
        },
      });

      const booking = bookingData.bookingDetail;
      const fallbackPreview: CheckoutPreview = {
        bookingId: booking.id,
        serviceTitle: booking.serviceSnapshot.title,
        travelerCount: booking.travelerCount,
        travelDateRange: `${booking.startDate} to ${booking.endDate}`,
        expectedAmount: toExpectedAmount(
          booking.serviceSnapshot.basePrice.amount,
          booking.travelerCount,
        ),
        currency: booking.serviceSnapshot.basePrice.currency,
        network: "BSC",
        tokenStandard: "ERC20",
        payAddress: "-",
        paymentStatus: toFallbackPaymentStatus(booking.status),
        expiresInMinutes: 0,
      };

      const paymentData = await requestBackendGraphQL<PaymentByBookingGraphQL>({
        query: `
          query PaymentByBooking($bookingId: String!) {
            paymentByBooking(bookingId: $bookingId) {
              expectedAmount
              paidAmount
              payAddress
              network
              tokenStandard
              status
              expiredAt
            }
          }
        `,
        variables: {
          bookingId,
        },
      });

      let payment = paymentData.paymentByBooking;

      if (!payment && booking.status === "PENDING_PAYMENT") {
        const createPaymentData =
          await requestBackendGraphQL<CreateUsdtPaymentGraphQL>({
            query: `
              mutation CreateUsdtPayment($input: CreateUsdtPaymentInput!) {
                createUsdtPayment(input: $input) {
                  expectedAmount
                  paidAmount
                  payAddress
                  network
                  tokenStandard
                  status
                  expiredAt
                }
              }
            `,
            variables: {
              input: {
                bookingId,
              },
            },
          });

        payment = createPaymentData.createUsdtPayment;
      }

      if (!payment) {
        return fallbackPreview;
      }

      const expiresInMinutes = Math.max(
        0,
        Math.ceil((new Date(payment.expiredAt).getTime() - Date.now()) / 60000),
      );

      return {
        ...fallbackPreview,
        expectedAmount: payment.expectedAmount,
        network: payment.network,
        tokenStandard: payment.tokenStandard,
        payAddress: payment.payAddress,
        paymentStatus: toCheckoutPaymentStatus(payment.status),
        expiresInMinutes,
      };
    } catch (error) {
      throw asError(error);
    }
  },

  async getMyOrders(params?: {
    bookingStatus?: BookingStatus;
    limit?: number;
    offset?: number;
  }): Promise<OrderPage> {
    try {
      const limit = Math.min(Math.max(params?.limit ?? 10, 1), 50);
      const offset = Math.max(params?.offset ?? 0, 0);

      const data = await requestBackendGraphQL<MyOrdersGraphQL>({
        query: `
          query MyOrders($input: OrderListInput) {
            myOrders(input: $input) {
              items {
                id
                bookingId
                serviceTitle
                city
                bookingStatus
                paymentStatus
                expectedAmount
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
            ...(params?.bookingStatus
              ? { bookingStatus: params.bookingStatus }
              : {}),
            page: {
              limit,
              offset,
            },
          },
        },
      });

      return {
        items: data.myOrders.items.map((item) => ({
          ...item,
          paymentEvents: [],
        })),
        total: data.myOrders.total,
        limit: data.myOrders.limit,
        offset: data.myOrders.offset,
        hasMore: data.myOrders.hasMore,
      };
    } catch (error) {
      throw asError(error);
    }
  },

  async getOrderDetail(orderId: string): Promise<OrderItem | null> {
    try {
      const data = await requestBackendGraphQL<OrderDetailGraphQL>({
        query: `
          query OrderDetail($orderId: String!) {
            orderDetail(orderId: $orderId) {
              id
              bookingId
              serviceTitle
              city
              bookingStatus
              paymentStatus
              expectedAmount
              createdAt
              paymentEvents {
                eventId
                source
                status
                paidAmount
                txHash
                confirmations
                createdAt
              }
            }
          }
        `,
        variables: {
          orderId,
        },
      });

      return data.orderDetail;
    } catch {
      return null;
    }
  },
};
