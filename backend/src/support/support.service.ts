import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { DBService, PGKVDatabase } from '../common/db.service';
import { AsyncLockManager } from '../helpers/dbUtils/KVCache';
import {
  RoleAccessEntry,
  RoleAccessService,
} from '../auth/role-access.service';
import { PageInput } from '../common/dto/page.input';
import { AdminAssignSupportConversationInput } from './dto/admin-assign-support-conversation.input';
import { AdminCloseSupportConversationInput } from './dto/admin-close-support-conversation.input';
import { AdminSetSupportAgentInput } from './dto/admin-set-support-agent.input';
import { AdminUpsertSupportWorkspaceConfigInput } from './dto/admin-upsert-support-workspace-config.input';
import { ReplySupportConversationInput } from './dto/reply-support-conversation.input';
import { ResolveSupportConversationInput } from './dto/resolve-support-conversation.input';
import { SendSupportMessageInput } from './dto/send-support-message.input';
import { SetSupportConversationInternalNoteInput } from './dto/set-support-conversation-internal-note.input';
import { SetSupportConversationTriageInput } from './dto/set-support-conversation-triage.input';
import { SupportAgent } from './dto/support-agent.dto';
import { SupportConversationAuditAction } from './dto/support-conversation-audit-action.enum';
import { SupportConversationAuditPage } from './dto/support-conversation-audit-page.dto';
import { SupportConversationAudit } from './dto/support-conversation-audit.dto';
import { SupportConversationListInput } from './dto/support-conversation-list.input';
import { SupportConversationPage } from './dto/support-conversation-page.dto';
import { SupportConversationPriority } from './dto/support-conversation-priority.enum';
import { SupportConversationSlaStatus } from './dto/support-conversation-sla-status.enum';
import { SupportConversationStatus } from './dto/support-conversation-status.enum';
import { SupportConversation } from './dto/support-conversation.dto';
import { SupportConversationWorkspaceMeta } from './dto/support-conversation-workspace-meta.dto';
import { SupportIntakeConfig } from './dto/support-intake-config.dto';
import { SupportWorkspaceConfig } from './dto/support-workspace-config.dto';
import { SupportMessage } from './dto/support-message.dto';
import { SupportSenderRole } from './dto/support-sender-role.enum';
import { SupportWorkspaceTemplate } from './dto/support-workspace-template.dto';

type SupportConversationRecord = Omit<SupportConversation, 'messages'> & {
  entityType: 'SUPPORT_CONVERSATION';
  priority?: SupportConversationPriority;
  isAssigned?: boolean;
};

type SupportMessageRecord = SupportMessage & {
  entityType: 'SUPPORT_MESSAGE';
};

type SupportConversationAuditRecord = {
  entityType: 'SUPPORT_CONVERSATION_AUDIT';
  id: string;
  conversationId: string;
  action: SupportConversationAuditAction;
  actor: string;
  summary: string;
  messagePreview?: string;
  priority?: SupportConversationPriority;
  tags?: string[];
  assignedAgentId?: string;
  closeReason?: string;
  reopenedFromStatus?: SupportConversationStatus;
  createdAt: string;
};

type SupportConversationMetaRecord = {
  entityType: 'SUPPORT_CONVERSATION_META';
  conversationId: string;
  internalNote?: string;
  priority?: SupportConversationPriority;
  tags?: string[];
  closeReason?: string;
  closedAt?: string;
  closedBy?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
};

type LegacySupportAgentRecord = Omit<SupportAgent, 'openConversationCount'> & {
  entityType: 'SUPPORT_AGENT';
};

type SupportAgentStateRecord = {
  entityType: 'SUPPORT_AGENT_STATE';
  userId: string;
  isActive: boolean;
  lastAssignedAt?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
};

type SupportAgentRecord = Omit<SupportAgent, 'openConversationCount'>;

type SupportWorkspaceTemplateRecord = SupportWorkspaceTemplate;

type SupportWorkspaceConfigRecord = {
  entityType: 'SUPPORT_WORKSPACE_CONFIG';
  key: 'default';
  issueStarters: SupportWorkspaceTemplateRecord[];
  quickReplyTemplates: SupportWorkspaceTemplateRecord[];
  commonTags: string[];
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
};

type SearchJsonRow = {
  key: string;
  value: unknown;
  created_at?: Date;
  updated_at?: Date;
};

const SUPPORT_SEARCH_BATCH_SIZE = 200;
const SUPPORT_MAX_PAGE_LIMIT = 100;
const SUPPORT_DEFAULT_PAGE_LIMIT = 20;
const SUPPORT_MAX_MESSAGE_LENGTH = 2000;
const SUPPORT_MAX_INTERNAL_NOTE_LENGTH = 2000;
const SUPPORT_MAX_CLOSE_REASON_LENGTH = 500;
const SUPPORT_MAX_TAGS = 8;
const SUPPORT_MAX_TAG_LENGTH = 32;
const SUPPORT_DEFAULT_PRIORITY = SupportConversationPriority.NORMAL;
const SUPPORT_MAX_AUDIT_SUMMARY_LENGTH = 280;
const SUPPORT_MAX_WORKSPACE_TEMPLATE_COUNT = 12;
const SUPPORT_MAX_WORKSPACE_TEMPLATE_LABEL_LENGTH = 48;
const SUPPORT_MAX_WORKSPACE_TEMPLATE_CONTENT_LENGTH = 500;
const SUPPORT_CONVERSATION_PROJECTION_VERSION =
  'support_conversation_projection_v1';
const SUPPORT_CONVERSATION_PROJECTION_VERSION_KEY =
  'support_system:conversation_projection_version';
const SUPPORT_WORKSPACE_CONFIG_KEY = 'support_workspace_config:default';
const SUPPORT_DEFAULT_ISSUE_STARTERS: SupportWorkspaceTemplateRecord[] = [
  {
    label: 'Payment Question',
    content: 'I need help checking the payment status for my booking.',
  },
  {
    label: 'Booking Change',
    content: 'I need help changing the date or details of my booking.',
  },
  {
    label: 'Voucher Delivery',
    content: 'I have not received my voucher or confirmation details yet.',
  },
  {
    label: 'Cancellation Help',
    content:
      'I need help understanding the cancellation or refund status for my booking.',
  },
];
const SUPPORT_DEFAULT_QUICK_REPLY_TEMPLATES: SupportWorkspaceTemplateRecord[] =
  [
    {
      label: 'Checking Status',
      content:
        'Thanks for the update. I am checking the latest status with the operations team and will reply here shortly.',
    },
    {
      label: 'Need Booking Info',
      content:
        'Please share your booking ID and the travel date so I can verify the request details for you.',
    },
    {
      label: 'Payment Review',
      content:
        'We have received your payment question. I am verifying the payment status and transaction details now.',
    },
    {
      label: 'Escalated',
      content:
        'I have escalated this case internally for priority review. I will keep this thread updated as soon as I have confirmation.',
    },
  ];
const SUPPORT_DEFAULT_COMMON_TAGS = [
  'vip',
  'payment',
  'booking-change',
  'refund',
  'escalation',
  'urgent-docs',
  'follow-up',
];
const SUPPORT_PRIORITY_RESPONSE_MINUTES: Record<
  SupportConversationPriority,
  number
> = {
  [SupportConversationPriority.LOW]: 24 * 60,
  [SupportConversationPriority.NORMAL]: 8 * 60,
  [SupportConversationPriority.HIGH]: 2 * 60,
  [SupportConversationPriority.URGENT]: 30,
};
const SUPPORT_PRIORITY_DUE_SOON_MINUTES: Record<
  SupportConversationPriority,
  number
> = {
  [SupportConversationPriority.LOW]: 4 * 60,
  [SupportConversationPriority.NORMAL]: 2 * 60,
  [SupportConversationPriority.HIGH]: 30,
  [SupportConversationPriority.URGENT]: 10,
};
const supportConversationProjectionLockManager = new AsyncLockManager();

@Injectable()
export class SupportService {
  private readonly travelDB: PGKVDatabase;
  private readonly roleAccessService: RoleAccessService;

  constructor(private readonly dbService: DBService) {
    this.travelDB = this.dbService.getDBInstance('travel_kv');
    this.roleAccessService = new RoleAccessService(dbService);
  }

  async getMySupportConversation(userId: string): Promise<SupportConversation> {
    const normalizedUserId = this.requireText(userId, 'userId');
    const existing = await this.findConversationByUserId(normalizedUserId);

    if (!existing) {
      return this.buildDraftConversation(normalizedUserId);
    }

    const record = await this.markConversationReadForUser(existing);
    return this.toSupportConversation(record, true);
  }

  async getSupportIntakeConfig(): Promise<SupportIntakeConfig> {
    const record = await this.getSupportWorkspaceConfigRecordOrDefault();
    return this.toSupportIntakeConfig(record);
  }

  async getSupportWorkspaceConfig(
    user: Record<string, unknown>,
  ): Promise<SupportWorkspaceConfig> {
    await this.requireSupportWorkspaceAccess(user);
    const record = await this.getSupportWorkspaceConfigRecordOrDefault();
    return this.toSupportWorkspaceConfig(record);
  }

