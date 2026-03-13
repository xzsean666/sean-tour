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

function getAdminAuthCodeOrThrow(): string {
  const adminAuthCode = (import.meta.env.VITE_BACKEND_ADMIN_AUTH_CODE || "").trim();

  if (!adminAuthCode) {
    throw new Error("VITE_BACKEND_ADMIN_AUTH_CODE is required for admin operations.");
  }

  return adminAuthCode;
}

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
  isAdminConfigured(): boolean {
    return !!(import.meta.env.VITE_BACKEND_ADMIN_AUTH_CODE || "").trim();
  },

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
    const adminAuthCode = getAdminAuthCodeOrThrow();
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
      headers: {
        admin_auth_code: adminAuthCode,
      },
    });

    return data.adminOrders;
  },

  async getOrderDetail(orderId: string): Promise<OrderItem> {
    const adminAuthCode = getAdminAuthCodeOrThrow();

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
      headers: {
        admin_auth_code: adminAuthCode,
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
    const adminAuthCode = getAdminAuthCodeOrThrow();

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
      headers: {
        admin_auth_code: adminAuthCode,
      },
    });

    return data.adminUpdateBookingStatus;
  },

  async listAssignableBookingResources(
    bookingId: string,
  ): Promise<ServiceResource[]> {
    const adminAuthCode = getAdminAuthCodeOrThrow();

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
      headers: {
        admin_auth_code: adminAuthCode,
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
    const adminAuthCode = getAdminAuthCodeOrThrow();

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
      headers: {
        admin_auth_code: adminAuthCode,
      },
    });

    return data.adminReassignBookingResource;
  },
};
