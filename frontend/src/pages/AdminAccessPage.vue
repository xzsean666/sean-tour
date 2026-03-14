<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import Button from "primevue/button";
import Card from "primevue/card";
import InputText from "primevue/inputtext";
import Message from "primevue/message";
import ProgressSpinner from "primevue/progressspinner";
import Tag from "primevue/tag";
import Textarea from "primevue/textarea";
import {
  adminAccessService,
  type AdminAccessEntry,
  type AdminSetAccessInput,
} from "../api/adminAccessService";
import {
  adminSupportService,
  type AdminSetSupportAgentInput,
} from "../api/adminSupportService";
import type { SupportAgentProfile } from "../api/supportService";
import { useAuthStore } from "../stores/auth.store";

type AccessRole = "ADMIN" | "SUPPORT_AGENT";

type AccessEntry = {
  id: string;
  role: AccessRole;
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
  isActive?: boolean;
  openConversationCount?: number;
};

const route = useRoute();
const router = useRouter();
const { backendUser, refreshUser } = useAuthStore();

const entries = ref<AccessEntry[]>([]);
const listLoading = ref(false);
const saveLoading = ref(false);
const selectedEntryId = ref("");
const errorMessage = ref("");
const successMessage = ref("");
const selectedRole = ref<AccessRole>(normalizeRole(route.query.role));

const form = reactive({
  userId: "",
  email: "",
  displayName: "",
  note: "",
  enabled: "true",
  isActive: "true",
});

const hasAdminAccess = computed(() => !!backendUser.value?.isAdmin);
const isSupportRole = computed(() => selectedRole.value === "SUPPORT_AGENT");
const selectedEntry = computed(() =>
  entries.value.find((item) => item.id === selectedEntryId.value),
);
const isEditingEntry = computed(
  () => !!selectedEntry.value && selectedEntry.value.editable,
);
const canSubmit = computed(() => {
  if (isSupportRole.value) {
    return !!form.userId.trim();
  }

  return !!form.userId.trim() || !!form.email.trim();
});
const roleMeta = computed(() =>
  isSupportRole.value
    ? {
        badge: "Support Ops",
        title: "Support Agent Access",
        description:
          "Grant or revoke support-agent accounts here. Queue handling and live pause/resume remain in the support workspace.",
        listTitle: "Current Support Grants",
        listSubtitle:
          "Support agents who can access /admin/support. Runtime active state is tracked separately from the grant itself.",
        formTitle: isEditingEntry.value
          ? "Edit Support Grant"
          : "Create Support Grant",
        formSubtitle:
          "Support grants require a concrete user ID. Email is optional display metadata.",
        noteTitle: "Support Notes",
        noteBody:
          "Use this page for who is allowed to be a support agent. Agents can still pause auto-assignment for themselves in /admin/support without losing the grant.",
        emptyText: "No support agent grants found.",
        submitLabel: "Save Support Grant",
        routeValue: "support",
      }
    : {
        badge: "Admin Security",
        title: "Admin Access Control",
        description:
          "Maintain admin operators on the backend. Environment bootstrap admins remain read-only; all other grants can be added, enabled, or disabled here.",
        listTitle: "Current Admins",
        listSubtitle:
          "Environment bootstrap and database-managed admin grants.",
        formTitle: isEditingEntry.value ? "Edit Admin Grant" : "Create Admin Grant",
        formSubtitle:
          "Provide at least one stable principal: user ID or email.",
        noteTitle: "Admin Notes",
        noteBody:
          "Environment bootstrap admins are read-only here. Disable DB grants instead of deleting them so audit history stays visible. The backend rejects any action that would leave the system without at least one effective admin.",
        emptyText: "No admin access entries found.",
        submitLabel: "Save Admin Grant",
        routeValue: "admin",
      },
);

function normalizeRole(value: unknown): AccessRole {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "support" || normalized === "support_agent") {
      return "SUPPORT_AGENT";
    }
  }

  return "ADMIN";
}

