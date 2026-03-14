import { requestBackendGraphQL } from "./backendGraphqlClient";
import type {
  BookingStatus,
  ServiceCapacity,
  ServiceContact,
  ServiceResource,
} from "./travelService";

export type ServiceType = "PACKAGE" | "GUIDE" | "CAR" | "ASSISTANT";

export interface AdminServiceItem {
  id: string;
  type: ServiceType;
  title: string;
  city: string;
  description: string;
  status: string;
  languages: string[];
  images: string[];
  basePriceAmount: number;
  cancellationPolicy?: string;
  availableTimeSlots: string[];
  capacity?: ServiceCapacity;
  supportContact?: ServiceContact;
  resources: ServiceResource[];
  voucherTemplate?: string;
  updatedAt: string;
}

export interface AdminServiceResourceScheduleBooking {
  bookingId: string;
  userId: string;
  bookingStatus: BookingStatus;
  startDate: string;
  endDate: string;
  timeSlot?: string;
  travelerCount: number;
  assignedResourceId?: string;
  assignedResourceLabel?: string;
}

export interface AdminServiceResourceScheduleItem {
  resourceId: string;
  resourceLabel: string;
  status: string;
  languages: string[];
  seats?: number;
  availableTimeSlots: string[];
  bookings: AdminServiceResourceScheduleBooking[];
  conflictTimeSlots: string[];
}

export interface AdminServiceResourceSchedule {
  serviceId: string;
  serviceTitle: string;
  resources: AdminServiceResourceScheduleItem[];
  unassignedBookings: AdminServiceResourceScheduleBooking[];
}

export type ServiceAuditAction = "UPSERT" | "STATUS_CHANGE" | "DELETE";

export interface ServiceAuditLog {
  id: string;
  serviceId: string;
  action: ServiceAuditAction;
  beforeStatus?: string;
  afterStatus?: string;
  note?: string;
  actor: string;
  createdAt: string;
}

export type AdminServiceDetail =
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

export type AdminUpsertServiceInput = {
  id?: string;
  type: ServiceType;
  title: string;
  city: string;
  description: string;
  images?: string[];
  languages: string[];
  basePriceAmount: number;
  cancellationPolicy?: string;
  availableTimeSlots?: string[];
  capacity?: ServiceCapacity;
  supportContact?: ServiceContact;
  resources?: ServiceResource[];
  voucherTemplate?: string;
  status?: string;
  packageDetail?: {
    durationDays: number;
    itinerary: string[];
  };
  guideDetail?: {
    languages: string[];
    yearsOfExperience: number;
    certifications: string[];
  };
  carDetail?: {
    seats: number;
    carType: string;
    luggageCapacity?: string;
  };
  assistantDetail?: {
    supportChannels: string[];
    serviceHours: string;
  };
};

type ServiceItemGraphQL = {
  id: string;
  type: ServiceType;
  title: string;
  city: string;
  description: string;
  status: string;
  updatedAt: string;
  languages: string[];
  images: string[];
  cancellationPolicy?: string;
  availableTimeSlots: string[];
  capacity?: ServiceCapacity;
  supportContact?: ServiceContact;
  resources: ServiceResource[];
  voucherTemplate?: string;
  basePrice: {
    amount: number;
    currency: "USDT";
  };
};

type ServiceListGraphQL = {
  serviceList: {
    items: ServiceItemGraphQL[];
    total: number;
    hasMore: boolean;
  };
};

type ServiceItemDetailGraphQL = {
  serviceItem: ServiceItemGraphQL;
};

