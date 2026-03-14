import { ForbiddenException } from '@nestjs/common';
import type { DBService, PGKVDatabase } from '../common/db.service';
import { SupportService } from './support.service';
import { SupportConversationAuditAction } from './dto/support-conversation-audit-action.enum';
import { SupportConversationPriority } from './dto/support-conversation-priority.enum';
import { SupportConversationSlaStatus } from './dto/support-conversation-sla-status.enum';
import { SupportConversationStatus } from './dto/support-conversation-status.enum';

jest.mock('../common/db.service', () => ({
  DBService: class DBService {},
  PGKVDatabase: class PGKVDatabase {},
}));

type SearchJsonOptions = {
  contains?: Record<string, unknown>;
  limit?: number;
  offset?: number;
  compare?: Array<{
    path: string;
    operator: '>' | '<' | '>=' | '<=' | '=' | '!=';
    value: number | string | Date;
  }>;
  text_search?: Array<{
    path: string;
    text: string;
    case_sensitive?: boolean;
  }>;
  order_by?: 'ASC' | 'DESC';
  order_by_field?: 'key' | 'created_at' | 'updated_at';
  include_total?: boolean;
};

function createInMemoryTravelDB(initial?: Record<string, unknown>): {
  db: PGKVDatabase;
  store: Map<string, unknown>;
  searchJsonMock: jest.Mock;
} {
  const store = new Map<string, unknown>(Object.entries(initial || {}));

  const readPath = (value: unknown, path: string): unknown => {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    let current: unknown = value;
    for (const segment of path.split('.')) {
      if (!current || typeof current !== 'object') {
        return undefined;
      }

      current = (current as Record<string, unknown>)[segment];
    }

    return current;
  };

  const compareValue = (
    left: unknown,
    operator: '>' | '<' | '>=' | '<=' | '=' | '!=',
    right: number | string | Date,
  ): boolean => {
    if (left === undefined || left === null) {
      return false;
    }

    if (
      typeof left !== 'number' &&
      typeof left !== 'string' &&
      !(left instanceof Date)
    ) {
      return false;
    }

    const normalizedLeft = left instanceof Date ? left.getTime() : left;
    const normalizedRight = right instanceof Date ? right.getTime() : right;

    switch (operator) {
      case '>':
        return normalizedLeft > normalizedRight;
      case '<':
        return normalizedLeft < normalizedRight;
      case '>=':
        return normalizedLeft >= normalizedRight;
      case '<=':
        return normalizedLeft <= normalizedRight;
      case '=':
        return normalizedLeft === normalizedRight;
      case '!=':
        return normalizedLeft !== normalizedRight;
      default:
        return false;
    }
  };

  const searchJsonMock = jest.fn(
    (
      options: SearchJsonOptions,
    ): Promise<{
      data: Array<{ key: string; value: unknown }>;
      total?: number;
    }> => {
      const rows = Array.from(store.entries())
        .map(([key, value]) => ({ key, value }))
        .filter((row) => {
          const contains = options.contains;
          if (!contains) {
            return true;
          }

          if (!row.value || typeof row.value !== 'object') {
            return false;
          }

          const candidate = row.value as Record<string, unknown>;
          return Object.entries(contains).every(
            ([field, expectedValue]) => candidate[field] === expectedValue,
          );
        })
        .filter((row) =>
          (options.compare || []).every((condition) =>
            compareValue(
              readPath(row.value, condition.path),
              condition.operator,
              condition.value,
            ),
          ),
        )
        .filter((row) =>
          (options.text_search || []).every((condition) => {
            const value = readPath(row.value, condition.path);
            if (typeof value !== 'string') {
              return false;
            }

            if (condition.case_sensitive) {
              return value.includes(condition.text);
            }

            return value.toLowerCase().includes(condition.text.toLowerCase());
          }),
        );

      rows.sort((left, right) => {
        const orderByField = options.order_by_field || 'created_at';
        const leftSortValue =
          orderByField === 'key'
            ? left.key
            : typeof (
                  left.value as {
                    updatedAt?: unknown;
                    createdAt?: unknown;
                  }
                )?.[
                  orderByField === 'updated_at' ? 'updatedAt' : 'createdAt'
                ] === 'string'
              ? (((
                  left.value as {
                    updatedAt?: string;
                    createdAt?: string;
                  }
                )[
                  orderByField === 'updated_at' ? 'updatedAt' : 'createdAt'
                ] as string) ?? '')
              : '';
        const rightSortValue =
          orderByField === 'key'
            ? right.key
            : typeof (
                  right.value as {
                    updatedAt?: unknown;
                    createdAt?: unknown;
                  }
                )?.[
                  orderByField === 'updated_at' ? 'updatedAt' : 'createdAt'
                ] === 'string'
              ? (((
                  right.value as {
                    updatedAt?: string;
                    createdAt?: string;
                  }
                )[
                  orderByField === 'updated_at' ? 'updatedAt' : 'createdAt'
                ] as string) ?? '')
              : '';

        return options.order_by === 'ASC'
          ? String(leftSortValue).localeCompare(String(rightSortValue))
          : String(rightSortValue).localeCompare(String(leftSortValue));
      });

      const offset = Math.max(options.offset || 0, 0);
      const limit = Math.max(options.limit || rows.length, 1);
      const paged = rows.slice(offset, offset + limit);

      return Promise.resolve({
        data: paged,
        ...(options.include_total ? { total: rows.length } : {}),
      });
    },
  );

  const dbMock = {
    put(key: string, value: unknown): Promise<void> {
      store.set(key, value);
      return Promise.resolve();
    },
    get<T = unknown>(key: string): Promise<T | null> {
      if (!store.has(key)) {
        return Promise.resolve(null);
      }

      return Promise.resolve(store.get(key) as T);
    },
    getWithPrefix<T = unknown>(prefix: string): Promise<Record<string, T>> {
      const result: Record<string, T> = {};

      for (const [key, value] of store.entries()) {
        if (key.startsWith(prefix)) {
          result[key] = value as T;
        }
      }

      return Promise.resolve(result);
    },
    searchJson: searchJsonMock,
  };

  return {
    db: dbMock as unknown as PGKVDatabase,
    store,
    searchJsonMock,
  };
}

