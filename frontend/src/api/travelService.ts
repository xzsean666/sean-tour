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
export type PaymentStatus =
  | "PENDING"
  | "PARTIALLY_PAID"
  | "PAID"
  | "UNDERPAID"
  | "EXPIRED"
  | "REFUNDING"
  | "REFUNDED";

export interface ServiceCapacity {
  min: number;
  max: number;
  remaining: number;
}

export interface ServiceContact {
  name: string;
  channel: string;
  value: string;
}

export interface ServiceResource {
  id: string;
  label: string;
  status: string;
  languages: string[];
  seats?: number;
  availableTimeSlots: string[];
}

export interface ServiceItem {
  id: string;
  type: ServiceType;
  title: string;
  city: string;
  description: string;
  languages: string[];
  images: string[];
  priceAmount: number;
  currency: "USDT";
  cancellationPolicy?: string;
  availableTimeSlots: string[];
  capacity?: ServiceCapacity;
  supportContact?: ServiceContact;
  resources: ServiceResource[];
  voucherTemplate?: string;
}

export type ServiceDetailVariant =
  | {
      type: "PACKAGE";
      durationDays: number;
      itinerary: string[];
    }
  | {
      type: "GUIDE";
      languages: string[];
      yearsOfExperience: number;
      certifications: string[];
    }
  | {
      type: "CAR";
      seats: number;
      carType: string;
      luggageCapacity?: string;
    }
  | {
      type: "ASSISTANT";
      supportChannels: string[];
      serviceHours: string;
    };

export type ServiceDetail = ServiceItem & {
  status: string;
  detail: ServiceDetailVariant;
};

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
  timeSlot?: string;
  expectedAmount: string;
  currency: "USDT";
  network: "BSC";
  tokenStandard: "ERC20";
  payAddress: string;
  paymentStatus: PaymentStatus;
  expiresInMinutes: number;
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

export interface OrderItem {
  id: string;
  bookingId: string;
  serviceId: string;
  userId: string;
  serviceTitle: string;
  city: string;
  bookingStatus: BookingStatus;
  paymentStatus: PaymentStatus;
  expectedAmount: string;
  startDate: string;
  endDate: string;
  timeSlot?: string;
  assignedResourceId?: string;
  assignedResourceLabel?: string;
  cancellationPolicy?: string;
  supportContact?: ServiceContact;
  serviceVoucherCode?: string;
  serviceVoucherInstructions?: string;
  createdAt: string;
  paymentEvents: PaymentEvent[];
}

export interface OrderPage {
  items: OrderItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

type ServiceItemGraphQL = {
  id: string;
  type: ServiceType;
  title: string;
  city: string;
  description: string;
  status: string;
  languages: string[];
  images: string[];
  basePrice: {
    amount: number;
    currency: "USDT";
  };
  cancellationPolicy?: string;
  availableTimeSlots: string[];
  capacity?: ServiceCapacity;
  supportContact?: ServiceContact;
  resources: ServiceResource[];
  voucherTemplate?: string;
};

type ServiceListGraphQL = {
  serviceList: {
    items: ServiceItemGraphQL[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};

type ServiceItemDetailGraphQL = {
  serviceItem: ServiceItemGraphQL;
};

type ServiceDetailUnionGraphQL = {
  serviceDetail:
    | {
        __typename: "PackageServiceDetail";
        durationDays: number;
        itinerary: string[];
      }
    | {
        __typename: "GuideServiceDetail";
        languages: string[];
        yearsOfExperience: number;
        certifications: string[];
      }
    | {
        __typename: "CarServiceDetail";
        seats: number;
        carType: string;
        luggageCapacity?: string;
      }
    | {
        __typename: "AssistantServiceDetail";
        supportChannels: string[];
        serviceHours: string;
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
    timeSlot?: string;
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
      serviceId: string;
      userId: string;
      serviceTitle: string;
      city: string;
      bookingStatus: BookingStatus;
      paymentStatus: PaymentStatus;
      expectedAmount: string;
      startDate: string;
      endDate: string;
      timeSlot?: string;
      assignedResourceId?: string;
      assignedResourceLabel?: string;
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
    serviceId: string;
    userId: string;
    serviceTitle: string;
    city: string;
    bookingStatus: BookingStatus;
    paymentStatus: PaymentStatus;
    expectedAmount: string;
    startDate: string;
    endDate: string;
    timeSlot?: string;
    assignedResourceId?: string;
    assignedResourceLabel?: string;
    cancellationPolicy?: string;
    supportContact?: ServiceContact;
    serviceVoucherCode?: string;
    serviceVoucherInstructions?: string;
    createdAt: string;
    paymentEvents: PaymentEvent[];
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

function toServiceItem(item: ServiceItemGraphQL): ServiceItem {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    city: item.city,
    description: item.description,
    languages: item.languages || [],
    images: item.images || [],
    priceAmount: item.basePrice.amount,
    currency: item.basePrice.currency,
    cancellationPolicy: item.cancellationPolicy,
    availableTimeSlots: item.availableTimeSlots || [],
    capacity: item.capacity,
    supportContact: item.supportContact,
    resources: item.resources || [],
    voucherTemplate: item.voucherTemplate,
  };
}

function toServiceDetailVariant(
  payload: ServiceDetailUnionGraphQL["serviceDetail"],
): ServiceDetailVariant {
  if (payload.__typename === "PackageServiceDetail") {
    return {
      type: "PACKAGE",
      durationDays: payload.durationDays,
      itinerary: payload.itinerary,
    };
  }

  if (payload.__typename === "GuideServiceDetail") {
    return {
      type: "GUIDE",
      languages: payload.languages,
      yearsOfExperience: payload.yearsOfExperience,
      certifications: payload.certifications,
    };
  }

  if (payload.__typename === "CarServiceDetail") {
    return {
      type: "CAR",
      seats: payload.seats,
      carType: payload.carType,
      luggageCapacity: payload.luggageCapacity,
    };
  }

  return {
    type: "ASSISTANT",
    supportChannels: payload.supportChannels,
    serviceHours: payload.serviceHours,
  };
}

function toExpectedAmount(amount: number, travelerCount: number): string {
  return (amount * travelerCount).toFixed(2);
}

function toFallbackPaymentStatus(bookingStatus: BookingStatus): PaymentStatus {
  if (
    bookingStatus === "PAID" ||
    bookingStatus === "CONFIRMED" ||
    bookingStatus === "IN_SERVICE" ||
    bookingStatus === "COMPLETED"
  ) {
    return "PAID";
  }

  if (bookingStatus === "REFUNDING") {
    return "REFUNDING";
  }

  if (bookingStatus === "REFUNDED") {
    return "REFUNDED";
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
    date?: string;
    minPriceAmount?: number;
    maxPriceAmount?: number;
    status?: string;
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
              status
              languages
              images
              cancellationPolicy
              availableTimeSlots
              voucherTemplate
              capacity {
                min
                max
                remaining
              }
              supportContact {
                name
                channel
                value
              }
              resources {
                id
                label
                status
                languages
                seats
                availableTimeSlots
              }
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
          ...(params?.date ? { date: params.date } : {}),
          ...(params?.minPriceAmount !== undefined
            ? { minPriceAmount: params.minPriceAmount }
            : {}),
          ...(params?.maxPriceAmount !== undefined
            ? { maxPriceAmount: params.maxPriceAmount }
            : {}),
          ...(params?.status ? { status: params.status } : {}),
          page: {
            limit,
            offset,
          },
        },
      },
    });

    return {
      items: data.serviceList.items.map((item) => toServiceItem(item)),
      total: data.serviceList.total,
      limit: data.serviceList.limit,
      offset: data.serviceList.offset,
      hasMore: data.serviceList.hasMore,
    };
  },

