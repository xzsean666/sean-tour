import { requestBackendGraphQL } from "./backendGraphqlClient";

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
  userId?: string;
  email?: string;
  displayName?: string;
  note?: string;
  enabled: boolean;
}

type AdminAccessEntriesGraphQL = {
  adminAccessEntries: AdminAccessEntry[];
};

type AdminSetAccessGraphQL = {
  adminSetAccess: AdminAccessEntry;
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
};
