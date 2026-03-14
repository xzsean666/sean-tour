<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Button from 'primevue/button';
import Card from 'primevue/card';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
import {
  adminSupportService,
} from '../api/adminSupportService';
import {
  supportService,
  type SupportAgentProfile,
  type SupportConversationAuditAction,
  type SupportConversationAuditItem,
  type SupportConversationItem,
  type SupportConversationPriority,
  type SupportConversationSlaStatus,
  type SupportConversationStatus,
  type SupportMessageItem,
  type SupportConversationWorkspaceMeta,
  type SupportWorkspaceConfig,
  type SupportWorkspaceTemplate,
} from '../api/supportService';
import { useAuthStore } from '../stores/auth.store';

type StatusFilter = '' | SupportConversationStatus;
type QueuePreset =
  | 'ALL'
  | 'WAITING_AGENT'
  | 'NEED_AGENT_REPLY'
  | 'WAITING_USER'
  | 'RESOLVED'
  | 'CLOSED'
  | 'CUSTOM';

const PAGE_SIZE = 20;
const AUDIT_PAGE_SIZE = 12;
const SUPPORT_STATUS_OPTIONS: SupportConversationStatus[] = [
  'WAITING_AGENT',
  'IN_PROGRESS',
  'WAITING_USER',
  'RESOLVED',
  'CLOSED',
];
const SUPPORT_PRIORITY_OPTIONS: SupportConversationPriority[] = [
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT',
];
const SUPPORT_AUDIT_ACTION_OPTIONS: SupportConversationAuditAction[] = [
  'USER_MESSAGE',
  'AGENT_REPLY',
  'ASSIGNED',
  'UNASSIGNED',
  'RESOLVED',
  'INTERNAL_NOTE_UPDATED',
  'TRIAGE_UPDATED',
  'CLOSED',
  'REOPENED',
];
const SUPPORT_ROUTE_QUERY_KEYS = [
  'conversationId',
  'userId',
  'status',
  'priority',
  'onlyMine',
  'unassignedOnly',
  'hasUnreadForAgents',
  'hasUnreadForUser',
  'offset',
  'selectedConversation',
  'auditActor',
  'auditAction',
] as const;
const route = useRoute();
const router = useRouter();
const { backendUser } = useAuthStore();

const conversations = ref<SupportConversationItem[]>([]);
const adminAgents = ref<SupportAgentProfile[]>([]);
const agentProfile = ref<SupportAgentProfile | null>(null);
const selectedConversation = ref<SupportConversationItem | null>(null);
const workspaceMeta = ref<SupportConversationWorkspaceMeta | null>(null);
const workspaceMetaByConversationId = ref<Record<string, SupportConversationWorkspaceMeta>>({});
const workspaceConfig = ref<SupportWorkspaceConfig | null>(null);
const auditEntries = ref<SupportConversationAuditItem[]>([]);
const selectedConversationId = ref('');

const total = ref(0);
const offset = ref(0);
const hasMore = ref(false);
const auditTotal = ref(0);
const auditHasMore = ref(false);

const listLoading = ref(false);
const detailLoading = ref(false);
const replyLoading = ref(false);
const agentLoading = ref(false);
const noteLoading = ref(false);
const auditLoading = ref(false);
const auditExporting = ref(false);
const resolveLoading = ref(false);
const noteSaving = ref(false);
const triageSaving = ref(false);
const closeLoading = ref(false);
const workspaceConfigLoading = ref(false);
const workspaceConfigSaving = ref(false);

const errorMessage = ref('');
const successMessage = ref('');
const replyDraft = ref('');
const internalNoteDraft = ref('');
const priorityDraft = ref<SupportConversationPriority>('NORMAL');
const tagsDraft = ref('');
const closeReasonDraft = ref('');
const agentAccessDenied = ref(false);
const assignAgentUserId = ref('');
const skipNextRouteWatch = ref(false);
const issueStartersDraft = ref('');
const quickReplyTemplatesDraft = ref('');
const commonTagsDraft = ref('');

const filters = reactive({
  conversationId: '',
  userId: '',
  status: '' as StatusFilter,
  priority: '' as '' | SupportConversationPriority,
  onlyMine: true,
  unassignedOnly: false,
  hasUnreadForAgents: false,
  hasUnreadForUser: false,
});

const auditFilters = reactive({
  actor: '',
  action: '' as '' | SupportConversationAuditAction,
});

const hasAdminAccess = computed(() => !!backendUser.value?.isAdmin);
const hasPrevPage = computed(() => offset.value > 0);
const hasNextPage = computed(() => hasMore.value);
const canReply = computed(
  () =>
    !!agentProfile.value &&
    !!selectedConversation.value &&
    !!replyDraft.value.trim() &&
    !replyLoading.value,
);
const supportQuickReplyTemplates = computed<SupportWorkspaceTemplate[]>(() => {
  return workspaceConfig.value?.quickReplyTemplates || [];
});
const supportCommonTags = computed<string[]>(() => {
  return workspaceConfig.value?.commonTags || [];
});
const activeQueuePreset = computed<QueuePreset>(() => {
  if (
    !filters.status &&
    !filters.hasUnreadForAgents &&
    !filters.hasUnreadForUser
  ) {
    return 'ALL';
  }

  if (
    !filters.status &&
    filters.hasUnreadForAgents &&
    !filters.hasUnreadForUser
  ) {
    return 'NEED_AGENT_REPLY';
  }

  if (
    filters.status === 'WAITING_AGENT' &&
    !filters.hasUnreadForAgents &&
    !filters.hasUnreadForUser
  ) {
    return 'WAITING_AGENT';
  }

  if (
    filters.status === 'WAITING_USER' &&
    !filters.hasUnreadForAgents &&
    !filters.hasUnreadForUser
  ) {
    return 'WAITING_USER';
  }

  if (
    filters.status === 'RESOLVED' &&
    !filters.hasUnreadForAgents &&
    !filters.hasUnreadForUser
  ) {
    return 'RESOLVED';
  }

  if (
    filters.status === 'CLOSED' &&
    !filters.hasUnreadForAgents &&
    !filters.hasUnreadForUser
  ) {
    return 'CLOSED';
  }

  return 'CUSTOM';
});
const latestReopenedEntry = computed<SupportConversationAuditItem | null>(() => {
  return (
    auditEntries.value.find((entry) => entry.action === 'REOPENED') || null
  );
});
const workspaceMode = computed<'agent' | 'admin' | 'none'>(() => {
  if (agentProfile.value) {
    return 'agent';
  }

  if (hasAdminAccess.value) {
    return 'admin';
  }

  return 'none';
});