function storeHasKey(store: Map<string, unknown>, key: string): boolean {
  return store.has(key);
}

function createSupportAgentRecord(params: {
  userId: string;
  enabled?: boolean;
  isActive?: boolean;
  lastAssignedAt?: string;
}) {
  return {
    entityType: 'SUPPORT_AGENT' as const,
    userId: params.userId,
    enabled: params.enabled ?? true,
    isActive: params.isActive ?? true,
    lastAssignedAt: params.lastAssignedAt,
    createdAt: '2026-03-14T09:00:00.000Z',
    updatedAt: '2026-03-14T09:00:00.000Z',
  };
}

function createRoleAccessRecord(params: {
  role: 'ADMIN' | 'SUPPORT_AGENT';
  userId: string;
  enabled?: boolean;
}) {
  return {
    entityType: 'ROLE_ACCESS' as const,
    role: params.role,
    id: `user:${params.userId}`,
    principalType: 'USER_ID' as const,
    principalValue: params.userId,
    userId: params.userId,
    enabled: params.enabled ?? true,
    source: 'DB' as const,
    createdAt: '2026-03-14T09:00:00.000Z',
    updatedAt: '2026-03-14T09:00:00.000Z',
  };
}

describe('SupportService', () => {
  it('creates one conversation per user and auto-assigns the active agent', async () => {
    const { db, store } = createInMemoryTravelDB({
      'support_agent:agent_1': createSupportAgentRecord({
        userId: 'agent_1',
      }),
    });

    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };

    const service = new SupportService(dbServiceMock as DBService);

    const emptyConversation = await service.getMySupportConversation('user_1');
    expect(emptyConversation.status).toBe(
      SupportConversationStatus.WAITING_AGENT,
    );
    expect(emptyConversation.messages).toHaveLength(0);
    expect(emptyConversation.id).toContain('draft_user_1');

    const updatedConversation = await service.sendSupportMessage('user_1', {
      content: 'Need help with my booking payment status.',
    });

    expect(updatedConversation.assignedAgentId).toBe('agent_1');
    expect(updatedConversation.status).toBe(
      SupportConversationStatus.IN_PROGRESS,
    );
    expect(updatedConversation.messages).toHaveLength(1);
    expect(updatedConversation.messages[0].content).toContain(
      'booking payment',
    );

    const queue = await service.listSupportConversationsForAgent('agent_1', {
      onlyMine: true,
      page: { limit: 10, offset: 0 },
    });

    expect(queue.total).toBe(1);
    expect(queue.items[0].userId).toBe('user_1');

    const conversationKeys = Array.from(store.keys()).filter((key) =>
      key.startsWith('support_conversation:'),
    );
    expect(conversationKeys).toHaveLength(1);
  });

  it('keeps conversation waiting until an agent becomes active, then auto-assigns it', async () => {
    const { db, store } = createInMemoryTravelDB();

    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };

    const service = new SupportService(dbServiceMock as DBService);

    const waitingConversation = await service.sendSupportMessage('user_2', {
      content: 'No one is online yet, but I need help.',
    });

    expect(waitingConversation.assignedAgentId).toBeUndefined();
    expect(waitingConversation.status).toBe(
      SupportConversationStatus.WAITING_AGENT,
    );

    const agent = await service.adminSetSupportAgent(
      {
        userId: 'agent_2',
        enabled: true,
        isActive: true,
        note: 'Night shift coverage',
      },
      { user_id: 'admin_1' },
    );

    expect(agent.note).toBe('Night shift coverage');
    expect(agent.grantedBy).toBe('admin:admin_1');
    expect(agent.updatedBy).toBe('admin:admin_1');
    const typedStore = store;
    expect(
      storeHasKey(typedStore, 'role_access:SUPPORT_AGENT:user:agent_2'),
    ).toBe(true);
    expect(storeHasKey(typedStore, 'support_agent_state:agent_2')).toBe(true);

    const afterActivation = await service.getMySupportConversation('user_2');
    expect(afterActivation.assignedAgentId).toBe('agent_2');
    expect(afterActivation.status).toBe(SupportConversationStatus.IN_PROGRESS);
  });

  it('keeps a single persisted conversation when first messages arrive concurrently', async () => {
    const { db, store } = createInMemoryTravelDB({
      'support_agent:agent_1': createSupportAgentRecord({
        userId: 'agent_1',
      }),
    });

    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };

    const service = new SupportService(dbServiceMock as DBService);

    const [first, second] = await Promise.all([
      service.sendSupportMessage('user_race', {
        content: 'First tab message.',
      }),
      service.sendSupportMessage('user_race', {
        content: 'Second tab message.',
      }),
    ]);

    expect(first.id).toBe(second.id);

    const conversationKeys = Array.from(store.keys()).filter((key) =>
      key.startsWith('support_conversation:'),
    );
    expect(conversationKeys).toHaveLength(1);

    const latest = await service.getMySupportConversation('user_race');
    expect(latest.messages).toHaveLength(2);
  });

  it('returns default support workspace config and lets admins persist updated templates', async () => {
    const { db } = createInMemoryTravelDB({
      'role_access:ADMIN:user:admin_1': createRoleAccessRecord({
        role: 'ADMIN',
        userId: 'admin_1',
      }),
    });

    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };

    const service = new SupportService(dbServiceMock as DBService);

    const defaults = await service.getSupportIntakeConfig();
    expect(defaults.issueStarters[0]?.label).toBe('Payment Question');

    const updated = await service.adminUpsertSupportWorkspaceConfig(
      {
        issueStarters: [
          {
            label: 'Travel Date Change',
            content: 'I need help changing my confirmed travel date.',
          },
        ],
        quickReplyTemplates: [
          {
            label: 'Ops Follow Up',
            content:
              'I have sent this request to operations and will update you shortly.',
          },
        ],
        commonTags: ['date-change', 'ops-follow-up'],
      },
      { user_id: 'admin_1' },
    );

    expect(updated.updatedBy).toBe('admin:admin_1');
    expect(updated.issueStarters).toEqual([
      {
        label: 'Travel Date Change',
        content: 'I need help changing my confirmed travel date.',
      },
    ]);
    expect(updated.quickReplyTemplates).toEqual([
      {
        label: 'Ops Follow Up',
        content:
          'I have sent this request to operations and will update you shortly.',
      },
    ]);
    expect(updated.commonTags).toEqual(['date-change', 'ops-follow-up']);

    const workspaceConfig = await service.getSupportWorkspaceConfig({
      user_id: 'admin_1',
    });
    expect(workspaceConfig.quickReplyTemplates[0]?.label).toBe('Ops Follow Up');

    const intakeConfig = await service.getSupportIntakeConfig();
    expect(intakeConfig.issueStarters[0]?.label).toBe('Travel Date Change');
  });

  it('allows manual reassignment and blocks non-agent replies', async () => {
    const { db } = createInMemoryTravelDB({
      'support_agent:agent_1': createSupportAgentRecord({
        userId: 'agent_1',
      }),
      'support_agent:agent_2': createSupportAgentRecord({
        userId: 'agent_2',
        isActive: false,
      }),
    });

    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };

    const service = new SupportService(dbServiceMock as DBService);

    const created = await service.sendSupportMessage('user_3', {
      content: 'Please reassign this case.',
    });

    const reassigned = await service.adminAssignSupportConversation({
      conversationId: created.id,
      agentUserId: 'agent_2',
    });
    expect(reassigned.assignedAgentId).toBe('agent_2');

    await expect(
      service.replySupportConversation('user_3', {
        conversationId: created.id,
        content: 'This should not be allowed.',
      }),
    ).rejects.toThrow(ForbiddenException);

    const replied = await service.replySupportConversation('agent_2', {
      conversationId: created.id,
      content: 'I picked up this conversation.',
    });
    expect(replied.status).toBe(SupportConversationStatus.WAITING_USER);
    expect(replied.messages).toHaveLength(2);

    const viewedByUser = await service.getMySupportConversation('user_3');
    expect(viewedByUser.unreadForUser).toBe(0);
  });

  it('clears agent unread count when an agent opens the conversation detail', async () => {
    const { db } = createInMemoryTravelDB({
      'support_agent:agent_1': createSupportAgentRecord({
        userId: 'agent_1',
      }),
    });

    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };

    const service = new SupportService(dbServiceMock as DBService);

    const created = await service.sendSupportMessage('user_4', {
      content: 'Please help me with voucher delivery.',
    });

    expect(created.unreadForAgents).toBe(1);

    const detail = await service.getSupportConversationDetailForAgent(
      'agent_1',
      created.id,
    );

    expect(detail.unreadForAgents).toBe(0);
  });

  it('filters queue by unread counters for agents and users', async () => {
    const { db } = createInMemoryTravelDB({
      'support_agent:agent_1': createSupportAgentRecord({
        userId: 'agent_1',
      }),
    });

    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };

    const service = new SupportService(dbServiceMock as DBService);

    const created = await service.sendSupportMessage('user_5', {
      content: 'I still need an update on the booking.',
    });

    const initialAgentUnread = await service.listSupportConversationsForAgent(
      'agent_1',
      {
        hasUnreadForAgents: true,
        page: { limit: 10, offset: 0 },
      },
    );
    expect(initialAgentUnread.total).toBe(1);
    expect(initialAgentUnread.items[0].id).toBe(created.id);

    await service.getSupportConversationDetailForAgent('agent_1', created.id);

    const afterOpen = await service.listSupportConversationsForAgent(
      'agent_1',
      {
        hasUnreadForAgents: true,
        page: { limit: 10, offset: 0 },
      },
    );
    expect(afterOpen.total).toBe(0);

    await service.replySupportConversation('agent_1', {
      conversationId: created.id,
      content: 'Your booking is being checked right now.',
    });

    const unreadForUser = await service.adminListSupportConversations({
      hasUnreadForUser: true,
      page: { limit: 10, offset: 0 },
    });
    expect(unreadForUser.total).toBe(1);
    expect(unreadForUser.items[0].id).toBe(created.id);
  });

  it('uses direct DB pagination for admin queue when filters stay on conversation records', async () => {
    const { db, store, searchJsonMock } = createInMemoryTravelDB();

    for (let index = 0; index < 250; index += 1) {
      const suffix = String(index).padStart(3, '0');
      const timestamp = `2026-03-14T12:${String(
        Math.floor(index / 60),
      ).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}.000Z`;

      store.set(`support_conversation:conv_${suffix}`, {
        entityType: 'SUPPORT_CONVERSATION',
        id: `conv_${suffix}`,
        userId: `user_${suffix}`,
        assignedAgentId: 'agent_1',
        sharedAgentIds: ['agent_1'],
        status: SupportConversationStatus.IN_PROGRESS,
        lastMessagePreview: `Message ${suffix}`,
        lastMessageAt: timestamp,
        unreadForUser: 0,
        unreadForAgents: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };
    const service = new SupportService(dbServiceMock as DBService);

    searchJsonMock.mockClear();

    const page = await service.adminListSupportConversations({
      hasUnreadForAgents: true,
      page: { limit: 20, offset: 220 },
    });

    expect(page.total).toBe(250);
    expect(page.items).toHaveLength(20);
    expect(searchJsonMock).toHaveBeenCalledTimes(1);
  });

  it('uses direct DB pagination for priority and unassigned filters after projection backfill', async () => {
    const { db, store, searchJsonMock } = createInMemoryTravelDB({
      'support_system:conversation_projection_version':
        'support_conversation_projection_v1',
    });

    for (let index = 0; index < 250; index += 1) {
      const suffix = String(index).padStart(3, '0');
      const timestamp = `2026-03-14T13:${String(
        Math.floor(index / 60),
      ).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}.000Z`;

      store.set(`support_conversation:prio_${suffix}`, {
        entityType: 'SUPPORT_CONVERSATION',
        id: `prio_${suffix}`,
        userId: `user_prio_${suffix}`,
        assignedAgentId: undefined,
        sharedAgentIds: [],
        status: SupportConversationStatus.WAITING_AGENT,
        lastMessagePreview: `Priority message ${suffix}`,
        lastMessageAt: timestamp,
        unreadForUser: 0,
        unreadForAgents: 1,
        priority: SupportConversationPriority.HIGH,
        isAssigned: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };
    const service = new SupportService(dbServiceMock as DBService);

    searchJsonMock.mockClear();

    const page = await service.adminListSupportConversations({
      priority: SupportConversationPriority.HIGH,
      unassignedOnly: true,
      page: { limit: 20, offset: 220 },
    });

    expect(page.total).toBe(250);
    expect(page.items).toHaveLength(20);
    expect(page.items.every((item) => item.assignedAgentId === undefined)).toBe(
      true,
    );
    expect(searchJsonMock).toHaveBeenCalledTimes(1);
  });

  it('stores internal notes and closure metadata in workspace-only meta records', async () => {
    const { db } = createInMemoryTravelDB({
      'support_agent:agent_1': createSupportAgentRecord({
        userId: 'agent_1',
      }),
    });

    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };

    const service = new SupportService(dbServiceMock as DBService);

    const created = await service.sendSupportMessage('user_6', {
      content: 'Please document the handoff for this case.',
    });

    const savedNote = await service.setSupportConversationInternalNote(
      { user_id: 'agent_1' },
      {
        conversationId: created.id,
        internalNote: 'Waiting on finance team confirmation.',
      },
    );

    expect(savedNote.internalNote).toBe(
      'Waiting on finance team confirmation.',
    );
    expect(savedNote.updatedBy).toBe('support_agent:agent_1');

    await service.adminCloseSupportConversation(
      {
        conversationId: created.id,
        closeReason: 'Duplicate ticket merged into payment escalation queue.',
      },
      undefined,
    );

    const closedMeta = await service.getSupportConversationWorkspaceMeta(
      { user_id: 'agent_1' },
      created.id,
    );
    expect(closedMeta.internalNote).toBe(
      'Waiting on finance team confirmation.',
    );
    expect(closedMeta.closeReason).toBe(
      'Duplicate ticket merged into payment escalation queue.',
    );
    expect(closedMeta.closedBy).toBe('admin:system');
    expect(closedMeta.closedAt).toBeTruthy();

    await service.replySupportConversation('agent_1', {
      conversationId: created.id,
      content: 'Reopening this thread with an updated status.',
    });

    const closedReopenAudit = await service.getSupportConversationAuditLogs(
      { user_id: 'agent_1' },
      created.id,
      {
        action: SupportConversationAuditAction.REOPENED,
        page: { limit: 20, offset: 0 },
      },
    );
    expect(closedReopenAudit.items[0]?.reopenedFromStatus).toBe(
      SupportConversationStatus.CLOSED,
    );

    const reopenedMeta = await service.getSupportConversationWorkspaceMeta(
      { user_id: 'agent_1' },
      created.id,
    );
    expect(reopenedMeta.internalNote).toBe(
      'Waiting on finance team confirmation.',
    );
    expect(reopenedMeta.closeReason).toBeUndefined();
    expect(reopenedMeta.closedAt).toBeUndefined();
    expect(reopenedMeta.closedBy).toBeUndefined();
  });

  it('stores triage metadata and derives SLA state for overdue conversations', async () => {
    const { db, store } = createInMemoryTravelDB({
      'support_agent:agent_1': createSupportAgentRecord({
        userId: 'agent_1',
      }),
    });

    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };

    const service = new SupportService(dbServiceMock as DBService);

    const created = await service.sendSupportMessage('user_7', {
      content: 'VIP traveler needs an urgent payment callback.',
    });

    const storedConversation = store.get(
      `support_conversation:${created.id}`,
    ) as Record<string, unknown>;
    store.set(`support_conversation:${created.id}`, {
      ...storedConversation,
      lastMessageAt: '2026-03-13T00:00:00.000Z',
      updatedAt: '2026-03-13T00:00:00.000Z',
      unreadForAgents: 1,
    });

    const triage = await service.setSupportConversationTriage(
      { user_id: 'agent_1' },
      {
        conversationId: created.id,
        priority: SupportConversationPriority.URGENT,
        tags: ['vip', 'payment', 'vip'],
      },
    );

    expect(triage.priority).toBe(SupportConversationPriority.URGENT);
    expect(triage.tags).toEqual(['vip', 'payment']);
    expect(triage.slaStatus).toBe(SupportConversationSlaStatus.OVERDUE);

    const urgentQueue = await service.adminListSupportConversations({
      priority: SupportConversationPriority.URGENT,
      page: { limit: 10, offset: 0 },
    });

    expect(urgentQueue.total).toBe(1);
    expect(urgentQueue.items[0].id).toBe(created.id);
  });

  it('marks a conversation resolved and reopens it when the user follows up', async () => {
    const { db } = createInMemoryTravelDB({
      'support_agent:agent_1': createSupportAgentRecord({
        userId: 'agent_1',
      }),
    });

    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };

    const service = new SupportService(dbServiceMock as DBService);

    const created = await service.sendSupportMessage('user_7', {
      content: 'Please confirm whether this issue is solved.',
    });

    const resolved = await service.resolveSupportConversation(
      { user_id: 'agent_1' },
      {
        conversationId: created.id,
      },
    );

    expect(resolved.status).toBe(SupportConversationStatus.RESOLVED);

    const reopened = await service.sendSupportMessage('user_7', {
      content: 'I still need help with the same booking.',
    });

    expect(reopened.status).toBe(SupportConversationStatus.IN_PROGRESS);

    const auditPage = await service.getSupportConversationAuditLogs(
      { user_id: 'agent_1' },
      created.id,
      { page: { limit: 20, offset: 0 } },
    );

    expect(
      auditPage.items.some(
        (item) => item.action === SupportConversationAuditAction.RESOLVED,
      ),
    ).toBe(true);
    expect(
      auditPage.items.some(
        (item) => item.action === SupportConversationAuditAction.REOPENED,
      ),
    ).toBe(true);
    const reopenEntry = auditPage.items.find(
      (item) => item.action === SupportConversationAuditAction.REOPENED,
    );
    expect(reopenEntry?.reopenedFromStatus).toBe(
      SupportConversationStatus.RESOLVED,
    );
  });

  it('records support workspace audit entries for assignment, triage, note, and closure', async () => {
    const { db } = createInMemoryTravelDB({
      'support_agent:agent_1': createSupportAgentRecord({
        userId: 'agent_1',
      }),
      'support_agent:agent_2': createSupportAgentRecord({
        userId: 'agent_2',
      }),
      'role_access:ADMIN:user:admin_1': createRoleAccessRecord({
        role: 'ADMIN',
        userId: 'admin_1',
      }),
    });

    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };

    const service = new SupportService(dbServiceMock as DBService);

    const created = await service.sendSupportMessage('user_8', {
      content: 'Please keep an audit trail for this case.',
    });

    await service.setSupportConversationInternalNote(
      { user_id: 'agent_1' },
      {
        conversationId: created.id,
        internalNote: 'Escalated to finance queue.',
      },
    );

    await service.setSupportConversationTriage(
      { user_id: 'agent_1' },
      {
        conversationId: created.id,
        priority: SupportConversationPriority.HIGH,
        tags: ['vip', 'finance'],
      },
    );

    await service.adminAssignSupportConversation(
      {
        conversationId: created.id,
        agentUserId: 'agent_2',
      },
      { user_id: 'admin_1' },
    );

    await service.adminCloseSupportConversation(
      {
        conversationId: created.id,
        closeReason: 'Handled outside chat.',
      },
      { user_id: 'admin_1' },
    );

    const auditPage = await service.getSupportConversationAuditLogs(
      { user_id: 'agent_1' },
      created.id,
      { limit: 20, offset: 0 },
    );

    expect(auditPage.total).toBeGreaterThanOrEqual(5);
    expect(auditPage.items.map((item) => item.action)).toEqual(
      expect.arrayContaining([
        SupportConversationAuditAction.USER_MESSAGE,
        SupportConversationAuditAction.INTERNAL_NOTE_UPDATED,
        SupportConversationAuditAction.TRIAGE_UPDATED,
        SupportConversationAuditAction.ASSIGNED,
        SupportConversationAuditAction.CLOSED,
      ]),
    );

    const triageEntry = auditPage.items.find(
      (item) => item.action === SupportConversationAuditAction.TRIAGE_UPDATED,
    );
    expect(triageEntry?.priority).toBe(SupportConversationPriority.HIGH);
    expect(triageEntry?.tags).toEqual(['vip', 'finance']);

    const assignEntry = auditPage.items.find(
      (item) =>
        item.action === SupportConversationAuditAction.ASSIGNED &&
        item.actor === 'admin:admin_1',
    );
    expect(assignEntry?.assignedAgentId).toBe('agent_2');

    const closeEntry = auditPage.items.find(
      (item) => item.action === SupportConversationAuditAction.CLOSED,
    );
    expect(closeEntry?.actor).toBe('admin:admin_1');
    expect(closeEntry?.closeReason).toBe('Handled outside chat.');

    const adminOnly = await service.getSupportConversationAuditLogs(
      { user_id: 'agent_1' },
      created.id,
      {
        actor: 'admin:admin_1',
        page: { limit: 20, offset: 0 },
      },
    );
    expect(
      adminOnly.items.every((item) => item.actor === 'admin:admin_1'),
    ).toBe(true);

    const assignedOnly = await service.getSupportConversationAuditLogs(
      { user_id: 'agent_1' },
      created.id,
      {
        action: SupportConversationAuditAction.ASSIGNED,
        page: { limit: 20, offset: 0 },
      },
    );
    expect(assignedOnly.total).toBeGreaterThanOrEqual(1);
    expect(
      assignedOnly.items.every(
        (item) => item.action === SupportConversationAuditAction.ASSIGNED,
      ),
    ).toBe(true);
  });

  it('paginates audit logs from DB without scanning every batch', async () => {
    const { db, store, searchJsonMock } = createInMemoryTravelDB({
      'role_access:SUPPORT_AGENT:user:agent_1': createRoleAccessRecord({
        role: 'SUPPORT_AGENT',
        userId: 'agent_1',
      }),
      'support_conversation:conv_audit_1': {
        entityType: 'SUPPORT_CONVERSATION',
        id: 'conv_audit_1',
        userId: 'user_audit_1',
        assignedAgentId: 'agent_1',
        sharedAgentIds: ['agent_1'],
        status: SupportConversationStatus.IN_PROGRESS,
        lastMessagePreview: 'Newest customer reply',
        lastMessageAt: '2026-03-14T15:59:00.000Z',
        unreadForUser: 0,
        unreadForAgents: 1,
        createdAt: '2026-03-14T12:00:00.000Z',
        updatedAt: '2026-03-14T15:59:00.000Z',
      },
    });

    for (let index = 0; index < 250; index += 1) {
      const suffix = String(index).padStart(3, '0');
      const timestamp = `2026-03-14T15:${String(
        Math.floor(index / 60),
      ).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}.000Z`;

      store.set(`support_conversation_audit:audit_${suffix}`, {
        entityType: 'SUPPORT_CONVERSATION_AUDIT',
        id: `audit_${suffix}`,
        conversationId: 'conv_audit_1',
        action: SupportConversationAuditAction.USER_MESSAGE,
        actor: 'support_agent:agent_1',
        summary: `Audit ${suffix}`,
        createdAt: timestamp,
      });
    }

    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };
    const service = new SupportService(dbServiceMock as DBService);

    searchJsonMock.mockClear();

    const page = await service.getSupportConversationAuditLogs(
      { user_id: 'agent_1' },
      'conv_audit_1',
      {
        page: { limit: 20, offset: 220 },
      },
    );

    expect(page.total).toBe(250);
    expect(page.items).toHaveLength(20);
    expect(searchJsonMock).toHaveBeenCalledTimes(1);
  });

  it('preserves WAITING_USER and RESOLVED conversations when disabling an agent', async () => {
    const { db } = createInMemoryTravelDB({
      'support_agent:agent_1': createSupportAgentRecord({
        userId: 'agent_1',
      }),
      'support_agent:agent_2': createSupportAgentRecord({
        userId: 'agent_2',
        isActive: false,
      }),
    });

    const dbServiceMock: Partial<DBService> = {
      getDBInstance: jest.fn().mockReturnValue(db),
    };

    const service = new SupportService(dbServiceMock as DBService);

    const waitingUserConversation = await service.sendSupportMessage('user_9', {
      content: 'I need a manual follow-up.',
    });
    await service.replySupportConversation('agent_1', {
      conversationId: waitingUserConversation.id,
      content: 'Please confirm the updated details.',
    });

    const resolvedConversation = await service.sendSupportMessage('user_10', {
      content: 'Can this case be resolved now?',
    });
    await service.resolveSupportConversation(
      { user_id: 'agent_1' },
      {
        conversationId: resolvedConversation.id,
      },
    );

    const inProgressConversation = await service.sendSupportMessage('user_11', {
      content: 'Still waiting on agent action.',
    });

    await service.adminSetSupportAgent(
      {
        userId: 'agent_2',
        enabled: true,
        isActive: true,
      },
      { user_id: 'admin_1' },
    );

    await service.adminSetSupportAgent(
      {
        userId: 'agent_1',
        enabled: false,
        isActive: false,
      },
      { user_id: 'admin_1' },
    );

    const waitingUserAfter = await service.adminGetSupportConversation(
      waitingUserConversation.id,
    );
    expect(waitingUserAfter.assignedAgentId).toBeUndefined();
    expect(waitingUserAfter.status).toBe(
      SupportConversationStatus.WAITING_USER,
    );

    const resolvedAfter = await service.adminGetSupportConversation(
      resolvedConversation.id,
    );
    expect(resolvedAfter.assignedAgentId).toBeUndefined();
    expect(resolvedAfter.status).toBe(SupportConversationStatus.RESOLVED);

    const inProgressAfter = await service.adminGetSupportConversation(
      inProgressConversation.id,
    );
    expect(inProgressAfter.assignedAgentId).toBe('agent_2');
    expect(inProgressAfter.status).toBe(SupportConversationStatus.IN_PROGRESS);

    const auditPage = await service.getSupportConversationAuditLogs(
      { user_id: 'agent_2' },
      waitingUserConversation.id,
      {
        action: SupportConversationAuditAction.UNASSIGNED,
        page: { limit: 10, offset: 0 },
      },
    );

    expect(auditPage.total).toBe(1);
    expect(auditPage.items[0]?.actor).toBe('admin:admin_1');
    expect(auditPage.items[0]?.assignedAgentId).toBe('agent_1');
  });
});
