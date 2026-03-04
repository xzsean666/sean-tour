<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import Button from "primevue/button";
import Card from "primevue/card";
import InputText from "primevue/inputtext";
import Message from "primevue/message";
import ProgressSpinner from "primevue/progressspinner";
import Tag from "primevue/tag";
import Textarea from "primevue/textarea";
import {
  adminAssistantService,
  type AdminBatchAssignAssistantSessionsInput,
  type AdminUpdateAssistantSessionInput,
} from "../api/adminAssistantService";
import type {
  AssistantSessionItem,
  AssistantSessionStatus,
} from "../api/assistantService";

const SESSION_STATUSES: AssistantSessionStatus[] = [
  "REQUESTED",
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELED",
];

const sessions = ref<AssistantSessionItem[]>([]);
const total = ref(0);
const offset = ref(0);
const limit = ref(20);
const hasMore = ref(false);

const listLoading = ref(false);
const updateLoading = ref(false);
const batchLoading = ref(false);

const errorMessage = ref("");
const successMessage = ref("");

const selectedSessionId = ref("");
const selectedSessionIds = ref<string[]>([]);

const filters = reactive({
  sessionId: "",
  bookingId: "",
  userId: "",
  assignedAgent: "",
  status: "",
});

const updateForm = reactive({
  status: "ASSIGNED" as AssistantSessionStatus,
  assignedAgent: "",
  internalNote: "",
});

const batchForm = reactive({
  status: "ASSIGNED" as AssistantSessionStatus,
  assignedAgent: "",
  internalNote: "",
});

const adminConfigured = computed(() => adminAssistantService.isAdminConfigured());
const selectedSession = computed(() =>
  sessions.value.find((item) => item.id === selectedSessionId.value),
);
const selectedCount = computed(() => selectedSessionIds.value.length);
const hasPrevPage = computed(() => offset.value > 0);
const hasNextPage = computed(() => hasMore.value);
const allSelectedOnPage = computed(() => {
  if (sessions.value.length === 0) {
    return false;
  }

  return sessions.value.every((item) => selectedSessionIds.value.includes(item.id));
});
const canBatchAssign = computed(() => {
  return !!batchForm.assignedAgent.trim() && selectedSessionIds.value.length > 0;
});

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeOptionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function getStatusSeverity(
  status: AssistantSessionStatus,
): "success" | "info" | "warn" | "danger" | "contrast" {
  if (status === "COMPLETED") {
    return "success";
  }

  if (status === "IN_PROGRESS") {
    return "info";
  }

  if (status === "CANCELED") {
    return "danger";
  }

  if (status === "ASSIGNED") {
    return "contrast";
  }

  return "warn";
}

function syncUpdateForm(session: AssistantSessionItem): void {
  updateForm.status = session.status;
  updateForm.assignedAgent = session.assignedAgent || "";
  updateForm.internalNote = session.internalNote || "";
}

function resetFilters(): void {
  filters.sessionId = "";
  filters.bookingId = "";
  filters.userId = "";
  filters.assignedAgent = "";
  filters.status = "";
}

function resetBatchForm(): void {
  batchForm.status = "ASSIGNED";
  batchForm.assignedAgent = "";
  batchForm.internalNote = "";
}

function selectSession(session: AssistantSessionItem): void {
  selectedSessionId.value = session.id;
  syncUpdateForm(session);
}

function toggleSessionSelection(sessionId: string, checked: boolean): void {
  if (checked) {
    if (!selectedSessionIds.value.includes(sessionId)) {
      selectedSessionIds.value = [...selectedSessionIds.value, sessionId];
    }
    return;
  }

  selectedSessionIds.value = selectedSessionIds.value.filter((id) => id !== sessionId);
}

function toggleAllSelections(checked: boolean): void {
  if (checked) {
    selectedSessionIds.value = sessions.value.map((item) => item.id);
    return;
  }

  selectedSessionIds.value = [];
}