function formatDate(value: string): string {
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusSeverity(
  status: SupportConversationStatus,
): 'success' | 'info' | 'warn' | 'danger' | 'contrast' {
  if (status === 'WAITING_USER') {
    return 'success';
  }

  if (status === 'IN_PROGRESS') {
    return 'info';
  }

  if (status === 'CLOSED') {
    return 'contrast';
  }

  if (status === 'RESOLVED') {
    return 'success';
  }

  return 'warn';
}

function getPrioritySeverity(
  priority: SupportConversationPriority,
): 'success' | 'info' | 'warn' | 'danger' {
  if (priority === 'LOW') {
    return 'success';
  }

  if (priority === 'HIGH') {
    return 'warn';
  }

  if (priority === 'URGENT') {
    return 'danger';
  }

  return 'info';
}

function getSlaSeverity(
  status: SupportConversationSlaStatus,
): 'success' | 'warn' | 'danger' {
  if (status === 'OVERDUE') {
    return 'danger';
  }

  if (status === 'DUE_SOON') {
    return 'warn';
  }

  return 'success';
}

function getAuditSeverity(
  action: SupportConversationAuditAction,
): 'success' | 'info' | 'warn' | 'danger' | 'contrast' {
  if (action === 'AGENT_REPLY') {
    return 'success';
  }

  if (action === 'RESOLVED') {
    return 'success';
  }

  if (action === 'UNASSIGNED') {
    return 'warn';
  }

  if (action === 'CLOSED') {
    return 'contrast';
  }

  if (action === 'TRIAGE_UPDATED') {
    return 'warn';
  }

  if (action === 'REOPENED') {
    return 'danger';
  }

  return 'info';
}

function isUserMessage(message: SupportMessageItem): boolean {
  return message.senderRole === 'USER';
}

function formatActorLabel(actor: string): string {
  if (actor.startsWith('support_agent:')) {
    return `Support ${actor.slice('support_agent:'.length)}`;
  }

  if (actor.startsWith('admin:')) {
    return `Admin ${actor.slice('admin:'.length)}`;
  }

  if (actor.startsWith('user:')) {
    return `User ${actor.slice('user:'.length)}`;
  }

  return actor;
}

function readRouteQueryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return readRouteQueryValue(value[0]);
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
}

