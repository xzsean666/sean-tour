import { requestBackendGraphQL } from "./backendGraphqlClient";

export type AccessRole = "ADMIN" | "SUPPORT_AGENT";

export interface AdminAccessEntry {
  id: string;
  userId?: string;
  email?: string;
  displayName?: string;
  note?: string;
  source: string;
  enabled: boolean;
  editable: boolean;
  grantedBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminSetAccessInput {
  recordId?: string;
  userId?: string;
  email?: string;
  displayName?: string;
  note?: string;
  enabled: boolean;
}

export interface RoleAccessAuditItem {
  id: string;
  role: AccessRole;
  recordId: string;
  action: "CREATED" | "UPDATED" | "ENABLED" | "DISABLED";
  actor: string;
  summary: string;
  userId?: string;
  email?: string;
  displayName?: string;
  note?: string;
  enabled: boolean;
  previousEnabled?: boolean;
  createdAt: string;
}

export interface RoleAccessAuditPage {
  items: RoleAccessAuditItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

type AdminAccessEntriesGraphQL = {
  adminAccessEntries: AdminAccessEntry[];
};

type AdminSetAccessGraphQL = {
  adminSetAccess: AdminAccessEntry;
};

type AdminRoleAccessAuditLogsGraphQL = {
  adminRoleAccessAuditLogs: RoleAccessAuditPage;
};

const adminAccessFields = `
  id
  userId
  email
  displayName
  note
  source
  enabled
  editable
  grantedBy
  updatedBy
  createdAt
  updatedAt
`;

const roleAccessAuditFields = `
  id
  role
  recordId
  action
  actor
  summary
  userId
  email
  displayName
  note
  enabled
  previousEnabled
  createdAt
`;

export const adminAccessService = {
  async listEntries(): Promise<AdminAccessEntry[]> {
    const data = await requestBackendGraphQL<AdminAccessEntriesGraphQL>({
      query: `
        query AdminAccessEntries {
          adminAccessEntries {
            ${adminAccessFields}
          }
        }
      `,
    });

    return data.adminAccessEntries;
  },

  async setAccess(input: AdminSetAccessInput): Promise<AdminAccessEntry> {
    const data = await requestBackendGraphQL<AdminSetAccessGraphQL>({
      query: `
        mutation AdminSetAccess($input: AdminSetAccessInput!) {
          adminSetAccess(input: $input) {
            ${adminAccessFields}
          }
        }
      `,
      variables: {
        input,
      },
    });

    return data.adminSetAccess;
  },

  async listAuditLogs(params: {
    role: AccessRole;
    recordId?: string;
    limit?: number;
    offset?: number;
  }): Promise<RoleAccessAuditPage> {
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
    const offset = Math.max(params.offset ?? 0, 0);

    const data = await requestBackendGraphQL<AdminRoleAccessAuditLogsGraphQL>({
      query: `
        query AdminRoleAccessAuditLogs(
          $role: RoleAccessRole!
          $recordId: String
          $page: PageInput
        ) {
          adminRoleAccessAuditLogs(role: $role, recordId: $recordId, page: $page) {
            ${roleAccessAuditFields}
            total
            limit
            offset
            hasMore
          }
        }
      `,
      variables: {
        role: params.role,
        ...(params.recordId ? { recordId: params.recordId } : {}),
        page: {
          limit,
          offset,
        },
      },
    });

    return data.adminRoleAccessAuditLogs;
  },
};