async function loadSessionsAtOffset(nextOffset: number): Promise<void> {
  if (!adminConfigured.value) {
    sessions.value = [];
    total.value = 0;
    offset.value = 0;
    hasMore.value = false;
    return;
  }

  listLoading.value = true;
  errorMessage.value = "";

  try {
    const result = await adminAssistantService.listSessions({
      sessionId: normalizeOptionalText(filters.sessionId),
      bookingId: normalizeOptionalText(filters.bookingId),
      userId: normalizeOptionalText(filters.userId),
      assignedAgent: normalizeOptionalText(filters.assignedAgent),
      status: (normalizeOptionalText(filters.status) as AssistantSessionStatus) || undefined,
      limit: limit.value,
      offset: Math.max(nextOffset, 0),
    });

    sessions.value = result.items;
    total.value = result.total;
    offset.value = result.offset;
    hasMore.value = result.hasMore;

    selectedSessionIds.value = selectedSessionIds.value.filter((id) =>
      result.items.some((item) => item.id === id),
    );

    if (!selectedSession.value && result.items.length > 0) {
      selectSession(result.items[0]);
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Failed to load assistant sessions.";
  } finally {
    listLoading.value = false;
  }
}

async function applyFilters(): Promise<void> {
  selectedSessionIds.value = [];
  await loadSessionsAtOffset(0);
}

async function submitUpdate(): Promise<void> {
  const current = selectedSession.value;
  if (!current) {
    return;
  }

  updateLoading.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const input: AdminUpdateAssistantSessionInput = {
      sessionId: current.id,
      status: updateForm.status,
      assignedAgent: updateForm.assignedAgent,
      internalNote: updateForm.internalNote,
    };

    const updated = await adminAssistantService.updateSession(input);
    successMessage.value = `Session ${updated.id} updated to ${updated.status}.`;
    await loadSessionsAtOffset(offset.value);
    const latest = sessions.value.find((item) => item.id === updated.id);
    if (latest) {
      selectSession(latest);
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Failed to update assistant session.";
  } finally {
    updateLoading.value = false;
  }
}

async function submitBatchAssign(): Promise<void> {
  if (!canBatchAssign.value) {
    errorMessage.value = "Select sessions and assign an agent first.";
    return;
  }

  batchLoading.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const input: AdminBatchAssignAssistantSessionsInput = {
      sessionIds: selectedSessionIds.value,
      assignedAgent: batchForm.assignedAgent.trim(),
      status: batchForm.status,
      internalNote: batchForm.internalNote,
    };

    const updated = await adminAssistantService.batchAssignSessions(input);
    successMessage.value = `Batch assigned ${updated.length} session(s) to ${batchForm.assignedAgent.trim()}.`;
    selectedSessionIds.value = [];
    resetBatchForm();
    await loadSessionsAtOffset(offset.value);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Failed to batch assign sessions.";
  } finally {
    batchLoading.value = false;
  }
}

onMounted(async () => {
  await applyFilters();
});
</script>