function formatDate(value?: string): string {
  if (!value) {
    return "Environment bootstrap";
  }

  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeAdminEntry(entry: AdminAccessEntry): AccessEntry {
  return {
    id: entry.id,
    role: "ADMIN",
    userId: entry.userId,
    email: entry.email,
    displayName: entry.displayName,
    note: entry.note,
    source: entry.source,
    enabled: entry.enabled,
    editable: entry.editable,
    grantedBy: entry.grantedBy,
    updatedBy: entry.updatedBy,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

function normalizeSupportEntry(entry: SupportAgentProfile): AccessEntry {
  return {
    id: `user:${entry.userId}`,
    role: "SUPPORT_AGENT",
    userId: entry.userId,
    email: entry.email,
    displayName: entry.displayName,
    note: entry.note,
    source: "DB",
    enabled: entry.enabled,
    editable: true,
    grantedBy: entry.grantedBy,
    updatedBy: entry.updatedBy,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    isActive: entry.isActive,
    openConversationCount: entry.openConversationCount,
  };
}

function resetForm(): void {
  selectedEntryId.value = "";
  form.userId = "";
  form.email = "";
  form.displayName = "";
  form.note = "";
  form.enabled = "true";
  form.isActive = "true";
}

function loadForm(entry: AccessEntry): void {
  selectedEntryId.value = entry.id;
  form.userId = entry.userId || "";
  form.email = entry.email || "";
  form.displayName = entry.displayName || "";
  form.note = entry.note || "";
  form.enabled = entry.enabled ? "true" : "false";
  form.isActive = entry.isActive ? "true" : "false";
}

async function syncCurrentUser(): Promise<void> {
  await refreshUser();

  if (!backendUser.value?.isAdmin) {
    await router.push("/");
  }
}

async function loadEntries(): Promise<void> {
  listLoading.value = true;
  errorMessage.value = "";

  try {
    if (selectedRole.value === "SUPPORT_AGENT") {
      entries.value = (await adminSupportService.listAgents()).map(
        normalizeSupportEntry,
      );
      return;
    }

    entries.value = (await adminAccessService.listEntries()).map(
      normalizeAdminEntry,
    );
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Failed to load access entries.";
  } finally {
    listLoading.value = false;
  }
}

async function submitForm(): Promise<void> {
  if (!canSubmit.value) {
    errorMessage.value = isSupportRole.value
      ? "Provide a user ID for the support grant."
      : "Provide a user ID or email address.";
    return;
  }

  saveLoading.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    let updated: AccessEntry;

    if (selectedRole.value === "SUPPORT_AGENT") {
      const input: AdminSetSupportAgentInput = {
        userId: form.userId.trim(),
        enabled: form.enabled === "true",
        isActive: form.enabled === "true" ? form.isActive === "true" : false,
        ...(form.displayName.trim()
          ? { displayName: form.displayName.trim() }
          : {}),
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
        ...(form.note.trim() ? { note: form.note.trim() } : {}),
      };
      updated = normalizeSupportEntry(await adminSupportService.setAgent(input));
    } else {
      const input: AdminSetAccessInput = {
        ...(form.userId.trim() ? { userId: form.userId.trim() } : {}),
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
        ...(form.displayName.trim()
          ? { displayName: form.displayName.trim() }
          : {}),
        ...(form.note.trim() ? { note: form.note.trim() } : {}),
        enabled: form.enabled === "true",
      };
      updated = normalizeAdminEntry(await adminAccessService.setAccess(input));
    }

    successMessage.value = `${updated.displayName || updated.email || updated.userId || updated.id} updated.`;
    await loadEntries();
    loadForm(updated);

    if (selectedRole.value === "ADMIN") {
      await syncCurrentUser();
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Failed to save access entry.";
  } finally {
    saveLoading.value = false;
  }
}

async function toggleEntry(entry: AccessEntry): Promise<void> {
  if (!entry.editable) {
    return;
  }

  saveLoading.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    let updated: AccessEntry;

    if (entry.role === "SUPPORT_AGENT") {
      updated = normalizeSupportEntry(
        await adminSupportService.setAgent({
          userId: entry.userId || "",
          enabled: !entry.enabled,
          isActive: !entry.enabled ? (entry.isActive ?? false) : false,
          displayName: entry.displayName,
          email: entry.email,
          note: entry.note,
        }),
      );
    } else {
      updated = normalizeAdminEntry(
        await adminAccessService.setAccess({
          userId: entry.userId,
          email: entry.email,
          displayName: entry.displayName,
          note: entry.note,
          enabled: !entry.enabled,
        }),
      );
    }

    successMessage.value = `${updated.displayName || updated.email || updated.userId || updated.id} is now ${
      updated.enabled ? "enabled" : "disabled"
    }.`;
    await loadEntries();

    if (selectedEntryId.value === entry.id) {
      loadForm(updated);
    }

    if (entry.role === "ADMIN") {
      await syncCurrentUser();
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Failed to update access entry.";
  } finally {
    saveLoading.value = false;
  }
}

async function selectRole(role: AccessRole): Promise<void> {
  if (selectedRole.value === role) {
    return;
  }

  selectedRole.value = role;
  resetForm();
  await router.replace({
    query: {
      ...route.query,
      role: role === "SUPPORT_AGENT" ? "support" : "admin",
    },
  });
  await loadEntries();
}

watch(
  () => route.query.role,
  async (value) => {
    const nextRole = normalizeRole(value);
    if (selectedRole.value === nextRole) {
      return;
    }

    selectedRole.value = nextRole;
    resetForm();
    await loadEntries();
  },
);

onMounted(async () => {
  await syncCurrentUser();
  await loadEntries();
});
</script>

<template>
  <section
    class="relative overflow-hidden rounded-3xl border border-[#0f4c5f]/15 bg-gradient-to-br from-[#0c2737] via-[#155b5f] to-[#18445f] px-6 py-8 text-white shadow-[0_26px_90px_-55px_rgba(6,34,42,0.95)]"
  >
    <div class="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-[#f6c34a]/20 blur-3xl" />
    <div class="absolute -left-12 bottom-0 h-44 w-44 rounded-full bg-[#35d0b7]/15 blur-3xl" />

    <p class="relative text-xs font-semibold uppercase tracking-[0.16em] text-teal-100/90">
      {{ roleMeta.badge }}
    </p>
    <h1 class="relative mt-2 text-3xl font-semibold leading-tight">
      {{ roleMeta.title }}
    </h1>
    <p class="relative mt-3 max-w-3xl text-sm leading-6 text-teal-50/90">
      {{ roleMeta.description }}
    </p>
  </section>

  <section class="mt-4 flex flex-wrap gap-2">
    <Button
      label="Admin Grants"
      :severity="selectedRole === 'ADMIN' ? 'contrast' : 'secondary'"
      :outlined="selectedRole !== 'ADMIN'"
      class="!rounded-xl"
      @click="selectRole('ADMIN')"
    />
    <Button
      label="Support Grants"
      :severity="selectedRole === 'SUPPORT_AGENT' ? 'contrast' : 'secondary'"
      :outlined="selectedRole !== 'SUPPORT_AGENT'"
      class="!rounded-xl"
      @click="selectRole('SUPPORT_AGENT')"
    />
  </section>

  <Message v-if="!hasAdminAccess" severity="warn" class="mt-4">
    This account does not have admin access.
  </Message>
  <Message v-if="errorMessage" severity="error" class="mt-4">{{ errorMessage }}</Message>
  <Message v-if="successMessage" severity="success" class="mt-4">{{ successMessage }}</Message>

  <section class="mt-6 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
    <Card class="!rounded-3xl !border !border-slate-200/90 !bg-white/95">
      <template #title>
        <div class="flex items-center justify-between gap-2">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">{{ roleMeta.listTitle }}</h2>
            <p class="mt-1 text-sm text-slate-600">{{ roleMeta.listSubtitle }}</p>
          </div>
          <Button
            label="Reload"
            icon="pi pi-refresh"
            text
            :loading="listLoading"
            @click="loadEntries"
          />
        </div>
      </template>

      <template #content>
        <div v-if="listLoading" class="flex justify-center py-10">
          <ProgressSpinner style="width: 36px; height: 36px" stroke-width="6" />
        </div>

        <div v-else class="grid gap-3">
          <div
            v-for="entry in entries"
            :key="entry.id"
            class="rounded-2xl border p-4"
            :class="
              selectedEntryId === entry.id
                ? 'border-[#155b5f] bg-[#f2faf9]'
                : 'border-slate-200 bg-white'
            "
          >
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="font-semibold text-slate-900">
                  {{ entry.displayName || entry.email || entry.userId || entry.id }}
                </p>
                <p class="mt-1 text-xs text-slate-500">
                  {{ entry.email || entry.userId || entry.id }}
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <Tag v-if="entry.role === 'ADMIN'" :value="entry.source" severity="contrast" rounded />
                <Tag
                  :value="entry.enabled ? 'ENABLED' : 'DISABLED'"
                  :severity="entry.enabled ? 'success' : 'danger'"
                  rounded
                />
                <Tag
                  v-if="entry.role === 'SUPPORT_AGENT'"
                  :value="entry.isActive ? 'ACTIVE' : 'PAUSED'"
                  :severity="entry.isActive ? 'info' : 'warn'"
                  rounded
                />
                <Tag
                  v-if="entry.role === 'SUPPORT_AGENT'"
                  :value="`${entry.openConversationCount || 0} open`"
                  severity="contrast"
                  rounded
                />
                <Tag
                  v-if="entry.role === 'ADMIN'"
                  :value="entry.editable ? 'EDITABLE' : 'READ_ONLY'"
                  :severity="entry.editable ? 'info' : 'warn'"
                  rounded
                />
              </div>
            </div>

            <p v-if="entry.note" class="mt-3 text-sm leading-6 text-slate-600">
              {{ entry.note }}
            </p>

            <div class="mt-3 space-y-1 text-xs text-slate-500">
              <p>Updated: {{ formatDate(entry.updatedAt || entry.createdAt) }}</p>
              <p v-if="entry.updatedBy">Updated by: {{ entry.updatedBy }}</p>
              <p v-if="entry.grantedBy">Granted by: {{ entry.grantedBy }}</p>
            </div>

            <div class="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
              <p v-if="entry.role === 'SUPPORT_AGENT'">
                Auto assign:
                {{ entry.isActive ? 'Accepting new conversations' : 'Paused for new conversations' }}
              </p>
              <p v-else>
                Source: {{ entry.source }}
              </p>
              <div class="flex flex-wrap gap-2">
                <Button
                  v-if="entry.editable"
                  label="Edit"
                  icon="pi pi-pencil"
                  text
                  size="small"
                  @click="loadForm(entry)"
                />
                <Button
                  v-if="entry.editable"
                  :label="entry.enabled ? 'Disable' : 'Enable'"
                  :icon="entry.enabled ? 'pi pi-ban' : 'pi pi-check-circle'"
                  text
                  size="small"
                  :loading="saveLoading && selectedEntryId === entry.id"
                  @click="toggleEntry(entry)"
                />
              </div>
            </div>
          </div>

          <p
            v-if="entries.length === 0"
            class="rounded-xl border border-slate-200 px-4 py-8 text-sm text-slate-500"
          >
            {{ roleMeta.emptyText }}
          </p>
        </div>
      </template>
    </Card>

    <Card class="!rounded-3xl !border !border-slate-200/90 !bg-white/95">
      <template #title>
        <div class="flex items-center justify-between gap-2">
          <div>
            <h2 class="text-lg font-semibold text-slate-900">
              {{ roleMeta.formTitle }}
            </h2>
            <p class="mt-1 text-sm text-slate-600">
              {{ roleMeta.formSubtitle }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button
              v-if="selectedRole === 'SUPPORT_AGENT'"
              label="Open Workspace"
              icon="pi pi-comments"
              text
              @click="router.push('/admin/support')"
            />
            <Button
              label="Reset"
              icon="pi pi-times"
              text
              @click="resetForm"
            />
          </div>
        </div>
      </template>

      <template #content>
        <div class="grid gap-3">
          <label class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              User ID
            </span>
            <InputText
              v-model="form.userId"
              class="w-full"
              :placeholder="selectedRole === 'SUPPORT_AGENT' ? 'support_agent_123' : '4f8d2c...'"
            />
          </label>

          <label class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Email
            </span>
            <InputText
              v-model="form.email"
              class="w-full"
              :placeholder="selectedRole === 'SUPPORT_AGENT' ? 'agent@example.com' : 'admin@example.com'"
            />
          </label>

          <label class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Display Name
            </span>
            <InputText
              v-model="form.displayName"
              class="w-full"
              :placeholder="selectedRole === 'SUPPORT_AGENT' ? 'Support Lead' : 'Ops Lead'"
            />
          </label>

          <label class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Note
            </span>
            <Textarea
              v-model="form.note"
              rows="4"
              auto-resize
              class="w-full"
              :placeholder="
                selectedRole === 'SUPPORT_AGENT'
                  ? 'Why this account should handle customer conversations.'
                  : 'Why this account needs admin access.'
              "
            />
          </label>

          <label class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Enabled
            </span>
            <select
              v-model="form.enabled"
              class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </label>

          <label v-if="selectedRole === 'SUPPORT_AGENT'" class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Active
            </span>
            <select
              v-model="form.isActive"
              class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </label>
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          <Button
            :label="roleMeta.submitLabel"
            icon="pi pi-save"
            class="!rounded-xl"
            :loading="saveLoading"
            :disabled="!canSubmit"
            @click="submitForm"
          />
        </div>

        <div class="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
          <p class="font-semibold text-slate-900">{{ roleMeta.noteTitle }}</p>
          <p class="mt-2 leading-6">
            {{ roleMeta.noteBody }}
          </p>
        </div>
      </template>
    </Card>
  </section>
</template>
