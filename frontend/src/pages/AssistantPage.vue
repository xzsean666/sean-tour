<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import Button from "primevue/button";
import Card from "primevue/card";
import InputText from "primevue/inputtext";
import Message from "primevue/message";
import ProgressSpinner from "primevue/progressspinner";
import Tag from "primevue/tag";
import Textarea from "primevue/textarea";
import {
  assistantService,
  type AssistantSessionItem,
  type AssistantSessionStatus,
} from "../api/assistantService";

type SessionStatusFilter = "ALL" | AssistantSessionStatus;

const route = useRoute();
const PAGE_SIZE = 10;

const sessions = ref<AssistantSessionItem[]>([]);
const total = ref(0);
const offset = ref(0);
const hasMore = ref(false);

const listLoading = ref(false);
const submitLoading = ref(false);
const errorMessage = ref("");
const successMessage = ref("");

const filters = reactive<{
  bookingId: string;
  status: SessionStatusFilter;
}>({
  bookingId: "",
  status: "ALL",
});

const form = reactive({
  bookingId: "",
  topic: "",
  preferredContact: "",
  preferredTimeSlotsText: "",
  language: "",
});

const statusOptions: Array<{
  label: string;
  value: SessionStatusFilter;
}> = [
  { label: "All", value: "ALL" },
  { label: "Requested", value: "REQUESTED" },
  { label: "Assigned", value: "ASSIGNED" },
  { label: "In Progress", value: "IN_PROGRESS" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Canceled", value: "CANCELED" },
];

const hasPrevPage = computed(() => offset.value > 0);
const hasNextPage = computed(() => hasMore.value);
const pageStart = computed(() => (sessions.value.length > 0 ? offset.value + 1 : 0));
const pageEnd = computed(() => offset.value + sessions.value.length);

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseTimeSlots(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/g)
        .map((item) => item.trim())
        .filter((item) => !!item),
    ),
  );
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

function resetForm() {
  form.topic = "";
  form.preferredContact = "";
  form.preferredTimeSlotsText = "";
  form.language = "";
}

async function loadSessions(nextOffset: number = offset.value): Promise<void> {
  listLoading.value = true;
  errorMessage.value = "";

  try {
    const result = await assistantService.getMySessions({
      bookingId: filters.bookingId.trim() || undefined,
      status: filters.status === "ALL" ? undefined : filters.status,
      limit: PAGE_SIZE,
      offset: Math.max(nextOffset, 0),
    });

    sessions.value = result.items;
    total.value = result.total;
    offset.value = result.offset;
    hasMore.value = result.hasMore;
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Failed to load assistant sessions.";
  } finally {
    listLoading.value = false;
  }
}

async function applyFilters(): Promise<void> {
  await loadSessions(0);
}

async function submitSessionRequest(): Promise<void> {
  submitLoading.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const preferredTimeSlots = parseTimeSlots(form.preferredTimeSlotsText);
    const created = await assistantService.requestSession({
      bookingId: form.bookingId,
      topic: form.topic,
      preferredContact: form.preferredContact,
      preferredTimeSlots,
      ...(form.language.trim() ? { language: form.language.trim() } : {}),
    });

    successMessage.value = `Assistant session ${created.id} is ${created.status}.`;
    resetForm();
    await loadSessions(0);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Failed to request assistant session.";
  } finally {
    submitLoading.value = false;
  }
}

async function goPrevPage(): Promise<void> {
  if (listLoading.value || !hasPrevPage.value) {
    return;
  }

  await loadSessions(offset.value - PAGE_SIZE);
}

async function goNextPage(): Promise<void> {
  if (listLoading.value || !hasNextPage.value) {
    return;
  }

  await loadSessions(offset.value + PAGE_SIZE);
}

onMounted(async () => {
  const bookingIdFromQuery =
    typeof route.query.bookingId === "string" ? route.query.bookingId.trim() : "";

  if (bookingIdFromQuery) {
    form.bookingId = bookingIdFromQuery;
    filters.bookingId = bookingIdFromQuery;
  }

  await applyFilters();
});
</script>