  async sendSupportMessage(
    userId: string,
    input: SendSupportMessageInput,
  ): Promise<SupportConversation> {
    const normalizedUserId = this.requireText(userId, 'userId');
    const content = this.requireMessageContent(input.content);
    let conversation = await this.ensureConversationForUser(normalizedUserId);
    const now = new Date().toISOString();
    const shouldClearClosedMeta =
      conversation.status === SupportConversationStatus.CLOSED;
    const shouldReopen =
      conversation.status === SupportConversationStatus.CLOSED ||
      conversation.status === SupportConversationStatus.RESOLVED;
    const auditWrites: Array<Promise<void>> = [];

    if (shouldReopen) {
      auditWrites.push(
        this.appendConversationAudit(conversation.id, {
          action: SupportConversationAuditAction.REOPENED,
          actor: `user:${normalizedUserId}`,
          summary: `Reopened conversation from ${conversation.status} after a new user message.`,
          reopenedFromStatus: conversation.status,
          createdAt: now,
        }),
      );
    }

    if (!conversation.assignedAgentId) {
      conversation = await this.autoAssignConversation(conversation, now);
    }

    const message = this.buildMessageRecord({
      conversationId: conversation.id,
      userId: normalizedUserId,
      senderUserId: normalizedUserId,
      senderRole: SupportSenderRole.USER,
      content,
      createdAt: now,
    });

    const updated: SupportConversationRecord = {
      ...conversation,
      status: conversation.assignedAgentId
        ? SupportConversationStatus.IN_PROGRESS
        : SupportConversationStatus.WAITING_AGENT,
      lastMessagePreview: this.buildMessagePreview(content),
      lastMessageAt: now,
      unreadForAgents: conversation.unreadForAgents + 1,
      unreadForUser: 0,
      updatedAt: now,
    };

    await Promise.all([
      this.travelDB.put(
        `support_conversation:${updated.id}`,
        this.withConversationDerivedFields(updated),
      ),
      this.travelDB.put(`support_message:${message.id}`, message),
      shouldClearClosedMeta
        ? this.clearConversationCloseContext(
            updated.id,
            `user:${normalizedUserId}`,
            now,
          )
        : Promise.resolve(),
      this.appendConversationAudit(updated.id, {
        action: SupportConversationAuditAction.USER_MESSAGE,
        actor: `user:${normalizedUserId}`,
        summary: 'User sent a new message.',
        messagePreview: updated.lastMessagePreview,
        createdAt: now,
      }),
      ...auditWrites,
    ]);

    return this.toSupportConversation(updated, true);
  }

  async getSupportConversationWorkspaceMeta(
    user: Record<string, unknown>,
    conversationId: string,
  ): Promise<SupportConversationWorkspaceMeta> {
    await this.requireSupportWorkspaceAccess(user);
    const record = await this.getConversationRecordById(conversationId);
    const meta = await this.getConversationMetaRecord(record.id);
    return this.toSupportConversationWorkspaceMeta(record, meta);
  }

  async getSupportConversationWorkspaceMetas(
    user: Record<string, unknown>,
    conversationIds: string[],
  ): Promise<SupportConversationWorkspaceMeta[]> {
    await this.requireSupportWorkspaceAccess(user);
    const normalizedIds = Array.from(
      new Set(
        conversationIds
          .map((value) => value?.trim() || '')
          .filter((value) => !!value),
      ),
    );

    const records = await Promise.all(
      normalizedIds.map((conversationId) =>
        this.getConversationRecordById(conversationId),
      ),
    );
    const metas = await Promise.all(
      records.map((record) => this.getConversationMetaRecord(record.id)),
    );

    return records.map((record, index) =>
      this.toSupportConversationWorkspaceMeta(record, metas[index]),
    );
  }

  async getSupportConversationAuditLogs(
    user: Record<string, unknown>,
    conversationId: string,
    options?: {
      page?: PageInput;
      actor?: string;
      action?: SupportConversationAuditAction;
    },
  ): Promise<SupportConversationAuditPage> {
    await this.requireSupportWorkspaceAccess(user);
    const record = await this.getConversationRecordById(conversationId);
    const limit = Math.min(
      Math.max(options?.page?.limit ?? SUPPORT_DEFAULT_PAGE_LIMIT, 1),
      SUPPORT_MAX_PAGE_LIMIT,
    );
    const offset = Math.max(options?.page?.offset ?? 0, 0);
    const page = await this.listConversationAuditRecordsPage(record.id, {
      actor: options?.actor,
      action: options?.action,
      limit,
      offset,
    });

    return {
      items: page.items.map((item) => this.toSupportConversationAudit(item)),
      total: page.total,
      limit,
      offset,
      hasMore: offset + page.items.length < page.total,
    };
  }

  async setSupportConversationInternalNote(
    user: Record<string, unknown>,
    input: SetSupportConversationInternalNoteInput,
  ): Promise<SupportConversationWorkspaceMeta> {
    const access = await this.requireSupportWorkspaceAccess(user);
    const conversationId = this.requireText(
      input.conversationId,
      'conversationId',
    );
    const record = await this.getConversationRecordById(conversationId);
    const existing = await this.getConversationMetaRecord(record.id);
    const now = new Date().toISOString();
    const internalNote = this.normalizeOptionalText(
      input.internalNote,
      'internalNote',
      SUPPORT_MAX_INTERNAL_NOTE_LENGTH,
    );

    if ((existing?.internalNote || undefined) === internalNote) {
      return this.toSupportConversationWorkspaceMeta(record, existing);
    }

    const updated = await this.upsertConversationMetaRecord(record.id, {
      existing,
      internalNote,
      priority: existing?.priority,
      tags: existing?.tags,
      closeReason: existing?.closeReason,
      closedAt: existing?.closedAt,
      closedBy: existing?.closedBy,
      updatedAt: now,
      updatedBy: access.actor,
    });
    await this.appendConversationAudit(record.id, {
      action: SupportConversationAuditAction.INTERNAL_NOTE_UPDATED,
      actor: access.actor,
      summary: internalNote
        ? 'Updated internal note.'
        : 'Cleared internal note.',
      createdAt: now,
    });

    await this.travelDB.put(
      `support_conversation:${record.id}`,
      this.withConversationDerivedFields(record),
    );

    return this.toSupportConversationWorkspaceMeta(record, updated);
  }

  async setSupportConversationTriage(
    user: Record<string, unknown>,
    input: SetSupportConversationTriageInput,
  ): Promise<SupportConversationWorkspaceMeta> {
    const access = await this.requireSupportWorkspaceAccess(user);
    const conversationId = this.requireText(
      input.conversationId,
      'conversationId',
    );
    const record = await this.getConversationRecordById(conversationId);
    const existing = await this.getConversationMetaRecord(record.id);
    const now = new Date().toISOString();
    const priority =
      input.priority ?? existing?.priority ?? SUPPORT_DEFAULT_PRIORITY;
    const tags =
      input.tags !== undefined
        ? this.normalizeTags(input.tags)
        : (existing?.tags ?? []);

    if (
      (existing?.priority ?? SUPPORT_DEFAULT_PRIORITY) === priority &&
      this.isSameTextArray(existing?.tags ?? [], tags)
    ) {
      return this.toSupportConversationWorkspaceMeta(record, existing);
    }

    const updated = await this.upsertConversationMetaRecord(record.id, {
      existing,
      internalNote: existing?.internalNote,
      priority,
      tags,
      closeReason: existing?.closeReason,
      closedAt: existing?.closedAt,
      closedBy: existing?.closedBy,
      updatedAt: now,
      updatedBy: access.actor,
    });
    await this.appendConversationAudit(record.id, {
      action: SupportConversationAuditAction.TRIAGE_UPDATED,
      actor: access.actor,
      summary: `Set priority to ${priority} with ${tags.length} tag${
        tags.length === 1 ? '' : 's'
      }.`,
      priority,
      tags,
      createdAt: now,
    });
    await this.travelDB.put(
      `support_conversation:${record.id}`,
      this.withConversationDerivedFields(record, {
        priority,
      }),
    );

    return this.toSupportConversationWorkspaceMeta(record, updated);
  }

  async getMySupportAgentProfile(userId: string): Promise<SupportAgent> {
    const record = await this.requireEnabledSupportAgentRecord(userId);
    const openConversationCounts = await this.countOpenConversationsByAgent();
    return this.toSupportAgent(
      record,
      openConversationCounts.get(record.userId) ?? 0,
    );
  }

  async setMySupportAgentActive(
    userId: string,
    isActive: boolean,
  ): Promise<SupportAgent> {
    const record = await this.requireEnabledSupportAgentRecord(userId);
    const existingState = await this.getSupportAgentStateRecord(record.userId);
    const now = new Date().toISOString();
    const updatedState: SupportAgentStateRecord = {
      entityType: 'SUPPORT_AGENT_STATE',
      userId: record.userId,
      isActive,
      lastAssignedAt: existingState?.lastAssignedAt ?? record.lastAssignedAt,
      createdAt: existingState?.createdAt ?? record.createdAt,
      updatedAt: now,
      updatedBy: `support_agent:${record.userId}`,
    };

    await this.travelDB.put(
      `support_agent_state:${updatedState.userId}`,
      updatedState,
    );

    if (isActive) {
      await this.autoAssignWaitingConversations();
    }

    const openConversationCounts = await this.countOpenConversationsByAgent();
    return this.toSupportAgent(
      this.mergeSupportAgentRecord(record, updatedState),
      openConversationCounts.get(record.userId) ?? 0,
    );
  }

  async listSupportConversationsForAgent(
    userId: string,
    input?: SupportConversationListInput,
  ): Promise<SupportConversationPage> {
    await this.requireEnabledSupportAgentRecord(userId);
    return this.listSupportConversationsInternal(input, userId);
  }

  async getSupportConversationDetailForAgent(
    userId: string,
    conversationId: string,
  ): Promise<SupportConversation> {
    await this.requireEnabledSupportAgentRecord(userId);
    const record = await this.getConversationRecordById(conversationId);
    const updated = await this.markConversationReadForAgents(record);
    return this.toSupportConversation(updated, true);
  }