function parseRouteBoolean(value: unknown, fallback: boolean): boolean {
  const normalized = readRouteQueryValue(value)?.toLowerCase();
  if (!normalized) {
    return fallback;
  }

  if (['1', 'true', 'yes'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function parseRouteOffset(value: unknown): number {
  const normalized = readRouteQueryValue(value);
  if (!normalized) {
    return 0;
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

function parseStatusFilter(value: unknown): StatusFilter {
  const normalized = readRouteQueryValue(value);
  if (
    normalized &&
    SUPPORT_STATUS_OPTIONS.includes(normalized as SupportConversationStatus)
  ) {
    return normalized as SupportConversationStatus;
  }

  return '';
}

function parsePriorityFilter(
  value: unknown,
): '' | SupportConversationPriority {
  const normalized = readRouteQueryValue(value);
  if (
    normalized &&
    SUPPORT_PRIORITY_OPTIONS.includes(normalized as SupportConversationPriority)
  ) {
    return normalized as SupportConversationPriority;
  }

  return '';
}

function parseAuditActionFilter(
  value: unknown,
): '' | SupportConversationAuditAction {
  const normalized = readRouteQueryValue(value);
  if (
    normalized &&
    SUPPORT_AUDIT_ACTION_OPTIONS.includes(
      normalized as SupportConversationAuditAction,
    )
  ) {
    return normalized as SupportConversationAuditAction;
  }

  return '';
}

function getDefaultOnlyMine(): boolean {
  return workspaceMode.value === 'agent';
}

function syncFiltersFromRoute(): void {
  filters.conversationId = readRouteQueryValue(route.query.conversationId) || '';
  filters.userId = readRouteQueryValue(route.query.userId) || '';
  filters.status = parseStatusFilter(route.query.status);
  filters.priority = parsePriorityFilter(route.query.priority);
  filters.onlyMine = parseRouteBoolean(
    route.query.onlyMine,
    getDefaultOnlyMine(),
  );
  filters.unassignedOnly = parseRouteBoolean(
    route.query.unassignedOnly,
    false,
  );
  filters.hasUnreadForAgents = parseRouteBoolean(
    route.query.hasUnreadForAgents,
    false,
  );
  filters.hasUnreadForUser = parseRouteBoolean(
    route.query.hasUnreadForUser,
    false,
  );
  selectedConversationId.value =
    readRouteQueryValue(route.query.selectedConversation) || '';
  auditFilters.actor = readRouteQueryValue(route.query.auditActor) || '';
  auditFilters.action = parseAuditActionFilter(route.query.auditAction);
  offset.value = parseRouteOffset(route.query.offset);
}

function buildRouteQuery(): Record<string, string> {
  const query: Record<string, string> = {};

  if (filters.conversationId.trim()) {
    query.conversationId = filters.conversationId.trim();
  }

  if (filters.userId.trim()) {
    query.userId = filters.userId.trim();
  }

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.priority) {
    query.priority = filters.priority;
  }

  if (filters.onlyMine !== getDefaultOnlyMine()) {
    query.onlyMine = String(filters.onlyMine);
  }

  if (filters.unassignedOnly) {
    query.unassignedOnly = 'true';
  }

  if (filters.hasUnreadForAgents) {
    query.hasUnreadForAgents = 'true';
  }

  if (filters.hasUnreadForUser) {
    query.hasUnreadForUser = 'true';
  }

  if (offset.value > 0) {
    query.offset = String(offset.value);
  }

  if (selectedConversationId.value) {
    query.selectedConversation = selectedConversationId.value;
  }

  if (auditFilters.actor.trim()) {
    query.auditActor = auditFilters.actor.trim();
  }

  if (auditFilters.action) {
    query.auditAction = auditFilters.action;
  }

  return query;
}

function getCurrentRouteQuery(): Record<string, string> {
  const current: Record<string, string> = {};

  SUPPORT_ROUTE_QUERY_KEYS.forEach((key) => {
    const value = readRouteQueryValue(route.query[key]);
    if (value) {
      current[key] = value;
    }
  });

  return current;
}

function isSameRouteQuery(
  left: Record<string, string>,
  right: Record<string, string>,
): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every(
    (key, index) => key === rightKeys[index] && left[key] === right[key],
  );
}

async function syncRouteQuery(): Promise<void> {
  const nextQuery = buildRouteQuery();
  if (isSameRouteQuery(nextQuery, getCurrentRouteQuery())) {
    return;
  }

  skipNextRouteWatch.value = true;
  await router.replace({
    query: nextQuery,
  });
}

function applyQueuePreset(preset: QueuePreset): void {
  filters.status = '';
  filters.hasUnreadForAgents = false;
  filters.hasUnreadForUser = false;

  if (preset === 'WAITING_AGENT') {
    filters.status = 'WAITING_AGENT';
  } else if (preset === 'NEED_AGENT_REPLY') {
    filters.hasUnreadForAgents = true;
  } else if (preset === 'WAITING_USER') {
    filters.status = 'WAITING_USER';
  } else if (preset === 'RESOLVED') {
    filters.status = 'RESOLVED';
  } else if (preset === 'CLOSED') {
    filters.status = 'CLOSED';
  }

  void applyFilters();
}

function getWorkspaceMeta(
  conversationId: string,
): SupportConversationWorkspaceMeta | undefined {
  return workspaceMetaByConversationId.value[conversationId];
}

function resetAuditLogs(): void {
  auditEntries.value = [];
  auditTotal.value = 0;
  auditHasMore.value = false;
}

function toCsvCell(value: string | undefined): string {
  const normalized = value || '';
  return `"${normalized.replace(/"/g, '""')}"`;
}

function getDraftTags(): string[] {
  return tagsDraft.value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => !!item);
}

function serializeWorkspaceTemplates(templates: SupportWorkspaceTemplate[]): string {
  return templates.map((template) => `${template.label} :: ${template.content}`).join('\n');
}

function applyWorkspaceConfigDraft(config: SupportWorkspaceConfig): void {
  issueStartersDraft.value = serializeWorkspaceTemplates(config.issueStarters);
  quickReplyTemplatesDraft.value = serializeWorkspaceTemplates(config.quickReplyTemplates);
  commonTagsDraft.value = config.commonTags.join(', ');
}

function parseWorkspaceTemplates(
  value: string,
  fieldLabel: string,
): SupportWorkspaceTemplate[] {
  const lines = value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => !!line);

  return lines.map((line, index) => {
    const separatorIndex = line.indexOf('::');
    if (separatorIndex === -1) {
      throw new Error(`${fieldLabel} line ${index + 1} must use "Label :: Content".`);
    }

    const label = line.slice(0, separatorIndex).trim();
    const content = line.slice(separatorIndex + 2).trim();
    if (!label || !content) {
      throw new Error(`${fieldLabel} line ${index + 1} must include both label and content.`);
    }

    return {
      label,
      content,
    };
  });
}

function appendReplyTemplate(content: string): void {
  replyDraft.value = replyDraft.value.trim()
    ? `${replyDraft.value.trim()}\n\n${content}`
    : content;
}

function toggleSuggestedTag(tag: string): void {
  const tags = getDraftTags();
  const next = tags.includes(tag)
    ? tags.filter((item) => item !== tag)
    : [...tags, tag];
  tagsDraft.value = next.join(', ');
}

function isSuggestedTagSelected(tag: string): boolean {
  return getDraftTags().includes(tag);
}

async function loadWorkspaceMetas(conversationIds: string[]): Promise<void> {
  if (conversationIds.length === 0) {
    workspaceMetaByConversationId.value = {};
    return;
  }

  try {
    const metas = await supportService.getConversationWorkspaceMetas(
      conversationIds,
    );
    workspaceMetaByConversationId.value = Object.fromEntries(
      metas.map((item) => [item.conversationId, item]),
    );
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to load workspace triage.';
  }
}

async function loadAuditLogs(
  conversationId: string,
  nextOffset: number = 0,
  append: boolean = false,
): Promise<void> {
  auditLoading.value = true;

  try {
    const result = await supportService.getConversationAuditLogs(conversationId, {
      limit: AUDIT_PAGE_SIZE,
      offset: Math.max(nextOffset, 0),
      actor: auditFilters.actor.trim() || undefined,
      action: auditFilters.action || undefined,
    });
    auditEntries.value = append
      ? [...auditEntries.value, ...result.items]
      : result.items;
    auditTotal.value = result.total;
    auditHasMore.value = result.hasMore;
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to load conversation audit logs.';
  } finally {
    auditLoading.value = false;
  }
}

async function loadMoreAuditLogs(): Promise<void> {
  if (!selectedConversation.value || !auditHasMore.value || auditLoading.value) {
    return;
  }

  await loadAuditLogs(selectedConversation.value.id, auditEntries.value.length, true);
}

async function applyAuditFilters(): Promise<void> {
  if (!selectedConversation.value) {
    return;
  }

  await loadAuditLogs(selectedConversation.value.id);
  await syncRouteQuery();
}

async function resetAuditFilters(): Promise<void> {
  auditFilters.actor = '';
  auditFilters.action = '';
  if (!selectedConversation.value) {
    await syncRouteQuery();
    return;
  }

  await applyAuditFilters();
}

async function exportAuditLogs(): Promise<void> {
  if (!selectedConversation.value) {
    return;
  }

  auditExporting.value = true;

  try {
    const allItems: SupportConversationAuditItem[] = [];
    let nextOffset = 0;

    while (true) {
      const result = await supportService.getConversationAuditLogs(
        selectedConversation.value.id,
        {
          limit: 100,
          offset: nextOffset,
          actor: auditFilters.actor.trim() || undefined,
          action: auditFilters.action || undefined,
        },
      );
      allItems.push(...result.items);

      if (!result.hasMore || result.items.length === 0) {
        break;
      }

      nextOffset += result.items.length;
    }

    const csv = [
      [
        'createdAt',
        'action',
        'actor',
        'summary',
        'priority',
        'tags',
        'assignedAgentId',
        'closeReason',
        'reopenedFromStatus',
        'messagePreview',
      ].join(','),
      ...allItems.map((entry) =>
        [
          toCsvCell(entry.createdAt),
          toCsvCell(entry.action),
          toCsvCell(entry.actor),
          toCsvCell(entry.summary),
          toCsvCell(entry.priority),
          toCsvCell(entry.tags.join('|')),
          toCsvCell(entry.assignedAgentId),
          toCsvCell(entry.closeReason),
          toCsvCell(entry.reopenedFromStatus),
          toCsvCell(entry.messagePreview),
        ].join(','),
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = `support-audit-${selectedConversation.value.id}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to export conversation audit logs.';
  } finally {
    auditExporting.value = false;
  }
}

async function loadAgentProfile(): Promise<void> {
  agentLoading.value = true;

  try {
    agentProfile.value = await supportService.getMyAgentProfile();
    agentAccessDenied.value = false;
  } catch {
    agentProfile.value = null;
    agentAccessDenied.value = true;
  } finally {
    agentLoading.value = false;
  }
}

async function loadAdminAgents(): Promise<void> {
  if (!hasAdminAccess.value) {
    adminAgents.value = [];
    return;
  }

  try {
    adminAgents.value = await adminSupportService.listAgents();
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to load support agents.';
  }
}

async function loadWorkspaceConfig(): Promise<void> {
  workspaceConfigLoading.value = true;

  try {
    workspaceConfig.value = await supportService.getWorkspaceConfig();
    applyWorkspaceConfigDraft(workspaceConfig.value);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to load support workspace config.';
  } finally {
    workspaceConfigLoading.value = false;
  }
}

async function loadConversations(
  nextOffset: number = offset.value,
  syncRoute: boolean = true,
): Promise<void> {
  listLoading.value = true;
  errorMessage.value = '';
  let shouldSyncRouteAfterLoad = false;

  try {
    const params = {
      conversationId: filters.conversationId.trim() || undefined,
      userId: filters.userId.trim() || undefined,
      status: filters.status || undefined,
      priority: filters.priority || undefined,
      onlyMine: filters.onlyMine,
      unassignedOnly: filters.unassignedOnly,
      hasUnreadForAgents: filters.hasUnreadForAgents || undefined,
      hasUnreadForUser: filters.hasUnreadForUser || undefined,
      limit: PAGE_SIZE,
      offset: Math.max(nextOffset, 0),
    };

    const result =
      workspaceMode.value === 'agent'
        ? await supportService.listQueue(params)
        : workspaceMode.value === 'admin'
          ? await adminSupportService.listConversations(params)
          : { items: [], total: 0, limit: PAGE_SIZE, offset: 0, hasMore: false };

    conversations.value = result.items;
    await loadWorkspaceMetas(result.items.map((item) => item.id));
    total.value = result.total;
    offset.value = result.offset;
    hasMore.value = result.hasMore;

    if (selectedConversationId.value) {
      const stillExists = result.items.some((item) => item.id === selectedConversationId.value);
      if (!stillExists) {
        selectedConversation.value = null;
        selectedConversationId.value = '';
        workspaceMeta.value = null;
        workspaceMetaByConversationId.value = {};
        resetAuditLogs();
        internalNoteDraft.value = '';
        priorityDraft.value = 'NORMAL';
        tagsDraft.value = '';
        closeReasonDraft.value = '';
        shouldSyncRouteAfterLoad = true;
      } else if (selectedConversation.value?.id !== selectedConversationId.value) {
        await selectConversation(selectedConversationId.value, syncRoute);
      }
    }

    if (!selectedConversationId.value && result.items.length > 0) {
      await selectConversation(result.items[0].id, syncRoute);
      shouldSyncRouteAfterLoad = true;
    } else if (result.items.length === 0) {
      workspaceMeta.value = null;
      workspaceMetaByConversationId.value = {};
      resetAuditLogs();
      internalNoteDraft.value = '';
      priorityDraft.value = 'NORMAL';
      tagsDraft.value = '';
      closeReasonDraft.value = '';
      shouldSyncRouteAfterLoad = true;
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to load support conversations.';
  } finally {
    listLoading.value = false;
  }

  if (syncRoute || shouldSyncRouteAfterLoad) {
    await syncRouteQuery();
  }
}

async function selectConversation(
  conversationId: string,
  syncRoute: boolean = true,
): Promise<void> {
  selectedConversationId.value = conversationId;
  detailLoading.value = true;
  errorMessage.value = '';
  resetAuditLogs();

  try {
    const detail =
      workspaceMode.value === 'agent'
        ? await supportService.getConversationDetail(conversationId)
        : await adminSupportService.getConversationDetail(conversationId);
    selectedConversation.value = detail;
    assignAgentUserId.value = detail.assignedAgentId || '';
    await Promise.all([
      loadWorkspaceMeta(conversationId),
      loadAuditLogs(conversationId),
    ]);
  } catch (error) {
    workspaceMeta.value = null;
    resetAuditLogs();
    priorityDraft.value = 'NORMAL';
    tagsDraft.value = '';
    internalNoteDraft.value = '';
    closeReasonDraft.value = '';
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to load conversation detail.';
  } finally {
    detailLoading.value = false;
  }

  if (syncRoute) {
    await syncRouteQuery();
  }
}

async function loadWorkspaceMeta(conversationId: string): Promise<void> {
  noteLoading.value = true;

  try {
    workspaceMeta.value = await supportService.getConversationWorkspaceMeta(conversationId);
    workspaceMetaByConversationId.value = {
      ...workspaceMetaByConversationId.value,
      [conversationId]: workspaceMeta.value,
    };
    priorityDraft.value = workspaceMeta.value.priority;
    tagsDraft.value = workspaceMeta.value.tags.join(', ');
    internalNoteDraft.value = workspaceMeta.value.internalNote || '';
    closeReasonDraft.value = workspaceMeta.value.closeReason || '';
  } catch (error) {
    workspaceMeta.value = null;
    priorityDraft.value = 'NORMAL';
    tagsDraft.value = '';
    internalNoteDraft.value = '';
    closeReasonDraft.value = '';
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to load workspace notes.';
  } finally {
    noteLoading.value = false;
  }
}

async function applyFilters(): Promise<void> {
  await loadConversations(0);
}

async function submitReply(): Promise<void> {
  const current = selectedConversation.value;
  if (!current || !agentProfile.value) {
    return;
  }

  const content = replyDraft.value.trim();
  if (!content) {
    errorMessage.value = 'Type a reply before sending.';
    return;
  }

  replyLoading.value = true;
  errorMessage.value = '';
  successMessage.value = '';

  try {
    const updated = await supportService.replyToConversation(current.id, content);
    selectedConversation.value = updated;
    await Promise.all([
      loadWorkspaceMeta(updated.id),
      loadAuditLogs(updated.id),
    ]);
    replyDraft.value = '';
    successMessage.value = `Reply sent to ${updated.userId}.`;
    await loadConversations(offset.value);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to reply to conversation.';
  } finally {
    replyLoading.value = false;
  }
}

async function resolveConversation(): Promise<void> {
  if (!selectedConversation.value) {
    return;
  }

  resolveLoading.value = true;
  errorMessage.value = '';
  successMessage.value = '';

  try {
    const updated = await supportService.resolveConversation(
      selectedConversation.value.id,
    );
    selectedConversation.value = updated;
    await Promise.all([
      loadWorkspaceMeta(updated.id),
      loadAuditLogs(updated.id),
    ]);
    successMessage.value = `Conversation ${updated.id} marked as resolved.`;
    await loadConversations(offset.value);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to resolve conversation.';
  } finally {
    resolveLoading.value = false;
  }
}

async function saveInternalNote(): Promise<void> {
  if (!selectedConversation.value) {
    return;
  }

  const conversationId = selectedConversation.value.id;
  noteSaving.value = true;
  errorMessage.value = '';
  successMessage.value = '';

  try {
    workspaceMeta.value = await supportService.setConversationInternalNote(
      conversationId,
      internalNoteDraft.value.trim() || undefined,
    );
    workspaceMetaByConversationId.value = {
      ...workspaceMetaByConversationId.value,
      [conversationId]: workspaceMeta.value,
    };
    internalNoteDraft.value = workspaceMeta.value.internalNote || '';
    await loadAuditLogs(conversationId);
    successMessage.value = 'Internal note saved.';
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to save internal note.';
  } finally {
    noteSaving.value = false;
  }
}

async function saveTriage(): Promise<void> {
  if (!selectedConversation.value) {
    return;
  }

  const conversationId = selectedConversation.value.id;
  triageSaving.value = true;
  errorMessage.value = '';
  successMessage.value = '';

  try {
    workspaceMeta.value = await supportService.setConversationTriage(
      conversationId,
      priorityDraft.value,
      tagsDraft.value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => !!item),
    );
    workspaceMetaByConversationId.value = {
      ...workspaceMetaByConversationId.value,
      [conversationId]: workspaceMeta.value,
    };
    priorityDraft.value = workspaceMeta.value.priority;
    tagsDraft.value = workspaceMeta.value.tags.join(', ');
    await loadAuditLogs(conversationId);
    successMessage.value = 'Triage updated.';
    await loadConversations(offset.value);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to save conversation triage.';
  } finally {
    triageSaving.value = false;
  }
}

async function toggleAgentActive(): Promise<void> {
  if (!agentProfile.value) {
    return;
  }

  errorMessage.value = '';
  successMessage.value = '';

  try {
    agentProfile.value = await supportService.setMyAgentActive(!agentProfile.value.isActive);
    successMessage.value = agentProfile.value.isActive
      ? 'You are now active for automatic assignment.'
      : 'You are paused and will not receive new auto-assigned chats.';
    await loadConversations(0);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to update agent status.';
  }
}

async function assignConversation(): Promise<void> {
  if (!hasAdminAccess.value || !selectedConversation.value) {
    return;
  }

  const agentUserId = assignAgentUserId.value.trim();
  if (!agentUserId) {
    errorMessage.value = 'Enter an agent user ID before assigning.';
    return;
  }

  errorMessage.value = '';
  successMessage.value = '';

  try {
    const updated = await adminSupportService.assignConversation({
      conversationId: selectedConversation.value.id,
      agentUserId,
    });

    selectedConversation.value = updated;
    successMessage.value = `Conversation ${updated.id} assigned to ${agentUserId}.`;
    await loadAuditLogs(updated.id);
    await loadAdminAgents();
    await loadConversations(offset.value);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to assign conversation.';
  }
}

async function closeConversation(): Promise<void> {
  if (!hasAdminAccess.value || !selectedConversation.value) {
    return;
  }

  closeLoading.value = true;
  errorMessage.value = '';
  successMessage.value = '';

  try {
    const updated = await adminSupportService.closeConversation({
      conversationId: selectedConversation.value.id,
      closeReason: closeReasonDraft.value.trim() || undefined,
    });
    selectedConversation.value = updated;
    await Promise.all([
      loadWorkspaceMeta(updated.id),
      loadAuditLogs(updated.id),
    ]);
    successMessage.value = `Conversation ${updated.id} closed.`;
    await loadConversations(offset.value);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to close conversation.';
  } finally {
    closeLoading.value = false;
  }
}

async function saveWorkspaceConfig(): Promise<void> {
  if (!hasAdminAccess.value) {
    return;
  }

  workspaceConfigSaving.value = true;
  errorMessage.value = '';
  successMessage.value = '';

  try {
    const updated = await adminSupportService.upsertWorkspaceConfig({
      issueStarters: parseWorkspaceTemplates(
        issueStartersDraft.value,
        'Issue starters',
      ),
      quickReplyTemplates: parseWorkspaceTemplates(
        quickReplyTemplatesDraft.value,
        'Quick replies',
      ),
      commonTags: commonTagsDraft.value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter((item) => !!item),
    });
    workspaceConfig.value = updated;
    applyWorkspaceConfigDraft(updated);
    successMessage.value = 'Support workspace config saved.';
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to save support workspace config.';
  } finally {
    workspaceConfigSaving.value = false;
  }
}

function resetWorkspaceConfigDraft(): void {
  if (!workspaceConfig.value) {
    return;
  }

  applyWorkspaceConfigDraft(workspaceConfig.value);
}

async function openSupportAccess(): Promise<void> {
  await router.push({
    path: '/admin/access',
    query: {
      role: 'support',
    },
  });
}

onMounted(async () => {
  await loadAgentProfile();
  await loadAdminAgents();
  await loadWorkspaceConfig();
  syncFiltersFromRoute();
  await loadConversations(offset.value, false);
});

watch(
  () => route.query,
  async () => {
    if (skipNextRouteWatch.value) {
      skipNextRouteWatch.value = false;
      return;
    }

    syncFiltersFromRoute();
    await loadConversations(offset.value, false);
  },
);
</script>

<template>
  <section
    class="relative overflow-hidden rounded-3xl border border-[#0c6d64]/20 bg-gradient-to-br from-[#082f34] via-[#12544c] to-[#18324d] px-6 py-8 text-white shadow-[0_26px_90px_-55px_rgba(7,41,46,0.95)]"
  >
    <div class="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[#f8b03c]/20 blur-3xl" />
    <div class="absolute -left-16 -bottom-24 h-52 w-52 rounded-full bg-[#2ad0a1]/18 blur-3xl" />

    <p class="relative text-xs font-semibold uppercase tracking-[0.16em] text-teal-100/90">
      Support Workspace
    </p>
    <h1 class="relative mt-2 text-3xl font-semibold leading-tight">Agent Queue & Account Control</h1>
    <p class="relative mt-3 max-w-3xl text-sm leading-6 text-teal-50/90">
      Agents handle live customer conversations here. Accounts with backend admin access also get
      account assignment and manual re-routing controls.
    </p>
  </section>

  <Message v-if="errorMessage" severity="error" class="mt-4">{{ errorMessage }}</Message>
  <Message v-if="successMessage" severity="success" class="mt-4">{{ successMessage }}</Message>
  <Message
    v-if="agentAccessDenied && !hasAdminAccess"
    severity="warn"
    class="mt-4"
  >
    This account is not enabled as a support agent. Ask an admin to grant support access first.
  </Message>

  <section v-if="hasAdminAccess" class="mt-6">
    <Card class="!rounded-3xl !border !border-slate-200/90 !bg-white/95">
      <template #title>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">Workspace Content Config</h2>
            <p class="mt-1 text-sm text-slate-600">
              Manage customer issue starters, agent quick replies, and shared support tags here.
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <Tag
              v-if="workspaceConfig?.updatedAt"
              :value="`Updated ${formatDate(workspaceConfig.updatedAt)}`"
              severity="contrast"
              rounded
            />
            <Tag
              v-if="workspaceConfig?.updatedBy"
              :value="workspaceConfig.updatedBy"
              severity="secondary"
              rounded
            />
          </div>
        </div>
      </template>

      <template #content>
        <div v-if="workspaceConfigLoading" class="flex justify-center py-8">
          <ProgressSpinner style="width: 32px; height: 32px" stroke-width="6" />
        </div>

        <div v-else class="space-y-4">
          <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            One item per line, format <code>Label :: Content</code>
          </p>
          <div class="grid gap-4 xl:grid-cols-3">
            <label class="space-y-2">
              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                User Issue Starters
              </span>
              <Textarea
                v-model="issueStartersDraft"
                rows="8"
                auto-resize
                class="w-full"
                placeholder="Payment Question :: I need help checking the payment status for my booking."
              />
            </label>
            <label class="space-y-2">
              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Agent Quick Replies
              </span>
              <Textarea
                v-model="quickReplyTemplatesDraft"
                rows="8"
                auto-resize
                class="w-full"
                placeholder="Checking Status :: Thanks for the update. I am checking the latest status now."
              />
            </label>
            <label class="space-y-2">
              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Common Tags
              </span>
              <Textarea
                v-model="commonTagsDraft"
                rows="8"
                auto-resize
                class="w-full"
                placeholder="vip, payment, booking-change"
              />
            </label>
          </div>

          <div class="flex flex-wrap gap-2">
            <Button
              label="Save Config"
              icon="pi pi-save"
              class="!rounded-xl"
              :loading="workspaceConfigSaving"
              @click="saveWorkspaceConfig"
            />
            <Button
              label="Reset Draft"
              icon="pi pi-refresh"
              severity="secondary"
              outlined
              class="!rounded-xl"
              :disabled="workspaceConfigSaving || !workspaceConfig"
              @click="resetWorkspaceConfigDraft"
            />
          </div>
        </div>
      </template>
    </Card>
  </section>

  <section class="mt-6 grid gap-4 xl:grid-cols-[1.04fr_0.96fr]">
    <Card class="!rounded-3xl !border !border-slate-200/90 !bg-white/95">
      <template #title>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">Conversation Queue</h2>
            <p class="mt-1 text-sm text-slate-600">
              {{ workspaceMode === 'agent' ? 'Live queue for your support account.' : 'Admin queue preview.' }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <Tag :value="`Total ${total}`" severity="contrast" rounded />
            <Button
              label="Reload"
              icon="pi pi-refresh"
              text
              :loading="listLoading"
              @click="loadConversations(offset)"
            />
          </div>
        </div>
      </template>

      <template #content>
        <div class="flex flex-wrap gap-2">
          <Button
            label="All Activity"
            size="small"
            class="!rounded-full"
            :severity="activeQueuePreset === 'ALL' ? 'contrast' : 'secondary'"
            :outlined="activeQueuePreset !== 'ALL'"
            @click="applyQueuePreset('ALL')"
          />
          <Button
            label="Waiting Agent"
            size="small"
            class="!rounded-full"
            :severity="activeQueuePreset === 'WAITING_AGENT' ? 'warn' : 'secondary'"
            :outlined="activeQueuePreset !== 'WAITING_AGENT'"
            @click="applyQueuePreset('WAITING_AGENT')"
          />
          <Button
            label="Need Agent Reply"
            size="small"
            class="!rounded-full"
            :severity="activeQueuePreset === 'NEED_AGENT_REPLY' ? 'danger' : 'secondary'"
            :outlined="activeQueuePreset !== 'NEED_AGENT_REPLY'"
            @click="applyQueuePreset('NEED_AGENT_REPLY')"
          />
          <Button
            label="Waiting User"
            size="small"
            class="!rounded-full"
            :severity="activeQueuePreset === 'WAITING_USER' ? 'success' : 'secondary'"
            :outlined="activeQueuePreset !== 'WAITING_USER'"
            @click="applyQueuePreset('WAITING_USER')"
          />
          <Button
            label="Resolved"
            size="small"
            class="!rounded-full"
            :severity="activeQueuePreset === 'RESOLVED' ? 'success' : 'secondary'"
            :outlined="activeQueuePreset !== 'RESOLVED'"
            @click="applyQueuePreset('RESOLVED')"
          />
          <Button
            label="Closed"
            size="small"
            class="!rounded-full"
            :severity="activeQueuePreset === 'CLOSED' ? 'contrast' : 'secondary'"
            :outlined="activeQueuePreset !== 'CLOSED'"
            @click="applyQueuePreset('CLOSED')"
          />
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <label class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Conversation ID
            </span>
            <InputText v-model="filters.conversationId" class="w-full" />
          </label>
          <label class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              User ID
            </span>
            <InputText v-model="filters.userId" class="w-full" />
          </label>
          <label class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Status
            </span>
            <select
              v-model="filters.status"
              class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="WAITING_AGENT">WAITING_AGENT</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="WAITING_USER">WAITING_USER</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </label>
          <label class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Priority
            </span>
            <select
              v-model="filters.priority"
              class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="LOW">LOW</option>
              <option value="NORMAL">NORMAL</option>
              <option value="HIGH">HIGH</option>
              <option value="URGENT">URGENT</option>
            </select>
          </label>
          <div class="grid gap-2">
            <label class="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
              <input
                v-model="filters.onlyMine"
                type="checkbox"
                :disabled="workspaceMode !== 'agent'"
              />
              {{ workspaceMode === 'agent' ? 'Assigned to me' : 'Assigned to current agent' }}
            </label>
            <label class="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
              <input v-model="filters.unassignedOnly" type="checkbox" />
              Unassigned only
            </label>
            <label class="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
              <input v-model="filters.hasUnreadForAgents" type="checkbox" />
              Agent unread only
            </label>
            <label class="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
              <input v-model="filters.hasUnreadForUser" type="checkbox" />
              User unread only
            </label>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          <Button
            label="Search"
            icon="pi pi-search"
            class="!rounded-xl"
            :loading="listLoading"
            @click="applyFilters"
          />
          <Button
            label="Reset"
            icon="pi pi-filter-slash"
            severity="secondary"
            outlined
            class="!rounded-xl"
            @click="
              () => {
                filters.conversationId = '';
                filters.userId = '';
                filters.status = '';
                filters.priority = '';
                filters.onlyMine = workspaceMode === 'agent';
                filters.unassignedOnly = false;
                filters.hasUnreadForAgents = false;
                filters.hasUnreadForUser = false;
                applyFilters();
              }
            "
          />
        </div>

        <div v-if="listLoading" class="flex justify-center py-10">
          <ProgressSpinner style="width: 36px; height: 36px" stroke-width="6" />
        </div>

        <div v-else class="mt-4 grid gap-2">
          <button
            v-for="conversation in conversations"
            :key="conversation.id"
            type="button"
            class="rounded-2xl border p-3 text-left transition"
            :class="
              selectedConversationId === conversation.id
                ? 'border-[#0f5b54] bg-[#f2faf8]'
                : 'border-slate-200 hover:border-slate-400'
            "
            @click="selectConversation(conversation.id)"
          >
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p class="font-semibold text-slate-900">{{ conversation.userId }}</p>
                <p class="mt-1 text-xs text-slate-500">{{ conversation.id }}</p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <Tag :value="conversation.status" :severity="getStatusSeverity(conversation.status)" rounded />
                <Tag
                  :value="getWorkspaceMeta(conversation.id)?.priority || 'NORMAL'"
                  :severity="getPrioritySeverity(getWorkspaceMeta(conversation.id)?.priority || 'NORMAL')"
                  rounded
                />
                <Tag
                  v-if="getWorkspaceMeta(conversation.id)?.slaStatus"
                  :value="getWorkspaceMeta(conversation.id)?.slaStatus || ''"
                  :severity="getSlaSeverity(getWorkspaceMeta(conversation.id)?.slaStatus || 'ON_TRACK')"
                  rounded
                />
                <Tag
                  v-if="conversation.assignedAgentId"
                  :value="conversation.assignedAgentId"
                  severity="contrast"
                  rounded
                />
                <Tag
                  v-if="conversation.unreadForAgents > 0"
                  :value="`Agent unread ${conversation.unreadForAgents}`"
                  severity="warn"
                  rounded
                />
                <Tag
                  v-if="conversation.unreadForUser > 0"
                  :value="`User unread ${conversation.unreadForUser}`"
                  severity="info"
                  rounded
                />
              </div>
            </div>
            <p class="mt-2 line-clamp-2 text-sm text-slate-600">
              {{ conversation.lastMessagePreview || 'No messages yet.' }}
            </p>
            <p class="mt-2 text-xs text-slate-500">
              updated: {{ formatDate(conversation.updatedAt) }}
            </p>
          </button>

          <p
            v-if="conversations.length === 0"
            class="rounded-xl border border-slate-200 px-3 py-6 text-sm text-slate-500"
          >
            No support conversations found for the current filter set.
          </p>

          <div
            v-if="conversations.length > 0"
            class="mt-1 flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
          >
            <p class="text-xs text-slate-600">
              Showing {{ conversations.length }} · Offset {{ offset }} · Total {{ total }}
            </p>
            <div class="flex items-center gap-2">
              <Button
                label="Previous"
                icon="pi pi-angle-left"
                text
                size="small"
                :disabled="!hasPrevPage || listLoading"
                @click="loadConversations(Math.max(offset - PAGE_SIZE, 0))"
              />
              <Button
                label="Next"
                icon="pi pi-angle-right"
                icon-pos="right"
                text
                size="small"
                :disabled="!hasNextPage || listLoading"
                @click="loadConversations(offset + PAGE_SIZE)"
              />
            </div>
          </div>
        </div>
      </template>
    </Card>

    <div class="grid gap-4">
      <Card class="!rounded-3xl !border !border-slate-200/90 !bg-white/95">
        <template #title>
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-lg font-semibold text-slate-900">Agent Status</h2>
            <Tag
              v-if="agentProfile"
              :value="agentProfile.isActive ? 'ACTIVE' : 'PAUSED'"
              :severity="agentProfile.isActive ? 'success' : 'warn'"
              rounded
            />
          </div>
        </template>
        <template #content>
          <div v-if="agentLoading" class="flex justify-center py-6">
            <ProgressSpinner style="width: 30px; height: 30px" stroke-width="6" />
          </div>
          <div v-else-if="agentProfile" class="space-y-3 text-sm text-slate-700">
            <p>
              Signed in as
              <span class="font-semibold text-slate-900">
                {{ agentProfile.displayName || agentProfile.email || agentProfile.userId }}
              </span>
            </p>
            <p>
              Open assigned conversations:
              <span class="font-semibold text-slate-900">
                {{ agentProfile.openConversationCount }}
              </span>
            </p>
            <p>
              Last assigned:
              <span class="font-semibold text-slate-900">
                {{ agentProfile.lastAssignedAt ? formatDate(agentProfile.lastAssignedAt) : 'Never' }}
              </span>
            </p>
            <Button
              :label="agentProfile.isActive ? 'Pause Auto Assign' : 'Go Active'"
              :icon="agentProfile.isActive ? 'pi pi-pause' : 'pi pi-play'"
              class="!rounded-xl"
              @click="toggleAgentActive"
            />
          </div>
          <p v-else class="text-sm leading-6 text-slate-600">
            This account is not currently registered as a support agent.
          </p>
        </template>
      </Card>

      <Card class="!rounded-3xl !border !border-slate-200/90 !bg-white/95">
        <template #title>
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-lg font-semibold text-slate-900">Conversation Detail</h2>
            <Tag
              v-if="selectedConversation"
              :value="selectedConversation.status"
              :severity="getStatusSeverity(selectedConversation.status)"
              rounded
            />
          </div>
        </template>
        <template #content>
          <div v-if="detailLoading" class="flex justify-center py-10">
            <ProgressSpinner style="width: 30px; height: 30px" stroke-width="6" />
          </div>

          <div v-else-if="selectedConversation" class="space-y-4">
            <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <p>
                user:
                <span class="font-semibold text-slate-900">{{ selectedConversation.userId }}</span>
              </p>
              <p class="mt-1">
                assigned:
                <span class="font-semibold text-slate-900">
                  {{ selectedConversation.assignedAgentId || 'Unassigned' }}
                </span>
              </p>
              <p class="mt-1">
                unread:
                <span class="font-semibold text-slate-900">
                  agent {{ selectedConversation.unreadForAgents }} · user {{ selectedConversation.unreadForUser }}
                </span>
              </p>
              <div class="mt-3 flex flex-wrap items-center gap-2">
                <Tag
                  :value="workspaceMeta?.priority || 'NORMAL'"
                  :severity="getPrioritySeverity(workspaceMeta?.priority || 'NORMAL')"
                  rounded
                />
                <Tag
                  v-if="workspaceMeta?.slaStatus"
                  :value="workspaceMeta.slaStatus"
                  :severity="getSlaSeverity(workspaceMeta.slaStatus)"
                  rounded
                />
                <Tag
                  v-if="workspaceMeta?.slaDueAt"
                  :value="`Due ${formatDate(workspaceMeta.slaDueAt)}`"
                  severity="contrast"
                  rounded
                />
              </div>
            </div>

            <div
              v-if="latestReopenedEntry"
              class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3"
            >
              <div class="flex flex-wrap items-center gap-2">
                <Tag value="REOPENED" severity="warn" rounded />
                <Tag
                  v-if="latestReopenedEntry.reopenedFromStatus"
                  :value="`From ${latestReopenedEntry.reopenedFromStatus}`"
                  severity="contrast"
                  rounded
                />
                <p class="text-xs text-slate-500">
                  {{ formatDate(latestReopenedEntry.createdAt) }}
                </p>
              </div>
              <p class="mt-2 text-sm text-slate-800">
                {{ latestReopenedEntry.summary }}
              </p>
              <p class="mt-1 text-xs text-slate-500">
                Triggered by {{ formatActorLabel(latestReopenedEntry.actor) }}
              </p>
            </div>

            <div
              v-if="workspaceMode !== 'none'"
              class="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3"
            >
              <Button
                label="Mark Resolved"
                icon="pi pi-check"
                severity="success"
                outlined
                class="!rounded-xl"
                :loading="resolveLoading"
                :disabled="selectedConversation.status === 'CLOSED' || selectedConversation.status === 'RESOLVED'"
                @click="resolveConversation"
              />
            </div>

            <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div class="flex items-center justify-between gap-2">
                <div>
                  <p class="text-sm font-semibold text-slate-900">Internal Note</p>
                  <p class="mt-1 text-xs text-slate-500">
                    Shared across support workspace only.
                  </p>
                </div>
                <Tag
                  v-if="workspaceMeta?.updatedAt"
                  :value="`Updated ${formatDate(workspaceMeta.updatedAt)}`"
                  severity="contrast"
                  rounded
                />
              </div>

              <div v-if="noteLoading" class="flex justify-center py-6">
                <ProgressSpinner style="width: 26px; height: 26px" stroke-width="6" />
              </div>

              <div v-else class="mt-3 space-y-4">
                <div class="grid gap-3 md:grid-cols-2">
                  <label class="space-y-1">
                    <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Priority
                    </span>
                    <select
                      v-model="priorityDraft"
                      class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="LOW">LOW</option>
                      <option value="NORMAL">NORMAL</option>
                      <option value="HIGH">HIGH</option>
                      <option value="URGENT">URGENT</option>
                    </select>
                  </label>
                  <label class="space-y-1">
                    <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Tags
                    </span>
                    <InputText
                      v-model="tagsDraft"
                      class="w-full"
                      placeholder="vip, payment, escalation"
                    />
                  </label>
                </div>

                <div class="space-y-2">
                  <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Suggested Tags
                  </p>
                  <div class="flex flex-wrap gap-2">
                    <button
                      v-for="tag in supportCommonTags"
                      :key="tag"
                      type="button"
                      class="rounded-full border px-3 py-1 text-xs font-medium transition"
                      :class="
                        isSuggestedTagSelected(tag)
                          ? 'border-[#0f5b54] bg-[#0f5b54] text-white'
                          : 'border-slate-300 bg-white text-slate-700 hover:border-slate-500'
                      "
                      @click="toggleSuggestedTag(tag)"
                    >
                      {{ tag }}
                    </button>
                  </div>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                  <Tag
                    :value="priorityDraft"
                    :severity="getPrioritySeverity(priorityDraft)"
                    rounded
                  />
                  <Tag
                    v-if="workspaceMeta?.slaStatus"
                    :value="workspaceMeta.slaStatus"
                    :severity="getSlaSeverity(workspaceMeta.slaStatus)"
                    rounded
                  />
                  <Tag
                    v-if="workspaceMeta?.slaDueAt"
                    :value="`Due ${formatDate(workspaceMeta.slaDueAt)}`"
                    severity="contrast"
                    rounded
                  />
                  <Tag
                    v-for="tag in workspaceMeta?.tags || []"
                    :key="tag"
                    :value="tag"
                    severity="secondary"
                    rounded
                  />
                </div>

                <Textarea
                  v-model="internalNoteDraft"
                  rows="4"
                  auto-resize
                  class="w-full"
                  placeholder="Add handoff context, escalation notes, or internal reminders."
                />
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <p class="text-xs text-slate-500">
                    {{ workspaceMeta?.updatedBy ? `Last updated by ${workspaceMeta.updatedBy}` : 'No internal note yet.' }}
                  </p>
                  <div class="flex flex-wrap items-center gap-2">
                    <Button
                      label="Save Triage"
                      icon="pi pi-flag"
                      severity="secondary"
                      outlined
                      class="!rounded-xl"
                      :loading="triageSaving"
                      @click="saveTriage"
                    />
                    <Button
                      label="Save Note"
                      icon="pi pi-file-edit"
                      severity="secondary"
                      outlined
                      class="!rounded-xl"
                      :loading="noteSaving"
                      @click="saveInternalNote"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div
              v-if="workspaceMeta?.closeReason || workspaceMeta?.closedAt || workspaceMeta?.closedBy"
              class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900"
            >
              <p class="font-semibold">Closure Record</p>
              <p v-if="workspaceMeta?.closeReason" class="mt-2 whitespace-pre-wrap leading-6">
                {{ workspaceMeta.closeReason }}
              </p>
              <p class="mt-2 text-xs text-amber-800/80">
                {{ workspaceMeta?.closedAt ? `Closed ${formatDate(workspaceMeta.closedAt)}` : 'Closed' }}
                {{ workspaceMeta?.closedBy ? ` by ${workspaceMeta.closedBy}` : '' }}
              </p>
            </div>

            <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p class="text-sm font-semibold text-slate-900">Activity</p>
                  <p class="mt-1 text-xs text-slate-500">
                    Audit trail for assignment, triage, notes, replies, and closure.
                  </p>
                </div>
                <Tag :value="`Total ${auditTotal}`" severity="contrast" rounded />
              </div>

              <div v-if="auditLoading && auditEntries.length === 0" class="flex justify-center py-6">
                <ProgressSpinner style="width: 26px; height: 26px" stroke-width="6" />
              </div>

              <div v-else class="mt-3 space-y-3">
                <div class="grid gap-3 md:grid-cols-[1.1fr_0.9fr_auto]">
                  <label class="space-y-1">
                    <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Actor
                    </span>
                    <InputText
                      v-model="auditFilters.actor"
                      class="w-full"
                      placeholder="admin:, support_agent:, user:"
                    />
                  </label>
                  <label class="space-y-1">
                    <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Action
                    </span>
                    <select
                      v-model="auditFilters.action"
                      class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">All</option>
                      <option value="USER_MESSAGE">USER_MESSAGE</option>
                      <option value="AGENT_REPLY">AGENT_REPLY</option>
                      <option value="ASSIGNED">ASSIGNED</option>
                      <option value="UNASSIGNED">UNASSIGNED</option>
                      <option value="RESOLVED">RESOLVED</option>
                      <option value="INTERNAL_NOTE_UPDATED">INTERNAL_NOTE_UPDATED</option>
                      <option value="TRIAGE_UPDATED">TRIAGE_UPDATED</option>
                      <option value="CLOSED">CLOSED</option>
                      <option value="REOPENED">REOPENED</option>
                    </select>
                  </label>
                  <div class="flex flex-wrap items-end gap-2">
                    <Button
                      label="Apply"
                      icon="pi pi-filter"
                      text
                      :loading="auditLoading"
                      @click="applyAuditFilters"
                    />
                    <Button
                      label="Reset"
                      icon="pi pi-filter-slash"
                      text
                      @click="resetAuditFilters"
                    />
                    <Button
                      label="Export CSV"
                      icon="pi pi-download"
                      text
                      :loading="auditExporting"
                      @click="exportAuditLogs"
                    />
                  </div>
                </div>

                <div
                  v-for="entry in auditEntries"
                  :key="entry.id"
                  class="rounded-2xl border border-slate-200 bg-white px-3 py-3"
                >
                  <div class="flex flex-wrap items-start justify-between gap-2">
                    <div class="flex flex-wrap items-center gap-2">
                      <Tag
                        :value="entry.action"
                        :severity="getAuditSeverity(entry.action)"
                        rounded
                      />
                      <Tag
                        v-if="entry.reopenedFromStatus"
                        :value="`From ${entry.reopenedFromStatus}`"
                        severity="contrast"
                        rounded
                      />
                      <Tag
                        v-if="entry.priority"
                        :value="entry.priority"
                        :severity="getPrioritySeverity(entry.priority)"
                        rounded
                      />
                      <Tag
                        v-for="tag in entry.tags"
                        :key="`${entry.id}:${tag}`"
                        :value="tag"
                        severity="secondary"
                        rounded
                      />
                    </div>
                    <p class="text-xs text-slate-500">{{ formatDate(entry.createdAt) }}</p>
                  </div>
                  <p class="mt-2 text-sm leading-6 text-slate-800">{{ entry.summary }}</p>
                  <p
                    v-if="entry.messagePreview"
                    class="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600"
                  >
                    {{ entry.messagePreview }}
                  </p>
                  <p class="mt-2 text-xs text-slate-500">
                    actor: {{ formatActorLabel(entry.actor) }}
                  </p>
                </div>

                <p
                  v-if="auditEntries.length === 0"
                  class="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500"
                >
                  No audit entries yet for this conversation.
                </p>

                <div class="flex justify-end">
                  <Button
                    v-if="auditHasMore"
                    label="Load More Activity"
                    icon="pi pi-history"
                    text
                    :loading="auditLoading"
                    @click="loadMoreAuditLogs"
                  />
                </div>
              </div>
            </div>

            <div class="max-h-[22rem] space-y-3 overflow-y-auto rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
              <div
                v-for="message in selectedConversation.messages"
                :key="message.id"
                class="flex"
                :class="isUserMessage(message) ? 'justify-start' : 'justify-end'"
              >
                <div
                  class="max-w-[85%] rounded-3xl px-4 py-3 shadow-sm"
                  :class="
                    isUserMessage(message)
                      ? 'border border-slate-200 bg-white text-slate-800'
                      : 'bg-slate-900 text-white'
                  "
                >
                  <p class="text-xs font-semibold uppercase tracking-[0.12em] opacity-75">
                    {{ isUserMessage(message) ? message.userId : message.senderUserId }}
                  </p>
                  <p class="mt-2 whitespace-pre-wrap text-sm leading-6">{{ message.content }}</p>
                  <p class="mt-2 text-[11px] opacity-70">{{ formatDate(message.createdAt) }}</p>
                </div>
              </div>
            </div>

            <div v-if="agentProfile" class="space-y-3">
              <div class="space-y-2">
                <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Quick Replies
                </p>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="template in supportQuickReplyTemplates"
                    :key="template.label"
                    type="button"
                    class="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-500"
                    @click="appendReplyTemplate(template.content)"
                  >
                    {{ template.label }}
                  </button>
                </div>
              </div>
              <label class="block space-y-1">
                <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Reply
                </span>
                <Textarea
                  v-model="replyDraft"
                  rows="4"
                  auto-resize
                  class="w-full"
                  placeholder="Write the next support response."
                />
              </label>
              <Button
                label="Send Reply"
                icon="pi pi-send"
                class="!rounded-xl"
                :disabled="!canReply"
                :loading="replyLoading"
                @click="submitReply"
              />
            </div>

            <div
              v-if="hasAdminAccess"
              class="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
            >
              <label class="space-y-1">
                <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Assign Agent
                </span>
                <InputText
                  v-model="assignAgentUserId"
                  class="w-full"
                  placeholder="user_123"
                />
              </label>
              <label class="space-y-1">
                <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Close Reason
                </span>
                <Textarea
                  v-model="closeReasonDraft"
                  rows="3"
                  auto-resize
                  class="w-full"
                  placeholder="Optional internal reason for closing this conversation."
                />
              </label>
              <div class="flex flex-wrap gap-2">
                <Button
                  label="Assign"
                  icon="pi pi-user-edit"
                  severity="secondary"
                  outlined
                  class="!rounded-xl"
                  @click="assignConversation"
                />
                <Button
                  label="Close"
                  icon="pi pi-check-circle"
                  severity="contrast"
                  outlined
                  class="!rounded-xl"
                  :loading="closeLoading"
                  @click="closeConversation"
                />
              </div>
            </div>
          </div>

          <p v-else class="text-sm text-slate-500">
            Select a conversation from the queue to inspect its history.
          </p>
        </template>
      </Card>

      <Card
        v-if="hasAdminAccess"
        class="!rounded-3xl !border !border-slate-200/90 !bg-white/95"
      >
        <template #title>
          <div class="flex items-center justify-between gap-2">
            <div>
              <h2 class="text-lg font-semibold text-slate-900">Agent Roster</h2>
              <p class="mt-1 text-sm text-slate-600">
                Account grants now live in Admin Access. This panel stays focused on queue work and live agent state.
              </p>
            </div>
            <Button
              label="Manage Grants"
              icon="pi pi-shield"
              text
              @click="openSupportAccess"
            />
          </div>
        </template>
        <template #content>
          <div class="mt-1 grid gap-2">
            <div
              v-for="agent in adminAgents"
              :key="agent.userId"
              class="rounded-2xl border border-slate-200 px-3 py-3"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p class="font-semibold text-slate-900">
                    {{ agent.displayName || agent.email || agent.userId }}
                  </p>
                  <p class="mt-1 text-xs text-slate-500">{{ agent.userId }}</p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <Tag :value="agent.enabled ? 'ENABLED' : 'DISABLED'" :severity="agent.enabled ? 'success' : 'danger'" rounded />
                  <Tag :value="agent.isActive ? 'ACTIVE' : 'PAUSED'" :severity="agent.isActive ? 'info' : 'warn'" rounded />
                  <Tag :value="`${agent.openConversationCount} open`" severity="contrast" rounded />
                </div>
              </div>
              <p v-if="agent.note" class="mt-2 text-sm leading-6 text-slate-600">
                {{ agent.note }}
              </p>
              <p class="mt-2 text-xs text-slate-500">
                Updated by: {{ agent.updatedBy || 'unknown' }}
              </p>
            </div>

            <p
              v-if="adminAgents.length === 0"
              class="rounded-xl border border-slate-200 px-4 py-6 text-sm text-slate-500"
            >
              No support agents are configured yet.
            </p>
          </div>
        </template>
      </Card>
    </div>
  </section>
</template>