  async getServiceDetail(serviceId: string): Promise<ServiceDetail> {
    try {
      const [itemData, detailData] = await Promise.all([
        requestBackendGraphQL<ServiceItemDetailGraphQL>({
          query: `
            query ServiceItem($id: String!) {
              serviceItem(id: $id) {
                id
                type
                title
                city
                description
                status
                languages
                images
                cancellationPolicy
                availableTimeSlots
                voucherTemplate
                capacity {
                  min
                  max
                  remaining
                }
                supportContact {
                  name
                  channel
                  value
                }
                resources {
                  id
                  label
                  status
                  languages
                  seats
                  availableTimeSlots
                }
                basePrice {
                  amount
                  currency
                }
              }
            }
          `,
          variables: {
            id: serviceId,
          },
        }),
        requestBackendGraphQL<ServiceDetailUnionGraphQL>({
          query: `
            query ServiceDetail($id: String!) {
              serviceDetail(id: $id) {
                __typename
                ... on PackageServiceDetail {
                  durationDays
                  itinerary
                }
                ... on GuideServiceDetail {
                  languages
                  yearsOfExperience
                  certifications
                }
                ... on CarServiceDetail {
                  seats
                  carType
                  luggageCapacity
                }
                ... on AssistantServiceDetail {
                  supportChannels
                  serviceHours
                }
              }
            }
          `,
          variables: {
            id: serviceId,
          },
        }),
      ]);

      if (itemData.serviceItem.status !== "ACTIVE") {
        throw new Error(`Service ${serviceId} is not available.`);
      }

      return {
        ...toServiceItem(itemData.serviceItem),
        status: itemData.serviceItem.status,
        detail: toServiceDetailVariant(detailData.serviceDetail),
      };
    } catch (error) {
      throw asError(error);
    }
  },

  async createBooking(input: {
    serviceId: string;
    startDate: string;
    endDate: string;
    travelerCount: number;
    timeSlot?: string;
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
              timeSlot
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
        timeSlot: booking.timeSlot,
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
        paymentStatus: payment.status,
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
                serviceId
                userId
                serviceTitle
                city
                bookingStatus
                paymentStatus
                expectedAmount
                startDate
                endDate
                timeSlot
                assignedResourceId
                assignedResourceLabel
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
              serviceId
              userId
              serviceTitle
              city
              bookingStatus
              paymentStatus
              expectedAmount
              startDate
              endDate
              timeSlot
              assignedResourceId
              assignedResourceLabel
              cancellationPolicy
              supportContact {
                name
                channel
                value
              }
              serviceVoucherCode
              serviceVoucherInstructions
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
    } catch (error) {
      throw asError(error);
    }
  },
};