  async replySupportConversation(
    userId: string,
    input: ReplySupportConversationInput,
  ): Promise<SupportConversation> {
    const agentRecord = await this.requireEnabledSupportAgentRecord(userId);

    const conversationId = this.requireText(
      input.conversationId,
      'conversationId',
    );
    const content = this.requireMessageContent(input.content);
    const record = await this.getConversationRecordById(conversationId);
    const now = new Date().toISOString();
    const assignedAgentId = record.assignedAgentId || userId;
    const shouldClearClosedMeta =
      record.status === SupportConversationStatus.CLOSED;
    const shouldReopen =
      record.status === SupportConversationStatus.CLOSED ||
      record.status === SupportConversationStatus.RESOLVED;
    const auditWrites: Array<Promise<void>> = [];

    if (shouldReopen) {
      auditWrites.push(
        this.appendConversationAudit(record.id, {
          action: SupportConversationAuditAction.REOPENED,
          actor: `support_agent:${agentRecord.userId}`,
          summary: `Reopened conversation from ${record.status} during agent follow-up.`,
          reopenedFromStatus: record.status,
          createdAt: now,
        }),
      );
    }

    const message = this.buildMessageRecord({
      conversationId: record.id,
      userId: record.userId,
      senderUserId: userId,
      senderRole: SupportSenderRole.SUPPORT_AGENT,
      content,
      createdAt: now,
    });

    const updated: SupportConversationRecord = {
      ...record,
      assignedAgentId,
      sharedAgentIds: this.mergeSharedAgentIds(
        record.sharedAgentIds,
        assignedAgentId,
        userId,
      ),
      status: SupportConversationStatus.WAITING_USER,
      lastMessagePreview: this.buildMessagePreview(content),
      lastMessageAt: now,
      unreadForAgents: 0,
      unreadForUser: record.unreadForUser + 1,
      updatedAt: now,
    };

    await Promise.all([
      this.travelDB.put(
        `support_conversation:${updated.id}`,
        this.withConversationDerivedFields(updated),
      ),
      this.travelDB.put(`support_message:${message.id}`, message),
      this.touchSupportAgentAssignment(assignedAgentId, now),
      shouldClearClosedMeta
        ? this.clearConversationCloseContext(
            updated.id,
            `support_agent:${agentRecord.userId}`,
            now,
          )
        : Promise.resolve(),
      this.appendConversationAudit(updated.id, {
        action: SupportConversationAuditAction.AGENT_REPLY,
        actor: `support_agent:${agentRecord.userId}`,
        summary: 'Support agent replied.',
        messagePreview: updated.lastMessagePreview,
        createdAt: now,
      }),
      ...auditWrites,
    ]);

    return this.toSupportConversation(updated, true);
  }

  async resolveSupportConversation(
    user: Record<string, unknown>,
    input: ResolveSupportConversationInput,
  ): Promise<SupportConversation> {
    const access = await this.requireSupportWorkspaceAccess(user);
    const conversationId = this.requireText(
      input.conversationId,
      'conversationId',
    );
    const record = await this.getConversationRecordById(conversationId);

    if (record.status === SupportConversationStatus.CLOSED) {
      throw new BadRequestException(
        'Closed conversation must be reopened by a new message before it can be resolved',
      );
    }

    if (record.status === SupportConversationStatus.RESOLVED) {
      return this.toSupportConversation(record, true);
    }

    const now = new Date().toISOString();
    const updated: SupportConversationRecord = {
      ...record,
      status: SupportConversationStatus.RESOLVED,
      unreadForAgents: 0,
      updatedAt: now,
    };

    await Promise.all([
      this.travelDB.put(
        `support_conversation:${updated.id}`,
        this.withConversationDerivedFields(updated),
      ),
      this.appendConversationAudit(updated.id, {
        action: SupportConversationAuditAction.RESOLVED,
        actor: access.actor,
        summary: 'Marked conversation as resolved.',
        createdAt: now,
      }),
    ]);

    return this.toSupportConversation(updated, true);
  }

  async adminListSupportConversations(
    input?: SupportConversationListInput,
  ): Promise<SupportConversationPage> {
    return this.listSupportConversationsInternal(input);
  }

  async adminGetSupportConversation(
    conversationId: string,
  ): Promise<SupportConversation> {
    return this.getSupportConversationDetailInternal(conversationId);
  }

  async adminListSupportAgents(): Promise<SupportAgent[]> {
    const records = await this.listSupportAgentRecords();
    const openConversationCounts = await this.countOpenConversationsByAgent();

    return records
      .sort((left, right) => left.userId.localeCompare(right.userId))
      .map((record) =>
        this.toSupportAgent(
          record,
          openConversationCounts.get(record.userId) ?? 0,
        ),
      );
  }

  async adminUpsertSupportWorkspaceConfig(
    input: AdminUpsertSupportWorkspaceConfigInput,
    user?: Record<string, unknown>,
  ): Promise<SupportWorkspaceConfig> {
    const actor = await this.requireAdminActor(user);
    const existing = await this.getStoredSupportWorkspaceConfigRecord();
    const now = new Date().toISOString();
    const record: SupportWorkspaceConfigRecord = {
      entityType: 'SUPPORT_WORKSPACE_CONFIG',
      key: 'default',
      issueStarters: this.normalizeSupportWorkspaceTemplates(
        input.issueStarters,
        'issueStarters',
      ),
      quickReplyTemplates: this.normalizeSupportWorkspaceTemplates(
        input.quickReplyTemplates,
        'quickReplyTemplates',
      ),
      commonTags: this.normalizeTags(input.commonTags),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      updatedBy: actor,
    };

    await this.travelDB.put(SUPPORT_WORKSPACE_CONFIG_KEY, record);
    return this.toSupportWorkspaceConfig(record);
  }

  async adminSetSupportAgent(
    input: AdminSetSupportAgentInput,
    actorUser?: Record<string, unknown>,
  ): Promise<SupportAgent> {
    const userId = this.requireText(input.userId, 'userId');
    const existing = await this.getSupportAgentRecord(userId);
    const existingState = await this.getSupportAgentStateRecord(userId);
    const now = new Date().toISOString();
    const accessEntry = await this.roleAccessService.setRoleAccess(
      'SUPPORT_AGENT',
      {
        userId,
        email: input.email,
        displayName: input.displayName,
        note: input.note,
        enabled: input.enabled,
      },
      actorUser,
      {
        requireUserId: true,
      },
    );

    const updatedState: SupportAgentStateRecord = {
      entityType: 'SUPPORT_AGENT_STATE',
      userId,
      isActive: accessEntry.enabled
        ? (input.isActive ??
          existingState?.isActive ??
          existing?.isActive ??
          false)
        : false,
      lastAssignedAt: existingState?.lastAssignedAt ?? existing?.lastAssignedAt,
      createdAt: existingState?.createdAt ?? existing?.createdAt ?? now,
      updatedAt: now,
      updatedBy: accessEntry.updatedBy,
    };

    await this.travelDB.put(`support_agent_state:${userId}`, updatedState);

    if (!accessEntry.enabled) {
      await this.unassignConversationsForAgent(
        userId,
        accessEntry.updatedBy || 'admin:system',
      );
    }

    if (!accessEntry.enabled || updatedState.isActive) {
      await this.autoAssignWaitingConversations();
    }

    const openConversationCounts = await this.countOpenConversationsByAgent();
    return this.toSupportAgent(
      this.mergeSupportAgentRecord(
        this.mergeSupportAgentRecordFromEntry(
          accessEntry,
          existingState || undefined,
        ),
        updatedState,
      ),
      openConversationCounts.get(userId) ?? 0,
    );
  }

  async adminAssignSupportConversation(
    input: AdminAssignSupportConversationInput,
    user?: Record<string, unknown>,
  ): Promise<SupportConversation> {
    const conversationId = this.requireText(
      input.conversationId,
      'conversationId',
    );
    const agentUserId = this.requireText(input.agentUserId, 'agentUserId');
    const actor = await this.requireAdminActor(user);
    const agentRecord =
      await this.requireEnabledSupportAgentRecord(agentUserId);
    const record = await this.getConversationRecordById(conversationId);

    if (record.assignedAgentId === agentRecord.userId) {
      return this.toSupportConversation(record, true);
    }

    const now = new Date().toISOString();

    const updated: SupportConversationRecord = {
      ...record,
      assignedAgentId: agentRecord.userId,
      sharedAgentIds: this.mergeSharedAgentIds(
        record.sharedAgentIds,
        agentRecord.userId,
      ),
      status:
        record.lastMessageAt &&
        record.status === SupportConversationStatus.WAITING_AGENT
          ? SupportConversationStatus.IN_PROGRESS
          : record.status,
      updatedAt: now,
    };

    await Promise.all([
      this.travelDB.put(
        `support_conversation:${updated.id}`,
        this.withConversationDerivedFields(updated),
      ),
      this.touchSupportAgentAssignment(agentRecord.userId, now),
      this.appendConversationAudit(updated.id, {
        action: SupportConversationAuditAction.ASSIGNED,
        actor,
        summary: `Assigned conversation to ${agentRecord.userId}.`,
        assignedAgentId: agentRecord.userId,
        createdAt: now,
      }),
    ]);

    return this.toSupportConversation(updated, true);
  }

  async adminCloseSupportConversation(
    input: AdminCloseSupportConversationInput,
    user?: Record<string, unknown>,
  ): Promise<SupportConversation> {
    const conversationId = this.requireText(
      input.conversationId,
      'conversationId',
    );
    const actor = await this.requireAdminActor(user);
    const record = await this.getConversationRecordById(conversationId);
    const existingMeta = await this.getConversationMetaRecord(record.id);
    const now = new Date().toISOString();
    const closeReason = this.normalizeOptionalText(
      input.closeReason,
      'closeReason',
      SUPPORT_MAX_CLOSE_REASON_LENGTH,
    );

    if (
      record.status === SupportConversationStatus.CLOSED &&
      (existingMeta?.closeReason || undefined) === closeReason
    ) {
      return this.toSupportConversation(record, true);
    }

    const updated: SupportConversationRecord = {
      ...record,
      status: SupportConversationStatus.CLOSED,
      unreadForAgents: 0,
      updatedAt: now,
    };

    await Promise.all([
      this.travelDB.put(
        `support_conversation:${updated.id}`,
        this.withConversationDerivedFields(updated),
      ),
      this.upsertConversationMetaRecord(record.id, {
        existing: existingMeta,
        internalNote: existingMeta?.internalNote,
        priority: existingMeta?.priority,
        tags: existingMeta?.tags,
        closeReason,
        closedAt: now,
        closedBy: actor,
        updatedAt: now,
        updatedBy: actor,
      }),
      this.appendConversationAudit(record.id, {
        action: SupportConversationAuditAction.CLOSED,
        actor,
        summary: closeReason
          ? `Closed conversation: ${closeReason}`
          : 'Closed conversation.',
        closeReason,
        createdAt: now,
      }),
    ]);

    return this.toSupportConversation(updated, true);
  }