type ServiceDetailGraphQL = {
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

type AdminUpsertServiceGraphQL = {
  adminUpsertService: ServiceItemGraphQL;
};

type AdminSetServiceStatusGraphQL = {
  adminSetServiceStatus: ServiceItemGraphQL;
};

type AdminDeleteServiceGraphQL = {
  adminDeleteService: boolean;
};

type AdminServiceAuditLogsGraphQL = {
  adminServiceAuditLogs: {
    items: Array<{
      id: string;
      serviceId: string;
      action: ServiceAuditAction;
      beforeStatus?: string;
      afterStatus?: string;
      note?: string;
      actor: string;
      createdAt: string;
    }>;
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};

type AdminServiceResourceScheduleGraphQL = {
  adminServiceResourceSchedule: AdminServiceResourceSchedule;
};

const adminServiceFields = `
  id
  type
  title
  city
  description
  status
  updatedAt
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
`;

function parseServiceItem(item: ServiceItemGraphQL): AdminServiceItem {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    city: item.city,
    description: item.description,
    status: item.status,
    languages: item.languages || [],
    images: item.images || [],
    basePriceAmount: item.basePrice.amount,
    cancellationPolicy: item.cancellationPolicy,
    availableTimeSlots: item.availableTimeSlots || [],
    capacity: item.capacity,
    supportContact: item.supportContact,
    resources: item.resources || [],
    voucherTemplate: item.voucherTemplate,
    updatedAt: item.updatedAt,
  };
}

function toAdminServiceDetail(
  payload: ServiceDetailGraphQL["serviceDetail"],
): AdminServiceDetail {
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

export const adminCatalogService = {
  async listServices(params?: { limit?: number; offset?: number }): Promise<{
    items: AdminServiceItem[];
    total: number;
    hasMore: boolean;
  }> {
    const limit = Math.min(Math.max(params?.limit ?? 50, 1), 100);
    const offset = Math.max(params?.offset ?? 0, 0);

    const data = await requestBackendGraphQL<ServiceListGraphQL>({
      query: `
        query ServiceListForAdmin($input: ServiceListInput) {
          serviceList(input: $input) {
            items {
              ${adminServiceFields}
            }
            total
            hasMore
          }
        }
      `,
      variables: {
        input: {
          page: {
            limit,
            offset,
          },
        },
      },
    });

    return {
      items: data.serviceList.items.map((item) => parseServiceItem(item)),
      total: data.serviceList.total,
      hasMore: data.serviceList.hasMore,
    };
  },

  async getServiceItem(serviceId: string): Promise<AdminServiceItem> {
    const data = await requestBackendGraphQL<ServiceItemDetailGraphQL>({
      query: `
        query ServiceItemForAdmin($id: String!) {
          serviceItem(id: $id) {
            ${adminServiceFields}
          }
        }
      `,
      variables: {
        id: serviceId,
      },
    });

    return parseServiceItem(data.serviceItem);
  },

  async getServiceDetail(serviceId: string): Promise<AdminServiceDetail> {
    const data = await requestBackendGraphQL<ServiceDetailGraphQL>({
      query: `
        query ServiceDetailForAdmin($id: String!) {
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
    });

    return toAdminServiceDetail(data.serviceDetail);
  },

  async upsertService(input: AdminUpsertServiceInput): Promise<AdminServiceItem> {
    const data = await requestBackendGraphQL<AdminUpsertServiceGraphQL>({
      query: `
        mutation AdminUpsertService($input: UpsertServiceInput!) {
          adminUpsertService(input: $input) {
            ${adminServiceFields}
          }
        }
      `,
      variables: {
        input,
      },
    });

    return parseServiceItem(data.adminUpsertService);
  },

  async setServiceStatus(input: {
    id: string;
    status: string;
  }): Promise<AdminServiceItem> {
    const data = await requestBackendGraphQL<AdminSetServiceStatusGraphQL>({
      query: `
        mutation AdminSetServiceStatus($input: SetServiceStatusInput!) {
          adminSetServiceStatus(input: $input) {
            ${adminServiceFields}
          }
        }
      `,
      variables: { input },
    });

    return parseServiceItem(data.adminSetServiceStatus);
  },

  async deleteService(input: {
    id: string;
    hardDelete?: boolean;
  }): Promise<boolean> {
    const data = await requestBackendGraphQL<AdminDeleteServiceGraphQL>({
      query: `
        mutation AdminDeleteService($input: DeleteServiceInput!) {
          adminDeleteService(input: $input)
        }
      `,
      variables: {
        input: {
          id: input.id,
          hardDelete: !!input.hardDelete,
        },
      },
    });

    return data.adminDeleteService;
  },

  async listAuditLogs(params?: {
    serviceId?: string;
    action?: ServiceAuditAction;
    limit?: number;
    offset?: number;
  }): Promise<{
    items: ServiceAuditLog[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  }> {
    const limit = Math.min(Math.max(params?.limit ?? 20, 1), 100);
    const offset = Math.max(params?.offset ?? 0, 0);

    const data = await requestBackendGraphQL<AdminServiceAuditLogsGraphQL>({
      query: `
        query AdminServiceAuditLogs($input: ServiceAuditListInput) {
          adminServiceAuditLogs(input: $input) {
            items {
              id
              serviceId
              action
              beforeStatus
              afterStatus
              note
              actor
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
          ...(params?.serviceId ? { serviceId: params.serviceId } : {}),
          ...(params?.action ? { action: params.action } : {}),
          page: { limit, offset },
        },
      },
    });

    return {
      items: data.adminServiceAuditLogs.items,
      total: data.adminServiceAuditLogs.total,
      limit: data.adminServiceAuditLogs.limit,
      offset: data.adminServiceAuditLogs.offset,
      hasMore: data.adminServiceAuditLogs.hasMore,
    };
  },

  async getServiceResourceSchedule(
    serviceId: string,
    date?: string,
  ): Promise<AdminServiceResourceSchedule> {
    const data = await requestBackendGraphQL<AdminServiceResourceScheduleGraphQL>({
      query: `
        query AdminServiceResourceSchedule($serviceId: String!, $date: String) {
          adminServiceResourceSchedule(serviceId: $serviceId, date: $date) {
            serviceId
            serviceTitle
            resources {
              resourceId
              resourceLabel
              status
              languages
              seats
              availableTimeSlots
              conflictTimeSlots
              bookings {
                bookingId
                userId
                bookingStatus
                startDate
                endDate
                timeSlot
                travelerCount
                assignedResourceId
                assignedResourceLabel
              }
            }
            unassignedBookings {
              bookingId
              userId
              bookingStatus
              startDate
              endDate
              timeSlot
              travelerCount
              assignedResourceId
              assignedResourceLabel
            }
          }
        }
      `,
      variables: {
        serviceId,
        ...(date ? { date } : {}),
      },
    });

    return data.adminServiceResourceSchedule;
  },
};
