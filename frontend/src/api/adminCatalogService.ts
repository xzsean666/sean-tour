import { requestBackendGraphQL } from "./backendGraphqlClient";

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
  updatedAt: string;
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

type ServiceListGraphQL = {
  serviceList: {
    items: Array<{
      id: string;
      type: ServiceType;
      title: string;
      city: string;
      description: string;
      status: string;
      updatedAt: string;
      languages: string[];
      images: string[];
      basePrice: {
        amount: number;
        currency: "USDT";
      };
    }>;
    total: number;
    hasMore: boolean;
  };
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
  adminUpsertService: {
    id: string;
    type: ServiceType;
    title: string;
    city: string;
    description: string;
    status: string;
    updatedAt: string;
    languages: string[];
    images: string[];
    basePrice: {
      amount: number;
      currency: "USDT";
    };
  };
};

type AdminSetServiceStatusGraphQL = {
  adminSetServiceStatus: {
    id: string;
    type: ServiceType;
    title: string;
    city: string;
    description: string;
    status: string;
    updatedAt: string;
    languages: string[];
    images: string[];
    basePrice: {
      amount: number;
      currency: "USDT";
    };
  };
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

function parseServiceItem(
  item: ServiceListGraphQL["serviceList"]["items"][number],
): AdminServiceItem {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    city: item.city,
    description: item.description,
    status: item.status,
    languages: item.languages,
    images: item.images || [],
    basePriceAmount: item.basePrice.amount,
    updatedAt: item.updatedAt,
  };
}

function getAdminAuthCodeOrThrow(): string {
  const adminAuthCode = (import.meta.env.VITE_BACKEND_ADMIN_AUTH_CODE || "").trim();

  if (!adminAuthCode) {
    throw new Error("VITE_BACKEND_ADMIN_AUTH_CODE is required for admin operations.");
  }

  return adminAuthCode;
}

function toAdminServiceDetail(payload: ServiceDetailGraphQL["serviceDetail"]): AdminServiceDetail {
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
  isAdminConfigured(): boolean {
    return !!(import.meta.env.VITE_BACKEND_ADMIN_AUTH_CODE || "").trim();
  },

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
              id
              type
              title
              city
              description
              status
              updatedAt
              languages
              images
              basePrice {
                amount
                currency
              }
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
    const adminAuthCode = getAdminAuthCodeOrThrow();

    const data = await requestBackendGraphQL<AdminUpsertServiceGraphQL>({
      query: `
        mutation AdminUpsertService($input: UpsertServiceInput!) {
          adminUpsertService(input: $input) {
            id
            type
            title
            city
            description
            status
            updatedAt
            languages
            images
            basePrice {
              amount
              currency
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

    return parseServiceItem(data.adminUpsertService);
  },

  async setServiceStatus(input: {
    id: string;
    status: string;
  }): Promise<AdminServiceItem> {
    const adminAuthCode = getAdminAuthCodeOrThrow();
    const data = await requestBackendGraphQL<AdminSetServiceStatusGraphQL>({
      query: `
        mutation AdminSetServiceStatus($input: SetServiceStatusInput!) {
          adminSetServiceStatus(input: $input) {
            id
            type
            title
            city
            description
            status
            updatedAt
            languages
            images
            basePrice {
              amount
              currency
            }
          }
        }
      `,
      variables: { input },
      headers: {
        admin_auth_code: adminAuthCode,
      },
    });

    return parseServiceItem(data.adminSetServiceStatus);
  },

  async deleteService(input: {
    id: string;
    hardDelete?: boolean;
  }): Promise<boolean> {
    const adminAuthCode = getAdminAuthCodeOrThrow();
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
      headers: {
        admin_auth_code: adminAuthCode,
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
    const adminAuthCode = getAdminAuthCodeOrThrow();
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
      headers: {
        admin_auth_code: adminAuthCode,
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
};
