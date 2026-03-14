<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import Button from "primevue/button";
import Card from "primevue/card";
import InputText from "primevue/inputtext";
import Message from "primevue/message";
import ProgressSpinner from "primevue/progressspinner";
import Tag from "primevue/tag";
import {
  adminPaymentService,
  type AdminUpdatePaymentStatusInput,
  type PaymentEventItem,
  type PaymentEventSource,
  type PaymentStatus,
} from "../api/adminPaymentService";
import { useAuthStore } from "../stores/auth.store";

const PAYMENT_SOURCES: PaymentEventSource[] = ["ADMIN", "CALLBACK", "SYNC"];
const PAYMENT_STATUSES: PaymentStatus[] = [
  "PENDING",
  "PARTIALLY_PAID",
  "PAID",
  "UNDERPAID",
  "EXPIRED",
  "REFUNDING",
  "REFUNDED",
];

const events = ref<PaymentEventItem[]>([]);
const total = ref(0);
const offset = ref(0);
const limit = ref(20);
const hasMore = ref(false);
const listLoading = ref(false);
const actionLoading = ref(false);
const exportLoading = ref(false);
const replayingEventId = ref("");
const errorMessage = ref("");
const successMessage = ref("");

const filters = reactive({
  eventId: "",
  paymentId: "",
  bookingId: "",
  actor: "",
  replayOfEventId: "",
  source: "",
  status: "",
});

const actionForm = reactive({
  paymentId: "",
  bookingId: "",
  status: "PAID",
  paidAmount: "",
  txHash: "",
  confirmations: "",
  eventId: "",
});
const { backendUser } = useAuthStore();

const hasAdminAccess = computed(() => !!backendUser.value?.isAdmin);

function normalizeOptionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fillActionFromEvent(event: PaymentEventItem): void {
  actionForm.paymentId = event.paymentId;
  actionForm.bookingId = event.bookingId;
  actionForm.status = event.status;
  actionForm.paidAmount = event.paidAmount;
  actionForm.txHash = event.txHash || "";
  actionForm.confirmations = String(event.confirmations);
  actionForm.eventId = "";
}

function resetFilters(): void {
  filters.eventId = "";
  filters.paymentId = "";
  filters.bookingId = "";
  filters.actor = "";
  filters.replayOfEventId = "";
  filters.source = "";
  filters.status = "";
}

async function loadEvents(): Promise<void> {
  await loadEventsAtOffset(offset.value);
}

async function loadEventsAtOffset(nextOffset: number): Promise<void> {
  if (!hasAdminAccess.value) {
    events.value = [];
    total.value = 0;
    offset.value = 0;
    hasMore.value = false;
    return;
  }

  listLoading.value = true;
  errorMessage.value = "";

  try {
    const result = await adminPaymentService.listPaymentEvents({
      eventId: normalizeOptionalText(filters.eventId),
      paymentId: normalizeOptionalText(filters.paymentId),
      bookingId: normalizeOptionalText(filters.bookingId),
      actor: normalizeOptionalText(filters.actor),
      replayOfEventId: normalizeOptionalText(filters.replayOfEventId),
      source: (normalizeOptionalText(filters.source) as PaymentEventSource) || undefined,
      status: (normalizeOptionalText(filters.status) as PaymentStatus) || undefined,
      limit: limit.value,
      offset: nextOffset,
    });

    events.value = result.items;
    total.value = result.total;
    offset.value = result.offset;
    hasMore.value = result.hasMore;
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Failed to load payment events.";
  } finally {
    listLoading.value = false;
  }
}