  private async listSupportConversationsInternal(
    input?: SupportConversationListInput,
    viewerAgentId?: string,
  ): Promise<SupportConversationPage> {
    const limit = Math.min(
      Math.max(input?.page?.limit ?? SUPPORT_DEFAULT_PAGE_LIMIT, 1),
      SUPPORT_MAX_PAGE_LIMIT,
    );
    const offset = Math.max(input?.page?.offset ?? 0, 0);
    const conversationId = input?.conversationId?.trim();
    const userId = input?.userId?.trim();
    const assignedAgentId = input?.assignedAgentId?.trim();
    const onlyMine = !!input?.onlyMine;
    const unassignedOnly = !!input?.unassignedOnly;
    const hasUnreadForUser = input?.hasUnreadForUser;
    const hasUnreadForAgents = input?.hasUnreadForAgents;
    const priority = input?.priority;

    if (priority || unassignedOnly) {
      await this.ensureSupportConversationProjection();
    }

    const page = await this.searchSupportConversationRecordPage({
      conversationId,
      userId,
      assignedAgentId,
      status: input?.status,
      onlyMine,
      unassignedOnly,
      priority,
      viewerAgentId,
      hasUnreadForUser,
      hasUnreadForAgents,
      limit,
      offset,
    });
    const items = await Promise.all(
      page.records.map((record) => this.toSupportConversation(record, false)),
    );

    return {
      items,
      total: page.total,
      limit,
      offset,
      hasMore: offset + items.length < page.total,
    };
  }

  private async getSupportConversationDetailInternal(
    conversationId: string,
  ): Promise<SupportConversation> {
    const record = await this.getConversationRecordById(conversationId);
    return this.toSupportConversation(record, true);
  }

  private async getStoredSupportWorkspaceConfigRecord(): Promise<SupportWorkspaceConfigRecord | null> {
    const value = await this.travelDB.get<unknown>(
      SUPPORT_WORKSPACE_CONFIG_KEY,
    );
    return this.toSupportWorkspaceConfigRecord(value);
  }

  private async getSupportWorkspaceConfigRecordOrDefault(): Promise<SupportWorkspaceConfigRecord> {
    return (
      (await this.getStoredSupportWorkspaceConfigRecord()) ??
      this.buildDefaultSupportWorkspaceConfigRecord()
    );
  }

  private buildDefaultSupportWorkspaceConfigRecord(): SupportWorkspaceConfigRecord {
    return {
      entityType: 'SUPPORT_WORKSPACE_CONFIG',
      key: 'default',
      issueStarters: this.cloneSupportWorkspaceTemplates(
        SUPPORT_DEFAULT_ISSUE_STARTERS,
      ),
      quickReplyTemplates: this.cloneSupportWorkspaceTemplates(
        SUPPORT_DEFAULT_QUICK_REPLY_TEMPLATES,
      ),
      commonTags: [...SUPPORT_DEFAULT_COMMON_TAGS],
    };
  }

  private async getConversationMetaRecord(
    conversationId: string,
  ): Promise<SupportConversationMetaRecord | null> {
    const value = await this.travelDB.get<unknown>(
      `support_conversation_meta:${conversationId}`,
    );
    return this.toSupportConversationMetaRecord(value);
  }

  private async listConversationMetaRecordsById(): Promise<
    Map<string, SupportConversationMetaRecord>
  > {
    const result = await this.travelDB.getWithPrefix<unknown>(
      'support_conversation_meta:',
    );
    const map = new Map<string, SupportConversationMetaRecord>();

    for (const value of Object.values(result)) {
      const record = this.toSupportConversationMetaRecord(value);
      if (record) {
        map.set(record.conversationId, record);
      }
    }

    return map;
  }

  private async listConversationAuditRecords(
    conversationId: string,
    filters?: {
      actor?: string;
      action?: SupportConversationAuditAction;
    },
  ): Promise<SupportConversationAuditRecord[]> {
    const page = await this.listConversationAuditRecordsPage(conversationId, {
      actor: filters?.actor,
      action: filters?.action,
      limit: SUPPORT_SEARCH_BATCH_SIZE,
      offset: 0,
      loadAll: true,
    });

    return page.items.sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  }

  private async listConversationAuditRecordsPage(
    conversationId: string,
    options: {
      actor?: string;
      action?: SupportConversationAuditAction;
      limit: number;
      offset: number;
      loadAll?: boolean;
    },
  ): Promise<{
    items: SupportConversationAuditRecord[];
    total: number;
  }> {
    const actor = options.actor?.trim();
    const contains: Record<string, unknown> = {
      entityType: 'SUPPORT_CONVERSATION_AUDIT',
      conversationId,
    };

    if (options.action) {
      contains.action = options.action;
    }

    if (options.loadAll) {
      const result = await this.searchAllJsonRows({
        contains,
        order_by: 'DESC',
        order_by_field: 'created_at',
      });

      const items = result
        .map((row) => this.toSupportConversationAuditRecord(row.value))
        .filter((row): row is SupportConversationAuditRecord => row !== null)
        .filter((row) => {
          if (!actor) {
            return true;
          }

          return row.actor.toLowerCase().includes(actor.toLowerCase());
        });

      return {
        items,
        total: items.length,
      };
    }

    const result = await this.travelDB.searchJson({
      contains,
      text_search: actor
        ? [
            {
              path: 'actor',
              text: actor,
              case_sensitive: false,
            },
          ]
        : undefined,
      limit: options.limit,
      offset: options.offset,
      include_total: true,
      order_by: 'DESC',
      order_by_field: 'created_at',
    });

    const items = (result.data as SearchJsonRow[])
      .map((row) => this.toSupportConversationAuditRecord(row.value))
      .filter((row): row is SupportConversationAuditRecord => row !== null)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    return {
      items,
      total: result.total ?? items.length,
    };
  }

  private async appendConversationAudit(
    conversationId: string,
    input: {
      action: SupportConversationAuditAction;
      actor: string;
      summary: string;
      messagePreview?: string;
      priority?: SupportConversationPriority;
      tags?: string[];
      assignedAgentId?: string;
      closeReason?: string;
      reopenedFromStatus?: SupportConversationStatus;
      createdAt: string;
    },
  ): Promise<void> {
    const record: SupportConversationAuditRecord = {
      entityType: 'SUPPORT_CONVERSATION_AUDIT',
      id: this.generateAuditId(),
      conversationId,
      action: input.action,
      actor: this.requireText(input.actor, 'actor'),
      summary: this.normalizeAuditSummary(input.summary),
      messagePreview: input.messagePreview,
      priority: input.priority,
      tags: input.tags ? [...input.tags] : [],
      assignedAgentId: input.assignedAgentId,
      closeReason: input.closeReason,
      reopenedFromStatus: input.reopenedFromStatus,
      createdAt: input.createdAt,
    };

    await this.travelDB.put(`support_conversation_audit:${record.id}`, record);
  }

  private async upsertConversationMetaRecord(
    conversationId: string,
    input: {
      existing?: SupportConversationMetaRecord | null;
      internalNote?: string;
      priority?: SupportConversationPriority;
      tags?: string[];
      closeReason?: string;
      closedAt?: string;
      closedBy?: string;
      updatedAt: string;
      updatedBy?: string;
    },
  ): Promise<SupportConversationMetaRecord> {
    const existing = input.existing || undefined;
    const record: SupportConversationMetaRecord = {
      entityType: 'SUPPORT_CONVERSATION_META',
      conversationId,
      internalNote: input.internalNote,
      priority: input.priority,
      tags: input.tags ? [...input.tags] : [],
      closeReason: input.closeReason,
      closedAt: input.closedAt,
      closedBy: input.closedBy,
      createdAt: existing?.createdAt ?? input.updatedAt,
      updatedAt: input.updatedAt,
      updatedBy: input.updatedBy,
    };

    await this.travelDB.put(
      `support_conversation_meta:${conversationId}`,
      record,
    );
    return record;
  }

  private async clearConversationCloseContext(
    conversationId: string,
    actor: string,
    updatedAt: string,
  ): Promise<void> {
    const existing = await this.getConversationMetaRecord(conversationId);
    if (!existing?.closeReason && !existing?.closedAt && !existing?.closedBy) {
      return;
    }

    await this.upsertConversationMetaRecord(conversationId, {
      existing,
      internalNote: existing.internalNote,
      priority: existing.priority,
      tags: existing.tags,
      closeReason: undefined,
      closedAt: undefined,
      closedBy: undefined,
      updatedAt,
      updatedBy: actor,
    });
  }

  private async ensureConversationForUser(
    userId: string,
  ): Promise<SupportConversationRecord> {
    const existing = await this.findConversationByUserId(userId);
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const record: SupportConversationRecord = {
      entityType: 'SUPPORT_CONVERSATION',
      id: this.buildConversationId(userId),
      userId,
      assignedAgentId: undefined,
      sharedAgentIds: [],
      status: SupportConversationStatus.WAITING_AGENT,
      lastMessagePreview: undefined,
      lastMessageAt: undefined,
      unreadForUser: 0,
      unreadForAgents: 0,
      priority: SUPPORT_DEFAULT_PRIORITY,
      isAssigned: false,
      createdAt: now,
      updatedAt: now,
    };

    await this.travelDB.put(
      `support_conversation:${record.id}`,
      this.withConversationDerivedFields(record, {
        priority: SUPPORT_DEFAULT_PRIORITY,
      }),
    );
    return record;
  }

