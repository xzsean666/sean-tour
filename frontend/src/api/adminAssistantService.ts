import { requestBackendGraphQL } from "./backendGraphqlClient";
import type {
  AssistantSessionItem,
  AssistantSessionStatus,
} from "./assistantService";

export interface AdminUpdateAssistantSessionInput {
  sessionId: string;
  status: AssistantSessionStatus;
  assignedAgent?: string;
  internalNote?: string;
}

export interface AdminBatchAssignAssistantSessionsInput {
  sessionIds: string[];
  assignedAgent: string;
  status?: AssistantSessionStatus;
  internalNote?: string;
}

type AdminAssistantSessionsGraphQL = {
  adminAssistantSessions: {
    items: AssistantSessionItem[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};

type AdminUpdateAssistantSessionGraphQL = {
  adminUpdateAssistantSession: AssistantSessionItem;
};

type AdminBatchAssignAssistantSessionsGraphQL = {
  adminBatchAssignAssistantSessions: AssistantSessionItem[];
};

const assistantSessionFields = `
  id
  bookingId
  userId
  serviceId
  serviceTitle
  city
  language
  topic
  preferredContact
  preferredTimeSlots
  status
  assignedAgent
  internalNote
  createdAt
  updatedAt
`;

export const adminAssistantService = {
  async listSessions(params?: {
    sessionId?: string;
    bookingId?: string;
    userId?: string;
    assignedAgent?: string;
    status?: AssistantSessionStatus;
    limit?: number;
    offset?: number;
  }): Promise<{
    items: AssistantSessionItem[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  }> {
    const limit = Math.min(Math.max(params?.limit ?? 20, 1), 100);
    const offset = Math.max(params?.offset ?? 0, 0);

    const data = await requestBackendGraphQL<AdminAssistantSessionsGraphQL>({
      query: `
        query AdminAssistantSessions($input: AdminAssistantSessionListInput) {
          adminAssistantSessions(input: $input) {
            items {
              ${assistantSessionFields}
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
          ...(params?.sessionId ? { sessionId: params.sessionId } : {}),
          ...(params?.bookingId ? { bookingId: params.bookingId } : {}),
          ...(params?.userId ? { userId: params.userId } : {}),
          ...(params?.assignedAgent ? { assignedAgent: params.assignedAgent } : {}),
          ...(params?.status ? { status: params.status } : {}),
          page: {
            limit,
            offset,
          },
        },
      },
    });

    return data.adminAssistantSessions;
  },

  async updateSession(input: AdminUpdateAssistantSessionInput): Promise<AssistantSessionItem> {
    const data = await requestBackendGraphQL<AdminUpdateAssistantSessionGraphQL>({
      query: `
        mutation AdminUpdateAssistantSession($input: AdminUpdateAssistantSessionInput!) {
          adminUpdateAssistantSession(input: $input) {
            ${assistantSessionFields}
          }
        }
      `,
      variables: {
        input,
      },
    });

    return data.adminUpdateAssistantSession;
  },

  async batchAssignSessions(
    input: AdminBatchAssignAssistantSessionsInput,
  ): Promise<AssistantSessionItem[]> {
    const data =
      await requestBackendGraphQL<AdminBatchAssignAssistantSessionsGraphQL>({
        query: `
          mutation AdminBatchAssignAssistantSessions($input: AdminBatchAssignAssistantSessionsInput!) {
            adminBatchAssignAssistantSessions(input: $input) {
              ${assistantSessionFields}
            }
          }
        `,
        variables: {
          input,
        },
      });

    return data.adminBatchAssignAssistantSessions;
  },
};
