import { requestBackendGraphQL } from './backendGraphqlClient';

export type SupportConversationStatus =
  | 'WAITING_AGENT'
  | 'IN_PROGRESS'
  | 'WAITING_USER'
  | 'RESOLVED'
  | 'CLOSED';

export type SupportConversationPriority =
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'URGENT';

export type SupportConversationSlaStatus =
  | 'ON_TRACK'
  | 'DUE_SOON'
  | 'OVERDUE';

export type SupportConversationAuditAction =
  | 'USER_MESSAGE'
  | 'AGENT_REPLY'
  | 'ASSIGNED'
  | 'UNASSIGNED'
  | 'RESOLVED'
  | 'INTERNAL_NOTE_UPDATED'
  | 'TRIAGE_UPDATED'
  | 'CLOSED'
  | 'REOPENED';

export type SupportSenderRole = 'USER' | 'SUPPORT_AGENT' | 'SYSTEM';

export interface SupportWorkspaceTemplate {
  label: string;
  content: string;
}

export interface SupportIntakeConfig {
  issueStarters: SupportWorkspaceTemplate[];
}

export interface SupportWorkspaceConfig {
  issueStarters: SupportWorkspaceTemplate[];
  quickReplyTemplates: SupportWorkspaceTemplate[];
  commonTags: string[];
  updatedAt?: string;
  updatedBy?: string;
}

export interface SupportMessageItem {
  id: string;
  conversationId: string;
  userId: string;
  senderUserId: string;
  senderRole: SupportSenderRole;
  content: string;
  createdAt: string;
}

export interface SupportConversationItem {
  id: string;
  userId: string;
  assignedAgentId?: string;
  sharedAgentIds: string[];
  status: SupportConversationStatus;
  lastMessagePreview?: string;
  lastMessageAt?: string;
  unreadForUser: number;
  unreadForAgents: number;
  messages: SupportMessageItem[];
  createdAt: string;
  updatedAt: string;
}