  private async findConversationByUserId(
    userId: string,
  ): Promise<SupportConversationRecord | null> {
    const result = await this.travelDB.searchJson({
      contains: {
        entityType: 'SUPPORT_CONVERSATION',
        userId,
      },
      limit: 1,
      order_by: 'DESC',
      order_by_field: 'created_at',
    });

    const rows = result.data as SearchJsonRow[];
    if (rows.length === 0) {
      return null;
    }

    return this.toSupportConversationRecord(rows[0].value);
  }

  private async listSupportConversationRecords(): Promise<
    SupportConversationRecord[]
  > {
    const result = await this.searchAllJsonRows({
      contains: {
        entityType: 'SUPPORT_CONVERSATION',
      },
      order_by: 'DESC',
      order_by_field: 'created_at',
    });

    return result
      .map((row) => this.toSupportConversationRecord(row.value))
      .filter((row): row is SupportConversationRecord => row !== null);
  }

  private async ensureSupportConversationProjection(): Promise<void> {
    const currentVersion = await this.travelDB.get<string>(
      SUPPORT_CONVERSATION_PROJECTION_VERSION_KEY,
    );
    if (currentVersion === SUPPORT_CONVERSATION_PROJECTION_VERSION) {
      return;
    }

    const release = await supportConversationProjectionLockManager.acquireLock(
      'support:conversation_projection',
    );

    try {
      const lockedVersion = await this.travelDB.get<string>(
        SUPPORT_CONVERSATION_PROJECTION_VERSION_KEY,
      );
      if (lockedVersion === SUPPORT_CONVERSATION_PROJECTION_VERSION) {
        return;
      }

      const [records, metasByConversationId] = await Promise.all([
        this.listSupportConversationRecords(),
        this.listConversationMetaRecordsById(),
      ]);

      const writes: Array<Promise<void>> = [];

      for (const record of records) {
        const projected = this.withConversationDerivedFields(record, {
          priority:
            metasByConversationId.get(record.id)?.priority ?? record.priority,
        });

        if (this.hasSameConversationDerivedFields(record, projected)) {
          continue;
        }

        writes.push(
          this.travelDB.put(`support_conversation:${projected.id}`, projected),
        );
      }

      await Promise.all(writes);
      await this.travelDB.put(
        SUPPORT_CONVERSATION_PROJECTION_VERSION_KEY,
        SUPPORT_CONVERSATION_PROJECTION_VERSION,
      );
    } finally {
      release();
    }
  }

  private async searchSupportConversationRecordPage(params: {
    conversationId?: string;
    userId?: string;
    assignedAgentId?: string;
    status?: SupportConversationStatus;
    onlyMine: boolean;
    unassignedOnly: boolean;
    priority?: SupportConversationPriority;
    viewerAgentId?: string;
    hasUnreadForUser?: boolean;
    hasUnreadForAgents?: boolean;
    limit: number;
    offset: number;
  }): Promise<{
    records: SupportConversationRecord[];
    total: number;
  }> {
    const contains: Record<string, unknown> = {
      entityType: 'SUPPORT_CONVERSATION',
    };
    const compare: Array<{
      path: string;
      operator: '>' | '<' | '>=' | '<=' | '=' | '!=';
      value: number | string | Date;
    }> = [];

    if (
      params.assignedAgentId &&
      params.onlyMine &&
      params.viewerAgentId &&
      params.assignedAgentId !== params.viewerAgentId
    ) {
      return {
        records: [],
        total: 0,
      };
    }

    if (
      (params.unassignedOnly && params.assignedAgentId) ||
      (params.unassignedOnly && params.onlyMine && params.viewerAgentId)
    ) {
      return {
        records: [],
        total: 0,
      };
    }

    if (params.conversationId) {
      contains.id = params.conversationId;
    }

    if (params.userId) {
      contains.userId = params.userId;
    }

    if (params.status) {
      contains.status = params.status;
    }

    if (params.priority) {
      contains.priority = params.priority;
    }

    if (params.assignedAgentId) {
      contains.assignedAgentId = params.assignedAgentId;
    } else if (params.onlyMine && params.viewerAgentId) {
      contains.assignedAgentId = params.viewerAgentId;
    }

    if (params.unassignedOnly) {
      contains.isAssigned = false;
    }

    if (typeof params.hasUnreadForUser === 'boolean') {
      compare.push({
        path: 'unreadForUser',
        operator: params.hasUnreadForUser ? '>' : '=',
        value: 0,
      });
    }

    if (typeof params.hasUnreadForAgents === 'boolean') {
      compare.push({
        path: 'unreadForAgents',
        operator: params.hasUnreadForAgents ? '>' : '=',
        value: 0,
      });
    }

    if (!params.conversationId && !params.userId) {
      compare.push({
        path: 'lastMessageAt',
        operator: '!=',
        value: '',
      });
    }

    const result = await this.travelDB.searchJson({
      contains,
      compare: compare.length > 0 ? compare : undefined,
      limit: params.limit,
      offset: params.offset,
      include_total: true,
      order_by: 'DESC',
      order_by_field: 'updated_at',
    });

    const records = (result.data as SearchJsonRow[])
      .map((row) => this.toSupportConversationRecord(row.value))
      .filter((row): row is SupportConversationRecord => row !== null);

    return {
      records,
      total: result.total ?? records.length,
    };
  }

  private async listSupportAgentRecords(): Promise<SupportAgentRecord[]> {
    const accessEntries = (
      await this.roleAccessService.listRoleEntries('SUPPORT_AGENT')
    ).filter((entry) => !!entry.userId);
    const statesByUserId = await this.listSupportAgentStatesByUserId();

    return accessEntries
      .map((entry) =>
        this.mergeSupportAgentRecordFromEntry(
          entry,
          statesByUserId.get(entry.userId || ''),
        ),
      )
      .sort((left, right) => left.userId.localeCompare(right.userId));
  }

  private async getSupportAgentRecord(
    userId: string,
  ): Promise<SupportAgentRecord | null> {
    const accessEntry = await this.roleAccessService.getRoleEntryByUserId(
      'SUPPORT_AGENT',
      userId,
    );

    if (!accessEntry?.userId) {
      return null;
    }

    const state = await this.getSupportAgentStateRecord(accessEntry.userId);
    return this.mergeSupportAgentRecordFromEntry(
      accessEntry,
      state || undefined,
    );
  }

  private async requireEnabledSupportAgentRecord(
    userId: string,
  ): Promise<SupportAgentRecord> {
    const normalizedUserId = this.requireText(userId, 'userId');
    const record = await this.getSupportAgentRecord(normalizedUserId);

    if (!record?.enabled) {
      throw new ForbiddenException(
        `Support access denied for user ${normalizedUserId}`,
      );
    }

    return record;
  }

  private async listSupportAgentStatesByUserId(): Promise<
    Map<string, SupportAgentStateRecord>
  > {
    const states = new Map<string, SupportAgentStateRecord>();

    for (const legacy of await this.listLegacySupportAgentRecords()) {
      const legacyState = this.toSupportAgentStateRecord(legacy);
      if (legacyState) {
        states.set(legacy.userId, legacyState);
      }
    }

    const result = await this.travelDB.getWithPrefix<unknown>(
      'support_agent_state:',
    );
    for (const value of Object.values(result)) {
      const state = this.normalizeStoredSupportAgentStateRecord(value);
      if (state) {
        states.set(state.userId, state);
      }
    }

    return states;
  }

  private async getSupportAgentStateRecord(
    userId: string,
  ): Promise<SupportAgentStateRecord | null> {
    const current = await this.travelDB.get<unknown>(
      `support_agent_state:${userId}`,
    );
    const state = this.toSupportAgentStateRecord(current);
    if (state) {
      return state;
    }

    const legacy = await this.getLegacySupportAgentRecord(userId);
    return legacy ? this.toSupportAgentStateRecord(legacy) : null;
  }

  private async listLegacySupportAgentRecords(): Promise<
    LegacySupportAgentRecord[]
  > {
    const result = await this.travelDB.getWithPrefix<unknown>('support_agent:');
    return Object.values(result)
      .map((value) => this.normalizeLegacySupportAgentRecord(value))
      .filter((value): value is LegacySupportAgentRecord => !!value);
  }

  private async getLegacySupportAgentRecord(
    userId: string,
  ): Promise<LegacySupportAgentRecord | null> {
    const value = await this.travelDB.get<unknown>(`support_agent:${userId}`);
    return this.normalizeLegacySupportAgentRecord(value);
  }

  private async getConversationRecordById(
    conversationId: string,
  ): Promise<SupportConversationRecord> {
    const normalizedId = this.requireText(conversationId, 'conversationId');
    const value = await this.travelDB.get<SupportConversationRecord>(
      `support_conversation:${normalizedId}`,
    );
    const record = this.toSupportConversationRecord(value);

    if (!record) {
      throw new NotFoundException(
        `Support conversation ${normalizedId} not found`,
      );
    }

    return record;
  }

  private async listMessagesForConversation(
    conversationId: string,
  ): Promise<SupportMessage[]> {
    const result = await this.searchAllJsonRows({
      contains: {
        entityType: 'SUPPORT_MESSAGE',
        conversationId,
      },
      order_by: 'ASC',
      order_by_field: 'created_at',
    });

    return result
      .map((row) => this.toSupportMessageRecord(row.value))
      .filter((row): row is SupportMessageRecord => row !== null)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map((record) => this.toSupportMessage(record));
  }