<template>
  <section
    class="relative overflow-hidden rounded-3xl border border-[#0c6d64]/20 bg-gradient-to-br from-[#0a2f37] via-[#104d55] to-[#203152] px-6 py-8 text-white shadow-[0_26px_90px_-55px_rgba(7,41,46,0.95)]"
  >
    <div class="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[#f8b03c]/22 blur-3xl" />
    <div class="absolute -left-16 -bottom-24 h-52 w-52 rounded-full bg-[#2ad0a1]/15 blur-3xl" />

    <p class="relative text-xs font-semibold uppercase tracking-[0.16em] text-teal-100/90">Assistant</p>
    <h1 class="relative mt-2 text-3xl font-semibold leading-tight">Remote China Assistant</h1>
    <p class="relative mt-3 text-sm text-teal-50/90">
      Ask for real-time local support and monitor assignment/progress updates in one place.
    </p>
  </section>

  <Message v-if="errorMessage" severity="error" class="mt-4">{{ errorMessage }}</Message>
  <Message v-if="successMessage" severity="success" class="mt-4">{{ successMessage }}</Message>

  <section class="mt-6 grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
    <Card class="!rounded-3xl !border !border-slate-200/90 !bg-white/95">
      <template #title>
        <h2 class="text-xl font-semibold text-slate-900">Request Session</h2>
      </template>
      <template #content>
        <div class="grid gap-3">
          <label class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Booking ID</span>
            <InputText v-model="form.bookingId" class="w-full" placeholder="bk_xxx" />
          </label>

          <label class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Topic</span>
            <Textarea
              v-model="form.topic"
              rows="3"
              class="w-full"
              placeholder="What kind of support do you need?"
            />
          </label>

          <label class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Preferred Contact
            </span>
            <InputText
              v-model="form.preferredContact"
              class="w-full"
              placeholder="WeChat / WhatsApp / Email"
            />
          </label>

          <label class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Preferred Time Slots
            </span>
            <Textarea
              v-model="form.preferredTimeSlotsText"
              rows="3"
              class="w-full"
              placeholder="One slot per line, e.g. 2026-03-10 10:00-12:00 CST"
            />
          </label>

          <label class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Preferred Language (optional)
            </span>
            <InputText
              v-model="form.language"
              class="w-full"
              placeholder="English / Chinese / Spanish"
            />
          </label>
        </div>

        <div class="mt-4 grid gap-2 sm:grid-cols-2">
          <Button
            label="Submit Request"
            icon="pi pi-send"
            class="w-full !rounded-xl"
            :loading="submitLoading"
            @click="submitSessionRequest"
          />
          <Button
            label="Clear"
            icon="pi pi-eraser"
            severity="secondary"
            outlined
            class="w-full !rounded-xl"
            @click="resetForm"
          />
        </div>
      </template>
    </Card>

    <Card class="!rounded-3xl !border !border-slate-200/90 !bg-white/95">
      <template #title>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-xl font-semibold text-slate-900">My Sessions</h2>
          <Button
            label="Reload"
            icon="pi pi-refresh"
            text
            :loading="listLoading"
            @click="applyFilters"
          />
        </div>
      </template>
      <template #content>
        <div class="grid gap-3 md:grid-cols-2">
          <label class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Booking ID
            </span>
            <InputText v-model="filters.bookingId" class="w-full" placeholder="bk_xxx" />
          </label>
          <label class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Status</span>
            <select
              v-model="filters.status"
              class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option v-for="option in statusOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>
        </div>

        <div class="mt-4">
          <Button
            label="Apply Filters"
            icon="pi pi-filter"
            class="!rounded-xl"
            :loading="listLoading"
            @click="applyFilters"
          />
        </div>

        <div v-if="listLoading" class="mt-6 flex justify-center">
          <ProgressSpinner style="width: 34px; height: 34px" stroke-width="6" />
        </div>

        <div v-else class="mt-4 grid gap-2">
          <div
            v-for="item in sessions"
            :key="item.id"
            class="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="font-semibold text-slate-900">{{ item.serviceTitle }}</p>
              <Tag :value="item.status" :severity="getStatusSeverity(item.status)" rounded />
            </div>

            <p class="mt-1 text-xs text-slate-600">session: {{ item.id }}</p>
            <p class="mt-1 text-xs text-slate-600">booking: {{ item.bookingId }} · city: {{ item.city }}</p>
            <p class="mt-1 text-xs text-slate-600">language: {{ item.language }} · contact: {{ item.preferredContact }}</p>
            <p class="mt-1 text-xs text-slate-600">topic: {{ item.topic }}</p>
            <p class="mt-1 text-xs text-slate-600">slots: {{ item.preferredTimeSlots.join(" | ") }}</p>
            <p v-if="item.assignedAgent" class="mt-1 text-xs text-slate-600">agent: {{ item.assignedAgent }}</p>
            <p class="mt-1 text-xs text-slate-500">updated: {{ formatDate(item.updatedAt) }}</p>
          </div>

          <p v-if="sessions.length === 0" class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-6 text-sm text-slate-500">
            No assistant sessions found.
          </p>

          <div
            v-if="sessions.length > 0"
            class="mt-1 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
          >
            <p class="text-xs text-slate-600">
              Showing {{ pageStart }} - {{ pageEnd }} of {{ total }} sessions
            </p>
            <div class="flex items-center gap-2">
              <Button
                label="Previous"
                icon="pi pi-angle-left"
                text
                size="small"
                :disabled="!hasPrevPage || listLoading"
                @click="goPrevPage"
              />
              <Button
                label="Next"
                icon="pi pi-angle-right"
                icon-pos="right"
                text
                size="small"
                :disabled="!hasNextPage || listLoading"
                @click="goNextPage"
              />
            </div>
          </div>
        </div>
      </template>
    </Card>
  </section>
</template>
