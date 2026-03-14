import { requestBackendGraphQL } from "./backendGraphqlClient";
import type {
  BookingStatus,
  OrderItem,
  PaymentStatus,
  ServiceResource,
} from "./travelService";

type AdminOrdersGraphQL = {
  adminOrders: {
    items: OrderItem[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};

type AdminOrderDetailGraphQL = {
  adminOrderDetail: OrderItem;
};

type AdminUpdateBookingStatusGraphQL = {
  adminUpdateBookingStatus: {
    id: string;
    status: BookingStatus;
  };
};

type AdminAssignableBookingResourcesGraphQL = {
  adminAssignableBookingResources: ServiceResource[];
};

type AdminReassignBookingResourceGraphQL = {
  adminReassignBookingResource: {
    id: string;
    assignedResource?: {
      id: string;
      label: string;
    };
  };
};

const orderFields = `
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
`;

export const adminOrderService = {
  async listOrders(params?: {
    bookingId?: string;
    serviceId?: string;
    userId?: string;
    bookingStatus?: BookingStatus;
    paymentStatus?: PaymentStatus;
    limit?: number;
    offset?: number;
  }): Promise<{
    items: OrderItem[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  }> {
    const limit = Math.min(Math.max(params?.limit ?? 20, 1), 100);
    const offset = Math.max(params?.offset ?? 0, 0);

    const data = await requestBackendGraphQL<AdminOrdersGraphQL>({
      query: `
        query AdminOrders($input: OrderListInput) {
          adminOrders(input: $input) {
            items {
              ${orderFields}
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
          ...(params?.bookingId ? { bookingId: params.bookingId } : {}),
          ...(params?.serviceId ? { serviceId: params.serviceId } : {}),
          ...(params?.userId ? { userId: params.userId } : {}),
          ...(params?.bookingStatus ? { bookingStatus: params.bookingStatus } : {}),
          ...(params?.paymentStatus ? { paymentStatus: params.paymentStatus } : {}),
          page: {
            limit,
            offset,
          },
        },
      },
    });

    return data.adminOrders;
  },

  async getOrderDetail(orderId: string): Promise<OrderItem> {
    const data = await requestBackendGraphQL<AdminOrderDetailGraphQL>({
      query: `
        query AdminOrderDetail($orderId: String!) {
          adminOrderDetail(orderId: $orderId) {
            ${orderFields}
          }
        }
      `,
      variables: {
        orderId,
      },
    });

    return data.adminOrderDetail;
  },

  async updateBookingStatus(input: {
    bookingId: string;
    status: BookingStatus;
    reason?: string;
  }): Promise<{
    id: string;
    status: BookingStatus;
  }> {
    const data = await requestBackendGraphQL<AdminUpdateBookingStatusGraphQL>({
      query: `
        mutation AdminUpdateBookingStatus($input: UpdateBookingStatusInput!) {
          adminUpdateBookingStatus(input: $input) {
            id
            status
          }
        }
      `,
      variables: {
        input,
      },
    });

    return data.adminUpdateBookingStatus;
  },

  async listAssignableBookingResources(
    bookingId: string,
  ): Promise<ServiceResource[]> {
    const data = await requestBackendGraphQL<AdminAssignableBookingResourcesGraphQL>({
      query: `
        query AdminAssignableBookingResources($bookingId: String!) {
          adminAssignableBookingResources(bookingId: $bookingId) {
            id
            label
            status
            languages
            seats
            availableTimeSlots
          }
        }
      `,
      variables: {
        bookingId,
      },
    });

    return data.adminAssignableBookingResources;
  },

  async reassignBookingResource(input: {
    bookingId: string;
    resourceId: string;
  }): Promise<{
    id: string;
    assignedResource?: {
      id: string;
      label: string;
    };
  }> {
    const data = await requestBackendGraphQL<AdminReassignBookingResourceGraphQL>({
      query: `
        mutation AdminReassignBookingResource($input: ReassignBookingResourceInput!) {
          adminReassignBookingResource(input: $input) {
            id
            assignedResource {
              id
              label
            }
          }
        }
      `,
      variables: {
        input,
      },
    });

    return data.adminReassignBookingResource;
  },
};