function escapeCsv(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

async function exportCsv(): Promise<void> {
  if (!hasAdminAccess.value) {
    return;
  }

  exportLoading.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const allRows: PaymentEventItem[] = [];
    const exportLimit = 100;
    let nextOffset = 0;

    for (let i = 0; i < 50; i += 1) {
      const result = await adminPaymentService.listPaymentEvents({
        eventId: normalizeOptionalText(filters.eventId),
        paymentId: normalizeOptionalText(filters.paymentId),
        bookingId: normalizeOptionalText(filters.bookingId),
        actor: normalizeOptionalText(filters.actor),
        replayOfEventId: normalizeOptionalText(filters.replayOfEventId),
        source: (normalizeOptionalText(filters.source) as PaymentEventSource) || undefined,
        status: (normalizeOptionalText(filters.status) as PaymentStatus) || undefined,
        limit: exportLimit,
        offset: nextOffset,
      });

      allRows.push(...result.items);
      if (!result.hasMore) {
        break;
      }

      nextOffset = result.offset + result.limit;
    }

    const header = [
      "eventId",
      "paymentId",
      "bookingId",
      "source",
      "actor",
      "replayOfEventId",
      "status",
      "paidAmount",
      "txHash",
      "confirmations",
      "createdAt",
    ];
    const csvLines = [header.join(",")];
    for (const event of allRows) {
      csvLines.push(
        [
          event.eventId,
          event.paymentId,
          event.bookingId,
          event.source,
          event.actor,
          event.replayOfEventId || "",
          event.status,
          event.paidAmount,
          event.txHash || "",
          String(event.confirmations),
          event.createdAt,
        ]
          .map((field) => escapeCsv(field))
          .join(","),
      );
    }

    const blob = new Blob([csvLines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `payment-events-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(blobUrl);

    successMessage.value = `Exported ${allRows.length} payment events.`;
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Failed to export payment events.";
  } finally {
    exportLoading.value = false;
  }
}

async function applyFilters(): Promise<void> {
  await loadEventsAtOffset(0);
}

async function submitManualUpdate(): Promise<void> {
  actionLoading.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    if (!hasAdminAccess.value) {
      throw new Error("This account does not have admin access.");
    }

    const confirmationsText = normalizeOptionalText(actionForm.confirmations);
    let confirmations: number | undefined;
    if (confirmationsText) {
      confirmations = Number(confirmationsText);
      if (!Number.isInteger(confirmations) || confirmations < 0) {
        throw new Error("Confirmations must be a non-negative integer.");
      }
    }

    const input: AdminUpdatePaymentStatusInput = {
      paymentId: normalizeOptionalText(actionForm.paymentId),
      bookingId: normalizeOptionalText(actionForm.bookingId),
      status: actionForm.status as PaymentStatus,
      paidAmount: normalizeOptionalText(actionForm.paidAmount),
      txHash: normalizeOptionalText(actionForm.txHash),
      confirmations,
      eventId: normalizeOptionalText(actionForm.eventId),
    };

    if (!input.paymentId && !input.bookingId) {
      throw new Error("paymentId or bookingId is required.");
    }

    const result = await adminPaymentService.updatePaymentStatus(input);
    successMessage.value = `Payment ${result.id} updated to ${result.status}.`;
    actionForm.paymentId = result.id;
    actionForm.bookingId = result.bookingId;
    actionForm.status = result.status;
    actionForm.paidAmount = result.paidAmount;
    actionForm.txHash = result.txHash || "";
    actionForm.confirmations = String(result.confirmations);
    await loadEvents();
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Failed to update payment status.";
  } finally {
    actionLoading.value = false;
  }
}

async function replayEvent(event: PaymentEventItem): Promise<void> {
  const confirmed = window.confirm(
    `Replay this event for payment ${event.paymentId}?`,
  );
  if (!confirmed) {
    return;
  }

  replayingEventId.value = event.eventId;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const replayEventId = `${event.eventId}_replay_${Date.now()}`;
    const result = await adminPaymentService.updatePaymentStatus({
      paymentId: event.paymentId,
      bookingId: event.bookingId,
      status: event.status,
      paidAmount: event.paidAmount,
      txHash: event.txHash,
      confirmations: event.confirmations,
      eventId: replayEventId,
      replayOfEventId: event.eventId,
    });

    successMessage.value = `Replayed event for payment ${result.id} -> ${result.status}.`;
    fillActionFromEvent(event);
    await loadEventsAtOffset(offset.value);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Failed to replay payment event.";
  } finally {
    replayingEventId.value = "";
  }
}

onMounted(async () => {
  await applyFilters();
});
</script>

<template>
  <section
    class="rounded-3xl border border-slate-200 bg-white px-6 py-7 shadow-sm"
  >
    <p class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
      Admin
    </p>
    <h1 class="mt-2 text-3xl font-semibold text-slate-900">Payment Observability</h1>
    <p class="mt-2 text-sm text-slate-600">
      Search payment events and manually push payment status when needed.
    </p>
  </section>

  <Message v-if="!hasAdminAccess" severity="warn" class="mt-4">
    This account does not have admin access.
  </Message>
  <Message v-if="errorMessage" severity="error" class="mt-4">{{
    errorMessage
  }}</Message>
  <Message v-if="successMessage" severity="success" class="mt-4">{{
    successMessage
  }}</Message>

  <section class="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
    <Card class="!rounded-2xl !border !border-slate-200">
      <template #title>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-lg font-semibold text-slate-900">Payment Events</h2>
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
            <span
              class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
            >
              Event ID
            </span>
            <InputText v-model="filters.eventId" class="w-full" />
          </label>

          <label class="space-y-1">
            <span
              class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
            >
              Payment ID
            </span>
            <InputText v-model="filters.paymentId" class="w-full" />
          </label>

          <label class="space-y-1">
            <span
              class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
            >
              Booking ID
            </span>
            <InputText v-model="filters.bookingId" class="w-full" />
          </label>

          <label class="space-y-1">
            <span
              class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
            >
              Actor
            </span>
            <InputText
              v-model="filters.actor"
              class="w-full"
              placeholder="admin:<userId> / callback_webhook / sync_job"
            />
          </label>

          <label class="space-y-1">
            <span
              class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
            >
              Replay Of Event ID
            </span>
            <InputText
              v-model="filters.replayOfEventId"
              class="w-full"
              placeholder="evt_..."
            />
          </label>

          <label class="space-y-1">
            <span
              class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
            >
              Source
            </span>
            <select
              v-model="filters.source"
              class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option v-for="source in PAYMENT_SOURCES" :key="source" :value="source">
                {{ source }}
              </option>
            </select>
          </label>

          <label class="space-y-1 md:col-span-2">
            <span
              class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
            >
              Status
            </span>
            <select
              v-model="filters.status"
              class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option v-for="status in PAYMENT_STATUSES" :key="status" :value="status">
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
          <Button
            label="Export CSV"
            icon="pi pi-download"
            severity="help"
            outlined
            class="!rounded-xl"
            :loading="exportLoading"
            @click="exportCsv"
          />
        </div>

        <div v-if="listLoading" class="flex justify-center py-8">
          <ProgressSpinner style="width: 34px; height: 34px" stroke-width="6" />
        </div>

        <div v-else class="mt-4 grid gap-2">
          <div
            v-for="event in events"
            :key="event.eventId"
            class="rounded-xl border border-slate-200 px-3 py-3 text-sm"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="font-semibold text-slate-900">{{ event.eventId }}</p>
              <p class="text-xs text-slate-500">{{ formatDate(event.createdAt) }}</p>
            </div>

            <div class="mt-2 flex flex-wrap items-center gap-2">
              <Tag :value="event.source" severity="contrast" rounded />
              <Tag :value="event.status" :severity="event.status === 'PAID' ? 'success' : 'warn'" rounded />
            </div>

            <p class="mt-2 text-xs text-slate-600">
              payment: {{ event.paymentId }} · booking: {{ event.bookingId }}
            </p>
            <p class="mt-1 text-xs text-slate-600">
              actor: {{ event.actor }}
              <span v-if="event.replayOfEventId" class="break-all">
                · replay of: {{ event.replayOfEventId }}
              </span>
            </p>
            <a
              class="mt-1 inline-block text-xs text-sky-700 underline"
              :href="`/orders/${event.bookingId}`"
              target="_blank"
              rel="noreferrer"
            >
              Open order detail
            </a>
            <p class="mt-1 text-xs text-slate-600">
              paid: {{ event.paidAmount }} USDT · conf: {{ event.confirmations }}
            </p>
            <p v-if="event.txHash" class="mt-1 break-all text-xs text-slate-500">
              tx: {{ event.txHash }}
            </p>

            <div class="mt-2">
              <Button
                label="Use In Update Form"
                icon="pi pi-arrow-right"
                text
                size="small"
                @click="fillActionFromEvent(event)"
              />
              <Button
                label="Replay Event"
                icon="pi pi-replay"
                text
                size="small"
                :loading="replayingEventId === event.eventId"
                @click="replayEvent(event)"
              />
            </div>
          </div>

          <p v-if="events.length === 0" class="text-sm text-slate-500">No payment events found.</p>
          <p class="text-xs text-slate-500">
            Total events: {{ total }} · Showing {{ events.length }} · Offset {{ offset }}
          </p>
          <div class="flex flex-wrap items-center gap-2">
            <Button
              label="Previous"
              icon="pi pi-angle-left"
              severity="secondary"
              outlined
              size="small"
              :disabled="offset <= 0 || listLoading"
              @click="loadEventsAtOffset(Math.max(offset - limit, 0))"
            />
            <Button
              label="Next"
              icon="pi pi-angle-right"
              icon-pos="right"
              severity="secondary"
              outlined
              size="small"
              :disabled="!hasMore || listLoading"
              @click="loadEventsAtOffset(offset + limit)"
            />
          </div>
        </div>
      </template>
    </Card>

    <Card class="!rounded-2xl !border !border-slate-200">
      <template #title>
        <h2 class="text-lg font-semibold text-slate-900">Manual Status Update</h2>
      </template>
      <template #content>
        <p class="mb-3 text-sm text-slate-600">
          Use this for manual correction or replay when callback misses.
        </p>

        <div class="grid gap-3">
          <label class="space-y-1">
            <span
              class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
            >
              Payment ID
            </span>
            <InputText v-model="actionForm.paymentId" class="w-full" />
          </label>

          <label class="space-y-1">
            <span
              class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
            >
              Booking ID
            </span>
            <InputText v-model="actionForm.bookingId" class="w-full" />
          </label>

          <label class="space-y-1">
            <span
              class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
            >
              Status
            </span>
            <select
              v-model="actionForm.status"
              class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option v-for="status in PAYMENT_STATUSES" :key="status" :value="status">
                {{ status }}
              </option>
            </select>
          </label>

          <label class="space-y-1">
            <span
              class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
            >
              Paid Amount
            </span>
            <InputText v-model="actionForm.paidAmount" class="w-full" placeholder="100.00" />
          </label>

          <label class="space-y-1">
            <span
              class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
            >
              Tx Hash
            </span>
            <InputText v-model="actionForm.txHash" class="w-full" />
          </label>

          <label class="space-y-1">
            <span
              class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
            >
              Confirmations
            </span>
            <InputText v-model="actionForm.confirmations" class="w-full" />
          </label>

          <label class="space-y-1">
            <span
              class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
            >
              Event ID (optional)
            </span>
            <InputText v-model="actionForm.eventId" class="w-full" />
          </label>
        </div>

        <div class="mt-4">
          <Button
            label="Submit Update"
            icon="pi pi-send"
            class="w-full !rounded-xl"
            :loading="actionLoading"
            @click="submitManualUpdate"
          />
        </div>
      </template>
    </Card>
  </section>
</template>
