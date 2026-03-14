import { requestBackendGraphQL } from './backendGraphqlClient';
import type {
  SupportAgentProfile,
  SupportConversationItem,
  SupportConversationPriority,
  SupportConversationStatus,
  SupportWorkspaceConfig,
  SupportWorkspaceTemplate,
} from './supportService';

export interface AdminSetSupportAgentInput {
  userId: string;
  enabled: boolean;
  isActive?: boolean;
  displayName?: string;
  email?: string;
  note?: string;
}

export interface AdminAssignSupportConversationInput {
  conversationId: string;
  agentUserId: string;
}

export interface AdminCloseSupportConversationInput {
  conversationId: string;
  closeReason?: string;
}

export interface AdminUpsertSupportWorkspaceConfigInput {
  issueStarters: SupportWorkspaceTemplate[];
  quickReplyTemplates: SupportWorkspaceTemplate[];
  commonTags: string[];
}

type AdminSupportAgentsGraphQL = {
  adminSupportAgents: SupportAgentProfile[];
};

type AdminSetSupportAgentGraphQL = {
  adminSetSupportAgent: SupportAgentProfile;
};

type AdminSupportConversationsGraphQL = {
  adminSupportConversations: {
    items: SupportConversationItem[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};

type AdminSupportConversationGraphQL = {
  adminSupportConversation: SupportConversationItem;
};

type AdminAssignSupportConversationGraphQL = {
  adminAssignSupportConversation: SupportConversationItem;
};

type AdminCloseSupportConversationGraphQL = {
  adminCloseSupportConversation: SupportConversationItem;
};

type AdminUpsertSupportWorkspaceConfigGraphQL = {
  adminUpsertSupportWorkspaceConfig: SupportWorkspaceConfig;
};

const supportMessageFields = `
  id
  conversationId
  userId
  senderUserId
  senderRole
  content
  createdAt
`;

const supportWorkspaceTemplateFields = `
  label
  content
`;

const supportConversationFields = `
  id
  userId
  assignedAgentId
  sharedAgentIds
  status
  lastMessagePreview
  lastMessageAt
  unreadForUser
  unreadForAgents
  createdAt
  updatedAt
`;

const supportConversationDetailFields = `
  ${supportConversationFields}
  messages {
    ${supportMessageFields}
  }
`;

export const adminSupportService = {
  async listAgents(): Promise<SupportAgentProfile[]> {
    const data = await requestBackendGraphQL<AdminSupportAgentsGraphQL>({
      query: `
        query AdminSupportAgents {
          adminSupportAgents {
            userId
            displayName
            email
            note
            enabled
            isActive
            openConversationCount
            lastAssignedAt
            grantedBy
            updatedBy
            createdAt
            updatedAt
          }
        }
      `,
    });

    return data.adminSupportAgents;
  },

  async setAgent(input: AdminSetSupportAgentInput): Promise<SupportAgentProfile> {
    const data = await requestBackendGraphQL<AdminSetSupportAgentGraphQL>({
      query: `
        mutation AdminSetSupportAgent($input: AdminSetSupportAgentInput!) {
          adminSetSupportAgent(input: $input) {
            userId
            displayName
            email
            note
            enabled
            isActive
            openConversationCount
            lastAssignedAt
            grantedBy
            updatedBy
            createdAt
            updatedAt
          }
        }
      `,
      variables: {
        input,
      },
    });

    return data.adminSetSupportAgent;
  },

  async listConversations(params?: {
    conversationId?: string;
    userId?: string;
    assignedAgentId?: string;
    status?: SupportConversationStatus;
    priority?: SupportConversationPriority;
    onlyMine?: boolean;
    unassignedOnly?: boolean;
    hasUnreadForUser?: boolean;
    hasUnreadForAgents?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{
    items: SupportConversationItem[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  }> {
    const limit = Math.min(Math.max(params?.limit ?? 20, 1), 100);
    const offset = Math.max(params?.offset ?? 0, 0);

    const data = await requestBackendGraphQL<AdminSupportConversationsGraphQL>({
      query: `
        query AdminSupportConversations($input: SupportConversationListInput) {
          adminSupportConversations(input: $input) {
            items {
              ${supportConversationFields}
              messages {
                ${supportMessageFields}
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
          ...(params?.conversationId ? { conversationId: params.conversationId } : {}),
          ...(params?.userId ? { userId: params.userId } : {}),
          ...(params?.assignedAgentId
            ? { assignedAgentId: params.assignedAgentId }
            : {}),
          ...(params?.status ? { status: params.status } : {}),
          ...(params?.priority ? { priority: params.priority } : {}),
          ...(params?.onlyMine ? { onlyMine: true } : {}),
          ...(params?.unassignedOnly ? { unassignedOnly: true } : {}),
          ...(typeof params?.hasUnreadForUser === 'boolean'
            ? { hasUnreadForUser: params.hasUnreadForUser }
            : {}),
          ...(typeof params?.hasUnreadForAgents === 'boolean'
            ? { hasUnreadForAgents: params.hasUnreadForAgents }
            : {}),
          page: {
            limit,
            offset,
          },
        },
      },
    });

    return data.adminSupportConversations;
  },

  async getConversationDetail(
    conversationId: string,
  ): Promise<SupportConversationItem> {
    const data = await requestBackendGraphQL<AdminSupportConversationGraphQL>({
      query: `
        query AdminSupportConversation($conversationId: String!) {
          adminSupportConversation(conversationId: $conversationId) {
            ${supportConversationDetailFields}
          }
        }
      `,
      variables: {
        conversationId,
      },
    });

    return data.adminSupportConversation;
  },

  async assignConversation(
    input: AdminAssignSupportConversationInput,
  ): Promise<SupportConversationItem> {
    const data =
      await requestBackendGraphQL<AdminAssignSupportConversationGraphQL>({
        query: `
          mutation AdminAssignSupportConversation($input: AdminAssignSupportConversationInput!) {
            adminAssignSupportConversation(input: $input) {
              ${supportConversationDetailFields}
            }
          }
        `,
        variables: {
          input,
        },
      });

    return data.adminAssignSupportConversation;
  },

  async closeConversation(
    input: AdminCloseSupportConversationInput,
  ): Promise<SupportConversationItem> {
    const data =
      await requestBackendGraphQL<AdminCloseSupportConversationGraphQL>({
        query: `
          mutation AdminCloseSupportConversation($input: AdminCloseSupportConversationInput!) {
            adminCloseSupportConversation(input: $input) {
              ${supportConversationDetailFields}
            }
          }
        `,
        variables: {
          input,
        },
      });

    return data.adminCloseSupportConversation;
  },

  async upsertWorkspaceConfig(
    input: AdminUpsertSupportWorkspaceConfigInput,
  ): Promise<SupportWorkspaceConfig> {
    const data =
      await requestBackendGraphQL<AdminUpsertSupportWorkspaceConfigGraphQL>({
        query: `
          mutation AdminUpsertSupportWorkspaceConfig($input: AdminUpsertSupportWorkspaceConfigInput!) {
            adminUpsertSupportWorkspaceConfig(input: $input) {
              issueStarters {
                ${supportWorkspaceTemplateFields}
              }
              quickReplyTemplates {
                ${supportWorkspaceTemplateFields}
              }
              commonTags
              updatedAt
              updatedBy
            }
          }
        `,
        variables: {
          input,
        },
      });

    return data.adminUpsertSupportWorkspaceConfig;
  },
};