  private async toSupportConversation(
    record: SupportConversationRecord,
    includeMessages: boolean,
  ): Promise<SupportConversation> {
    return {
      id: record.id,
      userId: record.userId,
      assignedAgentId: record.assignedAgentId,
      sharedAgentIds: [...record.sharedAgentIds],
      status: record.status,
      lastMessagePreview: record.lastMessagePreview,
      lastMessageAt: record.lastMessageAt,
      unreadForUser: record.unreadForUser,
      unreadForAgents: record.unreadForAgents,
      messages: includeMessages
        ? await this.listMessagesForConversation(record.id)
        : [],
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private buildDraftConversation(userId: string): SupportConversation {
    const now = new Date().toISOString();
    return {
      id: `draft_${userId}`,
      userId,
      assignedAgentId: undefined,
      sharedAgentIds: [],
      status: SupportConversationStatus.WAITING_AGENT,
      lastMessagePreview: undefined,
      lastMessageAt: undefined,
      unreadForUser: 0,
      unreadForAgents: 0,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  private async markConversationReadForUser(
    record: SupportConversationRecord,
  ): Promise<SupportConversationRecord> {
    if (record.unreadForUser === 0) {
      return record;
    }

    const updated: SupportConversationRecord = {
      ...record,
      unreadForUser: 0,
    };

    await this.travelDB.put(
      `support_conversation:${updated.id}`,
      this.withConversationDerivedFields(updated),
    );
    return updated;
  }

  private async markConversationReadForAgents(
    record: SupportConversationRecord,
  ): Promise<SupportConversationRecord> {
    if (record.unreadForAgents === 0) {
      return record;
    }

    const updated: SupportConversationRecord = {
      ...record,
      unreadForAgents: 0,
    };

    await this.travelDB.put(
      `support_conversation:${updated.id}`,
      this.withConversationDerivedFields(updated),
    );
    return updated;
  }

  private async autoAssignWaitingConversations(): Promise<void> {
    const waitingConversations = (await this.listSupportConversationRecords())
      .filter(
        (record) =>
          !record.assignedAgentId &&
          !!record.lastMessageAt &&
          record.status === SupportConversationStatus.WAITING_AGENT,
      )
      .sort((left, right) =>
        this.resolveConversationSortValue(left).localeCompare(
          this.resolveConversationSortValue(right),
        ),
      );

    if (waitingConversations.length === 0) {
      return;
    }

    const activeAgents = (await this.listSupportAgentRecords()).filter(
      (record) => record.enabled && record.isActive,
    );

    if (activeAgents.length === 0) {
      return;
    }

    const openConversationCounts = await this.countOpenConversationsByAgent();

    for (const conversation of waitingConversations) {
      const chosenAgent = this.chooseAgentForConversation(
        activeAgents,
        openConversationCounts,
      );

      if (!chosenAgent) {
        return;
      }

      const assignedAt = new Date().toISOString();
      const updatedConversation: SupportConversationRecord = {
        ...conversation,
        assignedAgentId: chosenAgent.userId,
        sharedAgentIds: this.mergeSharedAgentIds(
          conversation.sharedAgentIds,
          chosenAgent.userId,
        ),
        status: SupportConversationStatus.IN_PROGRESS,
        updatedAt: assignedAt,
      };

      await Promise.all([
        this.travelDB.put(
          `support_conversation:${updatedConversation.id}`,
          this.withConversationDerivedFields(updatedConversation),
        ),
        this.touchSupportAgentAssignment(chosenAgent.userId, assignedAt),
        this.appendConversationAudit(updatedConversation.id, {
          action: SupportConversationAuditAction.ASSIGNED,
          actor: 'system:auto_assign',
          summary: `Auto-assigned conversation to ${chosenAgent.userId}.`,
          assignedAgentId: chosenAgent.userId,
          createdAt: assignedAt,
        }),
      ]);

      openConversationCounts.set(
        chosenAgent.userId,
        (openConversationCounts.get(chosenAgent.userId) ?? 0) + 1,
      );
      chosenAgent.lastAssignedAt = assignedAt;
      chosenAgent.updatedAt = assignedAt;
    }
  }

  private chooseAgentForConversation(
    agents: SupportAgentRecord[],
    openConversationCounts: Map<string, number>,
  ): SupportAgentRecord | null {
    const sorted = [...agents].sort((left, right) => {
      const leftCount = openConversationCounts.get(left.userId) ?? 0;
      const rightCount = openConversationCounts.get(right.userId) ?? 0;

      if (leftCount !== rightCount) {
        return leftCount - rightCount;
      }

      const leftAssignedAt = left.lastAssignedAt || '';
      const rightAssignedAt = right.lastAssignedAt || '';
      if (leftAssignedAt !== rightAssignedAt) {
        return leftAssignedAt.localeCompare(rightAssignedAt);
      }

      return left.userId.localeCompare(right.userId);
    });

    return sorted[0] ?? null;
  }

  private async autoAssignConversation(
    conversation: SupportConversationRecord,
    assignedAt: string,
  ): Promise<SupportConversationRecord> {
    const activeAgents = (await this.listSupportAgentRecords()).filter(
      (record) => record.enabled && record.isActive,
    );

    if (activeAgents.length === 0) {
      return conversation;
    }

    const openConversationCounts = await this.countOpenConversationsByAgent();
    const chosenAgent = this.chooseAgentForConversation(
      activeAgents,
      openConversationCounts,
    );

    if (!chosenAgent) {
      return conversation;
    }

    const updated: SupportConversationRecord = {
      ...conversation,
      assignedAgentId: chosenAgent.userId,
      sharedAgentIds: this.mergeSharedAgentIds(
        conversation.sharedAgentIds,
        chosenAgent.userId,
      ),
      updatedAt: assignedAt,
    };

    await Promise.all([
      this.travelDB.put(
        `support_conversation:${updated.id}`,
        this.withConversationDerivedFields(updated),
      ),
      this.touchSupportAgentAssignment(chosenAgent.userId, assignedAt),
      this.appendConversationAudit(updated.id, {
        action: SupportConversationAuditAction.ASSIGNED,
        actor: 'system:auto_assign',
        summary: `Auto-assigned conversation to ${chosenAgent.userId}.`,
        assignedAgentId: chosenAgent.userId,
        createdAt: assignedAt,
      }),
    ]);

    return updated;
  }

  private async touchSupportAgentAssignment(
    userId: string,
    assignedAt: string,
  ): Promise<void> {
    const record = await this.getSupportAgentRecord(userId);
    if (!record) {
      return;
    }

    const existingState = await this.getSupportAgentStateRecord(userId);

    const updated: SupportAgentStateRecord = {
      entityType: 'SUPPORT_AGENT_STATE',
      userId: record.userId,
      isActive: record.isActive,
      lastAssignedAt: assignedAt,
      createdAt: existingState?.createdAt ?? record.createdAt,
      updatedAt: assignedAt,
      updatedBy: existingState?.updatedBy ?? record.updatedBy,
    };

    await this.travelDB.put(`support_agent_state:${updated.userId}`, updated);
  }

  private async requireSupportWorkspaceAccess(
    user: Record<string, unknown>,
  ): Promise<{
    actor: string;
    isAdmin: boolean;
    isSupportAgent: boolean;
  }> {
    const userId = typeof user?.user_id === 'string' ? user.user_id.trim() : '';
    const email = typeof user?.email === 'string' ? user.email.trim() : '';

    if (!userId && !email) {
      throw new ForbiddenException('Support workspace access required');
    }

    const [isAdmin, isSupportAgent] = await Promise.all([
      this.roleAccessService.isRoleGranted('ADMIN', {
        userId: userId || undefined,
        email: email || undefined,
      }),
      this.roleAccessService.isRoleGranted('SUPPORT_AGENT', {
        userId: userId || undefined,
        email: email || undefined,
      }),
    ]);

    if (!isAdmin && !isSupportAgent) {
      throw new ForbiddenException('Support workspace access required');
    }

    const principal = userId || email;
    return {
      actor: `${isAdmin ? 'admin' : 'support_agent'}:${principal}`,
      isAdmin,
      isSupportAgent,
    };
  }

  private async requireAdminActor(
    user?: Record<string, unknown>,
  ): Promise<string> {
    if (!user) {
      return 'admin:system';
    }

    const access = await this.requireSupportWorkspaceAccess(user);
    if (!access.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }

    return access.actor;
  }

  private async unassignConversationsForAgent(
    userId: string,
    actor: string,
  ): Promise<void> {
    const records = await this.listSupportConversationRecords();
    const affected = records.filter(
      (record) =>
        record.assignedAgentId === userId &&
        record.status !== SupportConversationStatus.CLOSED,
    );

    if (affected.length === 0) {
      return;
    }

    const now = new Date().toISOString();
    await Promise.all(
      affected.flatMap((record) => {
        const updated: SupportConversationRecord = {
          ...record,
          assignedAgentId: undefined,
          status: this.resolveUnassignedConversationStatus(record),
          updatedAt: now,
        };

        return [
          this.travelDB.put(
            `support_conversation:${record.id}`,
            this.withConversationDerivedFields(updated),
          ),
          this.appendConversationAudit(record.id, {
            action: SupportConversationAuditAction.UNASSIGNED,
            actor,
            summary: `Unassigned conversation from ${userId} after support access changed.`,
            assignedAgentId: userId,
            createdAt: now,
          }),
        ];
      }),
    );
  }

  private resolveUnassignedConversationStatus(
    record: SupportConversationRecord,
  ): SupportConversationStatus {
    if (record.status === SupportConversationStatus.IN_PROGRESS) {
      return SupportConversationStatus.WAITING_AGENT;
    }

    return record.status;
  }

  private async searchAllJsonRows(params: {
    contains: Record<string, unknown>;
    order_by?: 'ASC' | 'DESC';
    order_by_field?: 'key' | 'created_at' | 'updated_at';
  }): Promise<SearchJsonRow[]> {
    const rows: SearchJsonRow[] = [];
    let offset = 0;

    while (true) {
      const result = await this.travelDB.searchJson({
        contains: params.contains,
        limit: SUPPORT_SEARCH_BATCH_SIZE,
        offset,
        order_by: params.order_by,
        order_by_field: params.order_by_field,
      });
      const batch = result.data as SearchJsonRow[];

      if (batch.length === 0) {
        return rows;
      }

      rows.push(...batch);

      if (batch.length < SUPPORT_SEARCH_BATCH_SIZE) {
        return rows;
      }

      offset += batch.length;
    }
  }

  private async countOpenConversationsByAgent(): Promise<Map<string, number>> {
    const records = await this.listSupportConversationRecords();
    const counts = new Map<string, number>();

    for (const record of records) {
      if (
        !record.assignedAgentId ||
        record.status === SupportConversationStatus.CLOSED
      ) {
        continue;
      }

      counts.set(
        record.assignedAgentId,
        (counts.get(record.assignedAgentId) ?? 0) + 1,
      );
    }

    return counts;
  }

  private buildMessageRecord(params: {
    conversationId: string;
    userId: string;
    senderUserId: string;
    senderRole: SupportSenderRole;
    content: string;
    createdAt: string;
  }): SupportMessageRecord {
    return {
      entityType: 'SUPPORT_MESSAGE',
      id: this.generateMessageId(),
      conversationId: params.conversationId,
      userId: params.userId,
      senderUserId: params.senderUserId,
      senderRole: params.senderRole,
      content: params.content,
      createdAt: params.createdAt,
    };
  }

  private toSupportConversationRecord(
    value: unknown,
  ): SupportConversationRecord | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const candidate = value as Partial<SupportConversationRecord>;
    if (candidate.entityType !== 'SUPPORT_CONVERSATION') {
      return null;
    }

    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.userId !== 'string' ||
      !Array.isArray(candidate.sharedAgentIds) ||
      typeof candidate.status !== 'string' ||
      typeof candidate.unreadForUser !== 'number' ||
      typeof candidate.unreadForAgents !== 'number' ||
      typeof candidate.createdAt !== 'string' ||
      typeof candidate.updatedAt !== 'string'
    ) {
      return null;
    }

    if (
      candidate.priority !== undefined &&
      !Object.values(SupportConversationPriority).includes(candidate.priority)
    ) {
      return null;
    }

    if (
      candidate.isAssigned !== undefined &&
      typeof candidate.isAssigned !== 'boolean'
    ) {
      return null;
    }

    return candidate as SupportConversationRecord;
  }

  private toSupportMessageRecord(value: unknown): SupportMessageRecord | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const candidate = value as Partial<SupportMessageRecord>;
    if (candidate.entityType !== 'SUPPORT_MESSAGE') {
      return null;
    }

    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.conversationId !== 'string' ||
      typeof candidate.userId !== 'string' ||
      typeof candidate.senderUserId !== 'string' ||
      typeof candidate.senderRole !== 'string' ||
      typeof candidate.content !== 'string' ||
      typeof candidate.createdAt !== 'string'
    ) {
      return null;
    }

    return candidate as SupportMessageRecord;
  }