export interface SupportAgentProfile {
  userId: string;
  displayName?: string;
  email?: string;
  note?: string;
  enabled: boolean;
  isActive: boolean;
  openConversationCount: number;
  lastAssignedAt?: string;
  grantedBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupportConversationWorkspaceMeta {
  conversationId: string;
  internalNote?: string;
  priority: SupportConversationPriority;
  tags: string[];
  closeReason?: string;
  closedAt?: string;
  closedBy?: string;
  updatedAt: string;
  updatedBy?: string;
  slaDueAt?: string;
  slaStatus?: SupportConversationSlaStatus;
}

export interface SupportConversationAuditItem {
  id: string;
  conversationId: string;
  action: SupportConversationAuditAction;
  actor: string;
  summary: string;
  messagePreview?: string;
  priority?: SupportConversationPriority;
  tags: string[];
  assignedAgentId?: string;
  closeReason?: string;
  reopenedFromStatus?: SupportConversationStatus;
  createdAt: string;
}

type MySupportConversationGraphQL = {
  mySupportConversation: SupportConversationItem;
};

type SendSupportMessageGraphQL = {
  sendSupportMessage: SupportConversationItem;
};

type SupportIntakeConfigGraphQL = {
  supportIntakeConfig: SupportIntakeConfig;
};

type MySupportAgentProfileGraphQL = {
  mySupportAgentProfile: SupportAgentProfile;
};

type SetMySupportAgentActiveGraphQL = {
  setMySupportAgentActive: SupportAgentProfile;
};

type SupportConversationQueueGraphQL = {
  supportConversationQueue: {
    items: SupportConversationItem[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};

type SupportConversationDetailGraphQL = {
  supportConversationDetail: SupportConversationItem;
};

type ReplySupportConversationGraphQL = {
  replySupportConversation: SupportConversationItem;
};

type ResolveSupportConversationGraphQL = {
  resolveSupportConversation: SupportConversationItem;
};

type SupportWorkspaceConfigGraphQL = {
  supportWorkspaceConfig: SupportWorkspaceConfig;
};

type SupportConversationWorkspaceMetaGraphQL = {
  supportConversationWorkspaceMeta: SupportConversationWorkspaceMeta;
};

type SupportConversationWorkspaceMetasGraphQL = {
  supportConversationWorkspaceMetas: SupportConversationWorkspaceMeta[];
};

type SetSupportConversationInternalNoteGraphQL = {
  setSupportConversationInternalNote: SupportConversationWorkspaceMeta;
};

type SetSupportConversationTriageGraphQL = {
  setSupportConversationTriage: SupportConversationWorkspaceMeta;
};

type SupportConversationAuditLogsGraphQL = {
  supportConversationAuditLogs: {
    items: SupportConversationAuditItem[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
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

export const supportService = {
  async getMyConversation(): Promise<SupportConversationItem> {
    const data = await requestBackendGraphQL<MySupportConversationGraphQL>({
      query: `
        query MySupportConversation {
          mySupportConversation {
            ${supportConversationDetailFields}
          }
        }
      `,
    });

    return data.mySupportConversation;
  },

  async sendMessage(content: string): Promise<SupportConversationItem> {
    const data = await requestBackendGraphQL<SendSupportMessageGraphQL>({
      query: `
        mutation SendSupportMessage($input: SendSupportMessageInput!) {
          sendSupportMessage(input: $input) {
            ${supportConversationDetailFields}
          }
        }
      `,
      variables: {
        input: {
          content,
        },
      },
    });

    return data.sendSupportMessage;
  },

  async getIntakeConfig(): Promise<SupportIntakeConfig> {
    const data = await requestBackendGraphQL<SupportIntakeConfigGraphQL>({
      query: `
        query SupportIntakeConfig {
          supportIntakeConfig {
            issueStarters {
              ${supportWorkspaceTemplateFields}
            }
          }
        }
      `,
    });

    return data.supportIntakeConfig;
  },

  async getMyAgentProfile(): Promise<SupportAgentProfile> {
    const data = await requestBackendGraphQL<MySupportAgentProfileGraphQL>({
      query: `
        query MySupportAgentProfile {
          mySupportAgentProfile {
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

    return data.mySupportAgentProfile;
  },

  async setMyAgentActive(isActive: boolean): Promise<SupportAgentProfile> {
    const data = await requestBackendGraphQL<SetMySupportAgentActiveGraphQL>({
      query: `
        mutation SetMySupportAgentActive($isActive: Boolean!) {
          setMySupportAgentActive(isActive: $isActive) {
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
        isActive,
      },
    });

    return data.setMySupportAgentActive;
  },

  async getWorkspaceConfig(): Promise<SupportWorkspaceConfig> {
    const data = await requestBackendGraphQL<SupportWorkspaceConfigGraphQL>({
      query: `
        query SupportWorkspaceConfig {
          supportWorkspaceConfig {
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
    });

    return data.supportWorkspaceConfig;
  },

  async listQueue(params?: {
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

    const data = await requestBackendGraphQL<SupportConversationQueueGraphQL>({
      query: `
        query SupportConversationQueue($input: SupportConversationListInput) {
          supportConversationQueue(input: $input) {
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

    return data.supportConversationQueue;
  },

  async getConversationDetail(
    conversationId: string,
  ): Promise<SupportConversationItem> {
    const data = await requestBackendGraphQL<SupportConversationDetailGraphQL>({
      query: `
        query SupportConversationDetail($conversationId: String!) {
          supportConversationDetail(conversationId: $conversationId) {
            ${supportConversationDetailFields}
          }
        }
      `,
      variables: {
        conversationId,
      },
    });

    return data.supportConversationDetail;
  },

  async getConversationWorkspaceMeta(
    conversationId: string,
  ): Promise<SupportConversationWorkspaceMeta> {
    const data =
      await requestBackendGraphQL<SupportConversationWorkspaceMetaGraphQL>({
        query: `
          query SupportConversationWorkspaceMeta($conversationId: String!) {
            supportConversationWorkspaceMeta(conversationId: $conversationId) {
              conversationId
              internalNote
              priority
              tags
              closeReason
              closedAt
              closedBy
              updatedAt
              updatedBy
              slaDueAt
              slaStatus
            }
          }
        `,
        variables: {
          conversationId,
        },
      });

    return data.supportConversationWorkspaceMeta;
  },

  async getConversationWorkspaceMetas(
    conversationIds: string[],
  ): Promise<SupportConversationWorkspaceMeta[]> {
    if (conversationIds.length === 0) {
      return [];
    }

    const data =
      await requestBackendGraphQL<SupportConversationWorkspaceMetasGraphQL>({
        query: `
          query SupportConversationWorkspaceMetas($conversationIds: [String!]!) {
            supportConversationWorkspaceMetas(conversationIds: $conversationIds) {
              conversationId
              internalNote
              priority
              tags
              closeReason
              closedAt
              closedBy
              updatedAt
              updatedBy
              slaDueAt
              slaStatus
            }
          }
        `,
        variables: {
          conversationIds,
        },
      });

    return data.supportConversationWorkspaceMetas;
  },

  async getConversationAuditLogs(
    conversationId: string,
    params?: {
      limit?: number;
      offset?: number;
      actor?: string;
      action?: SupportConversationAuditAction;
    },
  ): Promise<{
    items: SupportConversationAuditItem[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  }> {
    const limit = Math.min(Math.max(params?.limit ?? 12, 1), 100);
    const offset = Math.max(params?.offset ?? 0, 0);
    const data = await requestBackendGraphQL<SupportConversationAuditLogsGraphQL>({
      query: `
        query SupportConversationAuditLogs(
          $conversationId: String!
          $actor: String
          $action: SupportConversationAuditAction
          $page: PageInput
        ) {
          supportConversationAuditLogs(
            conversationId: $conversationId
            actor: $actor
            action: $action
            page: $page
          ) {
            items {
              id
              conversationId
              action
              actor
              summary
              messagePreview
              priority
              tags
              assignedAgentId
              closeReason
              reopenedFromStatus
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
        conversationId,
        actor: params?.actor?.trim() || undefined,
        action: params?.action,
        page: {
          limit,
          offset,
        },
      },
    });

    return data.supportConversationAuditLogs;
  },

  async setConversationInternalNote(
    conversationId: string,
    internalNote?: string,
  ): Promise<SupportConversationWorkspaceMeta> {
    const data =
      await requestBackendGraphQL<SetSupportConversationInternalNoteGraphQL>({
        query: `
          mutation SetSupportConversationInternalNote($input: SetSupportConversationInternalNoteInput!) {
            setSupportConversationInternalNote(input: $input) {
              conversationId
              internalNote
              priority
              tags
              closeReason
              closedAt
              closedBy
              updatedAt
              updatedBy
              slaDueAt
              slaStatus
            }
          }
        `,
        variables: {
          input: {
            conversationId,
            internalNote,
          },
        },
      });

    return data.setSupportConversationInternalNote;
  },

  async setConversationTriage(
    conversationId: string,
    priority?: SupportConversationPriority,
    tags?: string[],
  ): Promise<SupportConversationWorkspaceMeta> {
    const data =
      await requestBackendGraphQL<SetSupportConversationTriageGraphQL>({
        query: `
          mutation SetSupportConversationTriage($input: SetSupportConversationTriageInput!) {
            setSupportConversationTriage(input: $input) {
              conversationId
              internalNote
              priority
              tags
              closeReason
              closedAt
              closedBy
              updatedAt
              updatedBy
              slaDueAt
              slaStatus
            }
          }
        `,
        variables: {
          input: {
            conversationId,
            priority,
            tags,
          },
        },
      });

    return data.setSupportConversationTriage;
  },

  async replyToConversation(
    conversationId: string,
    content: string,
  ): Promise<SupportConversationItem> {
    const data = await requestBackendGraphQL<ReplySupportConversationGraphQL>({
      query: `
        mutation ReplySupportConversation($input: ReplySupportConversationInput!) {
          replySupportConversation(input: $input) {
            ${supportConversationDetailFields}
          }
        }
      `,
      variables: {
        input: {
          conversationId,
          content,
        },
      },
    });

    return data.replySupportConversation;
  },

  async resolveConversation(
    conversationId: string,
  ): Promise<SupportConversationItem> {
    const data =
      await requestBackendGraphQL<ResolveSupportConversationGraphQL>({
        query: `
          mutation ResolveSupportConversation($input: ResolveSupportConversationInput!) {
            resolveSupportConversation(input: $input) {
              ${supportConversationDetailFields}
            }
          }
        `,
        variables: {
          input: {
            conversationId,
          },
        },
      });

    return data.resolveSupportConversation;
  },
};