<template>
  <section
    class="relative overflow-hidden rounded-3xl border border-[#0c6d64]/20 bg-gradient-to-br from-[#083331] via-[#0f5b54] to-[#0b3038] px-6 py-8 text-white shadow-[0_26px_90px_-55px_rgba(7,41,46,0.95)]"
  >
    <div class="absolute -right-24 -top-28 h-56 w-56 rounded-full bg-[#f8b03c]/25 blur-3xl" />
    <div class="absolute -left-16 -bottom-24 h-52 w-52 rounded-full bg-[#2ad0a1]/20 blur-3xl" />
    <p class="relative text-xs font-semibold uppercase tracking-[0.16em] text-teal-100/90">
      Admin Operations
    </p>
    <h1 class="relative mt-2 text-3xl font-semibold leading-tight">
      Assistant Dispatch Console
    </h1>
    <p class="relative mt-3 max-w-3xl text-sm leading-6 text-teal-50/90">
      Search sessions by user, booking, and agent. Dispatch in batch, then refine each session
      with note and status updates.
    </p>
  </section>

  <Message v-if="!adminConfigured" severity="warn" class="mt-4">
    Missing <code>VITE_BACKEND_ADMIN_AUTH_CODE</code>. Admin actions will fail until it is configured.
  </Message>
  <Message v-if="errorMessage" severity="error" class="mt-4">{{ errorMessage }}</Message>
  <Message v-if="successMessage" severity="success" class="mt-4">{{ successMessage }}</Message>

  <section class="mt-6 grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
    <Card class="!rounded-3xl !border !border-slate-200/90 !bg-white/95">
      <template #title>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-lg font-semibold text-slate-900">Session Queue</h2>
          <div class="flex items-center gap-2">
            <Tag :value="`Total ${total}`" severity="contrast" rounded />
            <Button
              label="Reload"
              icon="pi pi-refresh"
              text
              :loading="listLoading"
              @click="loadSessionsAtOffset(offset)"
            />
          </div>
        </div>
      </template>

      <template #content>
        <div class="grid gap-3 md:grid-cols-2">
          <label class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Session ID
            </span>
            <InputText v-model="filters.sessionId" class="w-full" />
          </label>
          <label class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Booking ID
            </span>
            <InputText v-model="filters.bookingId" class="w-full" />
          </label>
          <label class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              User ID
            </span>
            <InputText v-model="filters.userId" class="w-full" />
          </label>
          <label class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Assigned Agent
            </span>
            <InputText
              v-model="filters.assignedAgent"
              class="w-full"
              placeholder="Agent-Li"
            />
          </label>
          <label class="space-y-1 md:col-span-2">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Status
            </span>
            <select
              v-model="filters.status"
              class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option v-for="status in SESSION_STATUSES" :key="status" :value="status">
                {{ status }}
              </option>
            </select>
          </label>
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
            label="Reset Filters"
            icon="pi pi-filter-slash"
            severity="secondary"
            outlined
            class="!rounded-xl"
            @click="
              () => {
                resetFilters();
                applyFilters();
              }
            "
          />
        </div>

        <div v-if="listLoading" class="flex justify-center py-10">
          <ProgressSpinner style="width: 36px; height: 36px" stroke-width="6" />
        </div>

        <div v-else class="mt-4 grid gap-2">
          <label
            v-if="sessions.length > 0"
            class="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              :checked="allSelectedOnPage"
              @change="toggleAllSelections(($event.target as HTMLInputElement).checked)"
            />
            Select all on this page
          </label>

          <button
            v-for="session in sessions"
            :key="session.id"
            type="button"
            class="rounded-2xl border p-3 text-left transition"
            :class="
              selectedSessionId === session.id
                ? 'border-[#0f5b54] bg-[#f2faf8]'
                : 'border-slate-200 hover:border-slate-400'
            "
            @click="selectSession(session)"
          >
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div class="flex items-center gap-2">
                <input
                  type="checkbox"
                  :checked="selectedSessionIds.includes(session.id)"
                  @click.stop
                  @change="
                    toggleSessionSelection(
                      session.id,
                      ($event.target as HTMLInputElement).checked,
                    )
                  "
                />
                <p class="font-semibold text-slate-900">{{ session.serviceTitle }}</p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <Tag :value="session.status" :severity="getStatusSeverity(session.status)" rounded />
                <Tag
                  v-if="session.assignedAgent"
                  :value="session.assignedAgent"
                  severity="contrast"
                  rounded
                />
              </div>
            </div>

            <p class="mt-1 text-xs text-slate-600">
              session: {{ session.id }} · booking: {{ session.bookingId }}
            </p>
            <p class="mt-1 text-xs text-slate-600">
              user: {{ session.userId }} · city: {{ session.city }} · language: {{ session.language }}
            </p>
            <p class="mt-1 line-clamp-2 text-xs text-slate-600">
              topic: {{ session.topic }}
            </p>
            <p class="mt-1 text-xs text-slate-500">updated: {{ formatDate(session.updatedAt) }}</p>
          </button>

          <p v-if="sessions.length === 0" class="rounded-xl border border-slate-200 px-3 py-6 text-sm text-slate-500">
            No assistant sessions found for current filters.
          </p>

          <div
            v-if="sessions.length > 0"
            class="mt-1 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
          >
            <p class="text-xs text-slate-600">
              Showing {{ sessions.length }} · Offset {{ offset }} · Total {{ total }}
            </p>
            <div class="flex items-center gap-2">
              <Button
                label="Previous"
                icon="pi pi-angle-left"
                text
                size="small"
                :disabled="!hasPrevPage || listLoading"
                @click="loadSessionsAtOffset(Math.max(offset - limit, 0))"
              />
              <Button
                label="Next"
                icon="pi pi-angle-right"
                icon-pos="right"
                text
                size="small"
                :disabled="!hasNextPage || listLoading"
                @click="loadSessionsAtOffset(offset + limit)"
              />
            </div>
          </div>
        </div>
      </template>
    </Card>

    <div class="grid gap-4">
      <Card class="!rounded-3xl !border !border-slate-200/90 !bg-white/95">
        <template #title>
          <h2 class="text-lg font-semibold text-slate-900">Batch Assign</h2>
        </template>
        <template #content>
          <p class="text-sm text-slate-600">
            Selected sessions:
            <span class="font-semibold text-slate-900">{{ selectedCount }}</span>
          </p>
          <p v-if="selectedCount > 0" class="mt-2 line-clamp-2 text-xs text-slate-500">
            {{ selectedSessionIds.join(" · ") }}
          </p>

          <div class="mt-4 grid gap-3">
            <label class="space-y-1">
              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Assign Agent
              </span>
              <InputText
                v-model="batchForm.assignedAgent"
                class="w-full"
                placeholder="Agent-Wang"
              />
            </label>
            <label class="space-y-1">
              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Status
              </span>
              <select
                v-model="batchForm.status"
                class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option v-for="status in SESSION_STATUSES" :key="status" :value="status">
                  {{ status }}
                </option>
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Internal Note
              </span>
              <Textarea
                v-model="batchForm.internalNote"
                rows="3"
                class="w-full"
                placeholder="Set operator note for these sessions."
              />
            </label>
          </div>

          <div class="mt-4 flex gap-2">
            <Button
              label="Batch Assign"
              icon="pi pi-users"
              class="flex-1 !rounded-xl"
              :loading="batchLoading"
              :disabled="!canBatchAssign || batchLoading"
              @click="submitBatchAssign"
            />
            <Button
              label="Clear"
              icon="pi pi-eraser"
              severity="secondary"
              outlined
              class="!rounded-xl"
              @click="resetBatchForm"
            />
          </div>
        </template>
      </Card>

      <Card class="!rounded-3xl !border !border-slate-200/90 !bg-white/95">
        <template #title>
          <h2 class="text-lg font-semibold text-slate-900">Session Detail Update</h2>
        </template>
        <template #content>
          <div v-if="selectedSession" class="grid gap-3">
            <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs">
              <p class="font-semibold text-slate-900">{{ selectedSession.serviceTitle }}</p>
              <p class="mt-1 text-slate-600">session: {{ selectedSession.id }}</p>
              <p class="mt-1 text-slate-600">booking: {{ selectedSession.bookingId }}</p>
              <p class="mt-1 text-slate-600">contact: {{ selectedSession.preferredContact }}</p>
              <p class="mt-1 text-slate-600">
                slots: {{ selectedSession.preferredTimeSlots.join(" | ") }}
              </p>
            </div>

            <label class="space-y-1">
              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Status
              </span>
              <select
                v-model="updateForm.status"
                class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option v-for="status in SESSION_STATUSES" :key="status" :value="status">
                  {{ status }}
                </option>
              </select>
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Assigned Agent
              </span>
              <InputText v-model="updateForm.assignedAgent" class="w-full" />
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Internal Note
              </span>
              <Textarea v-model="updateForm.internalNote" rows="3" class="w-full" />
            </label>

            <Button
              label="Update Session"
              icon="pi pi-save"
              class="w-full !rounded-xl"
              :loading="updateLoading"
              @click="submitUpdate"
            />
          </div>

          <p v-else class="rounded-xl border border-slate-200 px-3 py-6 text-sm text-slate-500">
            Select a session from the queue to edit details.
          </p>
        </template>
      </Card>
    </div>
  </section>
</template>