  private normalizeLegacySupportAgentRecord(
    value: unknown,
  ): LegacySupportAgentRecord | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const candidate = value as Partial<LegacySupportAgentRecord>;
    if (candidate.entityType !== 'SUPPORT_AGENT') {
      return null;
    }

    if (
      typeof candidate.userId !== 'string' ||
      typeof candidate.enabled !== 'boolean' ||
      typeof candidate.isActive !== 'boolean' ||
      typeof candidate.createdAt !== 'string' ||
      typeof candidate.updatedAt !== 'string'
    ) {
      return null;
    }

    return candidate as LegacySupportAgentRecord;
  }

  private normalizeStoredSupportAgentStateRecord(
    value: unknown,
  ): SupportAgentStateRecord | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    return this.toSupportAgentStateRecord(
      'value' in value ? (value as { value?: unknown }).value : value,
    );
  }

  private toSupportAgentStateRecord(
    value: unknown,
  ): SupportAgentStateRecord | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const candidate = value as Partial<SupportAgentStateRecord>;
    if (candidate.entityType === 'SUPPORT_AGENT_STATE') {
      if (
        typeof candidate.userId !== 'string' ||
        typeof candidate.isActive !== 'boolean' ||
        typeof candidate.createdAt !== 'string' ||
        typeof candidate.updatedAt !== 'string'
      ) {
        return null;
      }

      return candidate as SupportAgentStateRecord;
    }

    const legacy = this.normalizeLegacySupportAgentRecord(value);
    if (!legacy) {
      return null;
    }

    return {
      entityType: 'SUPPORT_AGENT_STATE',
      userId: legacy.userId,
      isActive: legacy.isActive,
      lastAssignedAt: legacy.lastAssignedAt,
      createdAt: legacy.createdAt,
      updatedAt: legacy.updatedAt,
      updatedBy: legacy.updatedBy,
    };
  }

  private mergeSupportAgentRecordFromEntry(
    accessEntry: RoleAccessEntry,
    state?: SupportAgentStateRecord,
  ): SupportAgentRecord {
    const userId = accessEntry.userId || '';
    const createdAt =
      state?.createdAt || accessEntry.createdAt || new Date().toISOString();
    const updatedAt = state?.updatedAt || accessEntry.updatedAt || createdAt;

    return {
      userId,
      displayName: accessEntry.displayName,
      email: accessEntry.email,
      note: accessEntry.note,
      enabled: accessEntry.enabled,
      isActive: accessEntry.enabled ? (state?.isActive ?? false) : false,
      lastAssignedAt: state?.lastAssignedAt,
      grantedBy: accessEntry.grantedBy,
      updatedBy: state?.updatedBy ?? accessEntry.updatedBy,
      createdAt,
      updatedAt,
    };
  }

  private mergeSupportAgentRecord(
    record: SupportAgentRecord,
    state?: SupportAgentStateRecord,
  ): SupportAgentRecord {
    if (!state) {
      return record;
    }

    return {
      ...record,
      isActive: record.enabled ? state.isActive : false,
      lastAssignedAt: state.lastAssignedAt,
      createdAt: state.createdAt || record.createdAt,
      updatedAt: state.updatedAt || record.updatedAt,
      updatedBy: state.updatedBy ?? record.updatedBy,
    };
  }

  private toSupportMessage(record: SupportMessageRecord): SupportMessage {
    const { entityType, ...message } = record;
    void entityType;
    return message;
  }

  private toSupportConversationWorkspaceMeta(
    conversation: SupportConversationRecord,
    record?: SupportConversationMetaRecord | null,
  ): SupportConversationWorkspaceMeta {
    const priority = record?.priority ?? SUPPORT_DEFAULT_PRIORITY;
    const tags = record?.tags ? [...record.tags] : [];
    const sla = this.resolveSlaWindow(conversation, priority);

    return {
      conversationId: conversation.id,
      internalNote: record?.internalNote,
      priority,
      tags,
      closeReason: record?.closeReason,
      closedAt: record?.closedAt,
      closedBy: record?.closedBy,
      updatedAt: record?.updatedAt || conversation.updatedAt,
      updatedBy: record?.updatedBy,
      slaDueAt: sla?.slaDueAt,
      slaStatus: sla?.slaStatus,
    };
  }

  private toSupportConversationAudit(
    record: SupportConversationAuditRecord,
  ): SupportConversationAudit {
    return {
      id: record.id,
      conversationId: record.conversationId,
      action: record.action,
      actor: record.actor,
      summary: record.summary,
      messagePreview: record.messagePreview,
      priority: record.priority,
      tags: record.tags ? [...record.tags] : [],
      assignedAgentId: record.assignedAgentId,
      closeReason: record.closeReason,
      reopenedFromStatus: record.reopenedFromStatus,
      createdAt: record.createdAt,
    };
  }

  private toSupportAgent(
    record: SupportAgentRecord,
    openConversationCount: number,
  ): SupportAgent {
    return {
      userId: record.userId,
      displayName: record.displayName,
      email: record.email,
      note: record.note,
      enabled: record.enabled,
      isActive: record.isActive,
      openConversationCount,
      lastAssignedAt: record.lastAssignedAt,
      grantedBy: record.grantedBy,
      updatedBy: record.updatedBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private toSupportIntakeConfig(
    record: SupportWorkspaceConfigRecord,
  ): SupportIntakeConfig {
    return {
      issueStarters: this.cloneSupportWorkspaceTemplates(record.issueStarters),
    };
  }

  private toSupportWorkspaceConfig(
    record: SupportWorkspaceConfigRecord,
  ): SupportWorkspaceConfig {
    return {
      issueStarters: this.cloneSupportWorkspaceTemplates(record.issueStarters),
      quickReplyTemplates: this.cloneSupportWorkspaceTemplates(
        record.quickReplyTemplates,
      ),
      commonTags: [...record.commonTags],
      updatedAt: record.updatedAt,
      updatedBy: record.updatedBy,
    };
  }

  private cloneSupportWorkspaceTemplates(
    templates: SupportWorkspaceTemplateRecord[],
  ): SupportWorkspaceTemplate[] {
    return templates.map((template) => ({
      label: template.label,
      content: template.content,
    }));
  }

  private mergeSharedAgentIds(
    existing: string[],
    ...userIds: Array<string | undefined>
  ): string[] {
    return Array.from(
      new Set(
        [...existing, ...userIds]
          .map((value) => value?.trim() || '')
          .filter((value) => !!value),
      ),
    );
  }

  private withConversationDerivedFields(
    record: SupportConversationRecord,
    options?: {
      priority?: SupportConversationPriority;
    },
  ): SupportConversationRecord {
    const priority = options?.priority ?? record.priority;

    return {
      ...record,
      ...(priority ? { priority } : {}),
      isAssigned: !!record.assignedAgentId,
    };
  }

  private hasSameConversationDerivedFields(
    left: SupportConversationRecord,
    right: SupportConversationRecord,
  ): boolean {
    return (
      (left.priority ?? undefined) === (right.priority ?? undefined) &&
      (left.isAssigned ?? !!left.assignedAgentId) ===
        (right.isAssigned ?? !!right.assignedAgentId)
    );
  }

  private buildMessagePreview(content: string): string {
    return content.length > 120 ? `${content.slice(0, 117)}...` : content;
  }

  private resolveConversationSortValue(
    record: SupportConversationRecord,
  ): string {
    return record.lastMessageAt || record.updatedAt || record.createdAt;
  }

  private requireText(value: string, fieldName: string): string {
    const normalized = value?.trim();
    if (!normalized) {
      throw new BadRequestException(`${fieldName} is required`);
    }

    return normalized;
  }

  private normalizeRequiredText(
    value: string,
    fieldName: string,
    maxLength: number,
  ): string {
    const normalized = this.requireText(value, fieldName);
    if (normalized.length > maxLength) {
      throw new BadRequestException(
        `${fieldName} exceeds max length ${maxLength}`,
      );
    }

    return normalized;
  }

  private requireMessageContent(value: string): string {
    const normalized = this.requireText(value, 'content');
    if (normalized.length > SUPPORT_MAX_MESSAGE_LENGTH) {
      throw new BadRequestException(
        `content exceeds max length ${SUPPORT_MAX_MESSAGE_LENGTH}`,
      );
    }

    return normalized;
  }

  private normalizeOptionalText(
    value: string | undefined,
    fieldName: string,
    maxLength: number,
  ): string | undefined {
    const normalized = value?.trim();
    if (!normalized) {
      return undefined;
    }

    if (normalized.length > maxLength) {
      throw new BadRequestException(
        `${fieldName} exceeds max length ${maxLength}`,
      );
    }

    return normalized;
  }

  private normalizeAuditSummary(value: string): string {
    const normalized = this.requireText(value, 'summary');
    return normalized.length > SUPPORT_MAX_AUDIT_SUMMARY_LENGTH
      ? `${normalized.slice(0, SUPPORT_MAX_AUDIT_SUMMARY_LENGTH - 3)}...`
      : normalized;
  }

  private normalizeTags(value?: string[]): string[] {
    if (!value?.length) {
      return [];
    }

    const normalized = Array.from(
      new Set(
        value
          .map((item) => item?.trim() || '')
          .filter((item) => !!item)
          .map((item) => item.slice(0, SUPPORT_MAX_TAG_LENGTH)),
      ),
    );

    if (normalized.length > SUPPORT_MAX_TAGS) {
      throw new BadRequestException(
        `tags exceeds max count ${SUPPORT_MAX_TAGS}`,
      );
    }

    return normalized;
  }

  private normalizeSupportWorkspaceTemplates(
    value: Array<{ label: string; content: string }> | undefined,
    fieldName: string,
  ): SupportWorkspaceTemplateRecord[] {
    if (!value?.length) {
      return [];
    }

    if (value.length > SUPPORT_MAX_WORKSPACE_TEMPLATE_COUNT) {
      throw new BadRequestException(
        `${fieldName} exceeds max count ${SUPPORT_MAX_WORKSPACE_TEMPLATE_COUNT}`,
      );
    }

    return value.map((template, index) => ({
      label: this.normalizeRequiredText(
        template.label,
        `${fieldName}[${index}].label`,
        SUPPORT_MAX_WORKSPACE_TEMPLATE_LABEL_LENGTH,
      ),
      content: this.normalizeRequiredText(
        template.content,
        `${fieldName}[${index}].content`,
        SUPPORT_MAX_WORKSPACE_TEMPLATE_CONTENT_LENGTH,
      ),
    }));
  }

  private isSameTextArray(left: string[], right: string[]): boolean {
    if (left.length !== right.length) {
      return false;
    }

    return left.every((value, index) => value === right[index]);
  }

  private buildConversationId(userId: string): string {
    return `supconv_${createHash('sha256').update(userId).digest('hex').slice(0, 14)}`;
  }

  private generateMessageId(): string {
    return `supmsg_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
  }

  private generateAuditId(): string {
    return `supaudit_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
  }

  private toSupportConversationMetaRecord(
    value: unknown,
  ): SupportConversationMetaRecord | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const candidate = value as Partial<SupportConversationMetaRecord>;
    if (candidate.entityType !== 'SUPPORT_CONVERSATION_META') {
      return null;
    }

    if (
      typeof candidate.conversationId !== 'string' ||
      typeof candidate.createdAt !== 'string' ||
      typeof candidate.updatedAt !== 'string'
    ) {
      return null;
    }

    if (
      candidate.priority !== undefined &&
      !Object.values(SupportConversationPriority).includes(candidate.priority)
    ) {
      return null;
    }

    if (
      candidate.tags !== undefined &&
      (!Array.isArray(candidate.tags) ||
        candidate.tags.some((item) => typeof item !== 'string'))
    ) {
      return null;
    }

    return candidate as SupportConversationMetaRecord;
  }

  private toSupportWorkspaceConfigRecord(
    value: unknown,
  ): SupportWorkspaceConfigRecord | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const candidate = value as Partial<SupportWorkspaceConfigRecord>;
    if (candidate.entityType !== 'SUPPORT_WORKSPACE_CONFIG') {
      return null;
    }

    if (
      candidate.key !== 'default' ||
      !Array.isArray(candidate.issueStarters) ||
      !Array.isArray(candidate.quickReplyTemplates) ||
      !Array.isArray(candidate.commonTags)
    ) {
      return null;
    }

    const issueStarters = this.normalizeStoredSupportWorkspaceTemplates(
      candidate.issueStarters,
    );
    const quickReplyTemplates = this.normalizeStoredSupportWorkspaceTemplates(
      candidate.quickReplyTemplates,
    );
    if (
      !issueStarters ||
      !quickReplyTemplates ||
      candidate.commonTags.some((item) => typeof item !== 'string')
    ) {
      return null;
    }

    if (
      candidate.createdAt !== undefined &&
      typeof candidate.createdAt !== 'string'
    ) {
      return null;
    }

    if (
      candidate.updatedAt !== undefined &&
      typeof candidate.updatedAt !== 'string'
    ) {
      return null;
    }

    if (
      candidate.updatedBy !== undefined &&
      typeof candidate.updatedBy !== 'string'
    ) {
      return null;
    }

    return {
      entityType: 'SUPPORT_WORKSPACE_CONFIG',
      key: 'default',
      issueStarters,
      quickReplyTemplates,
      commonTags: [...candidate.commonTags],
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
      updatedBy: candidate.updatedBy,
    };
  }

  private normalizeStoredSupportWorkspaceTemplates(
    value: unknown[],
  ): SupportWorkspaceTemplateRecord[] | null {
    const templates: SupportWorkspaceTemplateRecord[] = [];

    for (const item of value) {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const candidate = item as Partial<SupportWorkspaceTemplateRecord>;
      if (
        typeof candidate.label !== 'string' ||
        typeof candidate.content !== 'string'
      ) {
        return null;
      }

      templates.push({
        label: candidate.label,
        content: candidate.content,
      });
    }

    return templates;
  }

  private toSupportConversationAuditRecord(
    value: unknown,
  ): SupportConversationAuditRecord | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const candidate = value as Partial<SupportConversationAuditRecord>;
    if (candidate.entityType !== 'SUPPORT_CONVERSATION_AUDIT') {
      return null;
    }

    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.conversationId !== 'string' ||
      typeof candidate.action !== 'string' ||
      typeof candidate.actor !== 'string' ||
      typeof candidate.summary !== 'string' ||
      typeof candidate.createdAt !== 'string'
    ) {
      return null;
    }

    if (
      !Object.values(SupportConversationAuditAction).includes(candidate.action)
    ) {
      return null;
    }

    if (
      candidate.priority !== undefined &&
      !Object.values(SupportConversationPriority).includes(candidate.priority)
    ) {
      return null;
    }

    if (
      candidate.reopenedFromStatus !== undefined &&
      (typeof candidate.reopenedFromStatus !== 'string' ||
        !Object.values(SupportConversationStatus).includes(
          candidate.reopenedFromStatus,
        ))
    ) {
      return null;
    }

    if (
      candidate.tags !== undefined &&
      (!Array.isArray(candidate.tags) ||
        candidate.tags.some((item) => typeof item !== 'string'))
    ) {
      return null;
    }

    return candidate as SupportConversationAuditRecord;
  }

  private resolveSlaWindow(
    conversation: SupportConversationRecord,
    priority: SupportConversationPriority,
  ): {
    slaDueAt: string;
    slaStatus: SupportConversationSlaStatus;
  } | null {
    if (
      conversation.status === SupportConversationStatus.CLOSED ||
      conversation.unreadForAgents === 0 ||
      !conversation.lastMessageAt
    ) {
      return null;
    }

    const lastMessageAt = new Date(conversation.lastMessageAt);
    if (Number.isNaN(lastMessageAt.getTime())) {
      return null;
    }

    const dueAt = new Date(
      lastMessageAt.getTime() +
        SUPPORT_PRIORITY_RESPONSE_MINUTES[priority] * 60 * 1000,
    );
    const now = Date.now();
    const dueSoonThreshold =
      dueAt.getTime() - SUPPORT_PRIORITY_DUE_SOON_MINUTES[priority] * 60 * 1000;

    return {
      slaDueAt: dueAt.toISOString(),
      slaStatus:
        now > dueAt.getTime()
          ? SupportConversationSlaStatus.OVERDUE
          : now >= dueSoonThreshold
            ? SupportConversationSlaStatus.DUE_SOON
            : SupportConversationSlaStatus.ON_TRACK,
    };
  }
}
