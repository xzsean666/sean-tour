<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import Button from "primevue/button";
import Card from "primevue/card";
import InputText from "primevue/inputtext";
import Message from "primevue/message";
import ProgressSpinner from "primevue/progressspinner";
import Tag from "primevue/tag";
import { adminOrderService } from "../api/adminOrderService";
import type {
  BookingStatus,
  OrderItem,
  PaymentEvent,
  PaymentStatus,
  ServiceResource,
} from "../api/travelService";
import { useAuthStore } from "../stores/auth.store";

const PAGE_SIZE = 12;
const route = useRoute();
const BOOKING_STATUSES: BookingStatus[] = [
  "PENDING_PAYMENT",
  "PAID",
  "CONFIRMED",
  "IN_SERVICE",
  "COMPLETED",
  "CANCELED",
  "REFUNDING",
  "REFUNDED",
];
const PAYMENT_STATUSES: PaymentStatus[] = [
  "PENDING",
  "PARTIALLY_PAID",
  "PAID",
  "UNDERPAID",
  "EXPIRED",
  "REFUNDING",
  "REFUNDED",
];

const orders = ref<OrderItem[]>([]);
const selectedOrder = ref<OrderItem | null>(null);
const total = ref(0);
const offset = ref(0);
const hasMore = ref(false);
const listLoading = ref(false);
const detailLoading = ref(false);
const actionLoading = ref(false);
const resourceActionLoading = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const assignableResources = ref<ServiceResource[]>([]);

const filters = reactive({
  bookingId: "",
  serviceId: "",
  userId: "",
  bookingStatus: "",
  paymentStatus: "",
});

const actionForm = reactive({
  bookingId: "",
  status: "CONFIRMED",
  reason: "",
});

const resourceForm = reactive({
  resourceId: "",
});
const { backendUser } = useAuthStore();

const hasAdminAccess = computed(() => !!backendUser.value?.isAdmin);
const hasPrevPage = computed(() => offset.value > 0);
const pageStart = computed(() => (orders.value.length > 0 ? offset.value + 1 : 0));
const pageEnd = computed(() => offset.value + orders.value.length);
const canManageResourceAssignment = computed(() => {
  if (!selectedOrder.value?.timeSlot) {
    return false;
  }

  return assignableResources.value.length > 0;
});
const selectedResourceMeta = computed(() =>
  assignableResources.value.find(
    (resource) => resource.id === resourceForm.resourceId,
  ),
);
const canSubmitResourceReassignment = computed(() => {
  if (!selectedOrder.value?.timeSlot || !resourceForm.resourceId) {
    return false;
  }

  return resourceForm.resourceId !== selectedOrder.value.assignedResourceId;
});

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

function getBookingSeverity(
  status: BookingStatus,
): "success" | "info" | "warn" | "danger" | "contrast" {
  if (status === "COMPLETED" || status === "REFUNDED") {
    return "success";
  }

  if (status === "IN_SERVICE" || status === "CONFIRMED") {
    return "info";
  }

  if (status === "CANCELED") {
    return "danger";
  }

  if (status === "PAID") {
    return "contrast";
  }

  return "warn";
}

function getPaymentSeverity(
  status: PaymentStatus,
): "success" | "info" | "warn" | "danger" {
  if (status === "PAID" || status === "REFUNDED") {
    return "success";
  }

  if (status === "REFUNDING") {
    return "info";
  }

  if (status === "EXPIRED") {
    return "danger";
  }

  return "warn";
}

function getEventSeverity(
  event: PaymentEvent,
): "success" | "info" | "warn" | "danger" {
  if (event.status === "PAID" || event.status === "REFUNDED") {
    return "success";
  }

  if (event.status === "EXPIRED") {
    return "danger";
  }

  if (
    event.status === "PARTIALLY_PAID" ||
    event.status === "UNDERPAID" ||
    event.status === "REFUNDING"
  ) {
    return "info";
  }

  return "warn";
}

function buildResourceOptionLabel(resource: ServiceResource): string {
  const isCurrent = resource.id === selectedOrder.value?.assignedResourceId;
  const seatLabel = resource.seats ? ` · ${resource.seats} seats` : "";
  return `${resource.label}${isCurrent ? " (Current)" : ""}${seatLabel}`;
}

function syncFiltersFromRoute(): void {
  filters.bookingId =
    typeof route.query.bookingId === "string" ? route.query.bookingId : "";
  filters.serviceId =
    typeof route.query.serviceId === "string" ? route.query.serviceId : "";
}

async function selectOrder(orderId: string): Promise<void> {
  if (!hasAdminAccess.value) {
    return;
  }

  detailLoading.value = true;
  errorMessage.value = "";

  try {
    const detail = await adminOrderService.getOrderDetail(orderId);
    const resources = detail.timeSlot
      ? await adminOrderService.listAssignableBookingResources(detail.bookingId)
      : [];

    selectedOrder.value = detail;
    assignableResources.value = resources;
    actionForm.bookingId = detail.bookingId;
    actionForm.status = detail.bookingStatus;
    actionForm.reason = "";
    resourceForm.resourceId =
      detail.assignedResourceId || resources[0]?.id || "";
  } catch (error) {
    assignableResources.value = [];
    resourceForm.resourceId = "";
    errorMessage.value =
      error instanceof Error ? error.message : "Failed to load order detail.";
  } finally {
    detailLoading.value = false;
  }
}

async function loadOrders(nextOffset = offset.value): Promise<void> {
  if (!hasAdminAccess.value) {
    orders.value = [];
    selectedOrder.value = null;
    total.value = 0;
    offset.value = 0;
    hasMore.value = false;
    return;
  }

  listLoading.value = true;
  errorMessage.value = "";

  try {
    const result = await adminOrderService.listOrders({
      bookingId: normalizeOptionalText(filters.bookingId),
      serviceId: normalizeOptionalText(filters.serviceId),
      userId: normalizeOptionalText(filters.userId),
      bookingStatus:
        (normalizeOptionalText(filters.bookingStatus) as BookingStatus) ||
        undefined,
      paymentStatus:
        (normalizeOptionalText(filters.paymentStatus) as PaymentStatus) ||
        undefined,
      limit: PAGE_SIZE,
      offset: nextOffset,
    });

    orders.value = result.items;
    total.value = result.total;
    offset.value = result.offset;
    hasMore.value = result.hasMore;

    const selectedId = selectedOrder.value?.id;
    const nextSelected =
      result.items.find((item) => item.id === selectedId) || result.items[0];

    if (nextSelected) {
      await selectOrder(nextSelected.id);
    } else {
      selectedOrder.value = null;
      assignableResources.value = [];
      actionForm.bookingId = "";
      actionForm.reason = "";
      resourceForm.resourceId = "";
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Failed to load admin orders.";
  } finally {
    listLoading.value = false;
  }
}

async function applyFilters(): Promise<void> {
  await loadOrders(0);
}

async function goPrevPage(): Promise<void> {
  if (!hasPrevPage.value || listLoading.value) {
    return;
  }

  await loadOrders(offset.value - PAGE_SIZE);
}

async function goNextPage(): Promise<void> {
  if (!hasMore.value || listLoading.value) {
    return;
  }

  await loadOrders(offset.value + PAGE_SIZE);
}

async function submitStatusUpdate(): Promise<void> {
  if (!actionForm.bookingId) {
    return;
  }

  actionLoading.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const updated = await adminOrderService.updateBookingStatus({
      bookingId: actionForm.bookingId,
      status: actionForm.status as BookingStatus,
      reason: normalizeOptionalText(actionForm.reason),
    });

    successMessage.value = `Booking ${updated.id} moved to ${updated.status}.`;
    await loadOrders(offset.value);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Failed to update booking status.";
  } finally {
    actionLoading.value = false;
  }
}

async function submitResourceReassignment(): Promise<void> {
  if (!selectedOrder.value?.bookingId || !resourceForm.resourceId) {
    return;
  }

  resourceActionLoading.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const updated = await adminOrderService.reassignBookingResource({
      bookingId: selectedOrder.value.bookingId,
      resourceId: resourceForm.resourceId,
    });

    successMessage.value = updated.assignedResource
      ? `Booking ${updated.id} reassigned to ${updated.assignedResource.label}.`
      : `Booking ${updated.id} resource assignment updated.`;
    await loadOrders(offset.value);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Failed to reassign resource.";
  } finally {
    resourceActionLoading.value = false;
  }
}

onMounted(async () => {
  syncFiltersFromRoute();
  await loadOrders(0);
});

watch(
  () => route.query,
  async () => {
    syncFiltersFromRoute();
    await loadOrders(0);
  },
);
</script>

<template>
  <section class="rounded-3xl border border-slate-200 bg-white px-6 py-7 shadow-sm">
    <p class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Admin</p>
    <h1 class="mt-2 text-3xl font-semibold text-slate-900">Order Operations</h1>
    <p class="mt-2 text-sm text-slate-600">
      Review bookings, inspect vouchers and contacts, and push booking status through the service lifecycle.
    </p>
  </section>

  <Message v-if="!hasAdminAccess" severity="warn" class="mt-4">
    This account does not have admin access.
  </Message>
  <Message v-if="errorMessage" severity="error" class="mt-4">{{ errorMessage }}</Message>
  <Message v-if="successMessage" severity="success" class="mt-4">{{ successMessage }}</Message>

  <section class="mt-6 grid gap-4 lg:grid-cols-[0.96fr_1.04fr]">
    <div class="grid gap-4">
      <Card class="!rounded-2xl !border !border-slate-200">
        <template #content>
          <div class="grid gap-3 md:grid-cols-3">
            <label class="space-y-1">
              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Booking ID</span>
              <InputText v-model="filters.bookingId" class="w-full" placeholder="bk_xxx" />
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Service ID</span>
              <InputText v-model="filters.serviceId" class="w-full" placeholder="svc_xxx" />
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">User ID</span>
              <InputText v-model="filters.userId" class="w-full" placeholder="user_xxx" />
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Booking Status</span>
              <select
                v-model="filters.bookingStatus"
                class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">All</option>
                <option v-for="status in BOOKING_STATUSES" :key="status" :value="status">
                  {{ status }}
                </option>
              </select>
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Payment Status</span>
              <select
                v-model="filters.paymentStatus"
                class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">All</option>
                <option v-for="status in PAYMENT_STATUSES" :key="status" :value="status">
                  {{ status }}
                </option>
              </select>
            </label>

            <div class="flex items-end md:col-span-3">
              <Button
                label="Apply Filters"
                icon="pi pi-filter"
                class="w-full !rounded-xl"
                :loading="listLoading"
                @click="applyFilters"
              />
            </div>
          </div>
        </template>
      </Card>

      <Card class="!rounded-2xl !border !border-slate-200">
        <template #title>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-lg font-semibold text-slate-900">Orders</h2>
            <p class="text-sm text-slate-500">
              Showing {{ pageStart }} - {{ pageEnd }} of {{ total }}
            </p>
          </div>
        </template>

        <template #content>
          <div v-if="listLoading" class="flex justify-center py-8">
            <ProgressSpinner style="width: 34px; height: 34px" stroke-width="6" />
          </div>

          <div v-else class="grid gap-3">
            <button
              v-for="item in orders"
              :key="item.id"
              type="button"
              class="rounded-2xl border px-4 py-4 text-left transition"
              :class="
                selectedOrder?.id === item.id
                  ? 'border-slate-900 bg-slate-50'
                  : 'border-slate-200 hover:border-slate-400'
              "
              @click="selectOrder(item.id)"
            >
              <div class="flex flex-wrap items-center gap-2">
                <p class="font-semibold text-slate-900">{{ item.serviceTitle }}</p>
                <Tag :value="item.bookingStatus" :severity="getBookingSeverity(item.bookingStatus)" rounded />
                <Tag :value="item.paymentStatus" :severity="getPaymentSeverity(item.paymentStatus)" rounded />
              </div>
              <p class="mt-2 text-xs text-slate-500">{{ item.id }} · {{ item.userId }}</p>
              <p class="mt-1 text-sm text-slate-600">
                {{ item.city }} · {{ item.startDate }} to {{ item.endDate }}
              </p>
              <p v-if="item.assignedResourceLabel" class="mt-1 text-xs text-slate-500">
                Assigned: {{ item.assignedResourceLabel }}
              </p>
              <p class="mt-1 text-sm font-semibold text-[#0f5b54]">
                {{ item.expectedAmount }} USDT
              </p>
            </button>

            <p
              v-if="orders.length === 0"
              class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500"
            >
              No orders matched the current filter.
            </p>

            <div
              v-if="orders.length > 0"
              class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3"
            >
              <Button
                label="Previous"
                icon="pi pi-angle-left"
                text
                :disabled="!hasPrevPage || listLoading"
                @click="goPrevPage"
              />
              <Button
                label="Next"
                icon="pi pi-angle-right"
                icon-pos="right"
                text
                :disabled="!hasMore || listLoading"
                @click="goNextPage"
              />
            </div>
          </div>
        </template>
      </Card>
    </div>

    <Card class="!rounded-2xl !border !border-slate-200">
      <template #title>
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-lg font-semibold text-slate-900">
            {{ selectedOrder ? `Order ${selectedOrder.id}` : "Order Detail" }}
          </h2>
          <Button
            v-if="selectedOrder"
            label="Reload"
            icon="pi pi-refresh"
            text
            :loading="detailLoading"
            @click="selectOrder(selectedOrder.id)"
          />
        </div>
      </template>

      <template #content>
        <div v-if="detailLoading" class="flex justify-center py-8">
          <ProgressSpinner style="width: 34px; height: 34px" stroke-width="6" />
        </div>

        <div v-else-if="selectedOrder" class="grid gap-4">
          <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
            <div class="flex flex-wrap items-center gap-2">
              <Tag :value="selectedOrder.bookingStatus" :severity="getBookingSeverity(selectedOrder.bookingStatus)" rounded />
              <Tag :value="selectedOrder.paymentStatus" :severity="getPaymentSeverity(selectedOrder.paymentStatus)" rounded />
            </div>
            <p class="mt-3"><span class="text-slate-500">Booking ID:</span> {{ selectedOrder.bookingId }}</p>
            <p class="mt-1"><span class="text-slate-500">User ID:</span> {{ selectedOrder.userId }}</p>
            <p class="mt-1"><span class="text-slate-500">Travel:</span> {{ selectedOrder.startDate }} to {{ selectedOrder.endDate }}</p>
            <p v-if="selectedOrder.timeSlot" class="mt-1"><span class="text-slate-500">Time Slot:</span> {{ selectedOrder.timeSlot }}</p>
            <p v-if="selectedOrder.assignedResourceLabel" class="mt-1">
              <span class="text-slate-500">Assigned Resource:</span>
              {{ selectedOrder.assignedResourceLabel }}
            </p>
            <p class="mt-1"><span class="text-slate-500">Created:</span> {{ formatDate(selectedOrder.createdAt) }}</p>
          </div>

          <div class="grid gap-3 md:grid-cols-2">
            <div class="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Support Contact</p>
              <p class="mt-2 font-semibold">{{ selectedOrder.supportContact?.name || "Sean Tour Ops" }}</p>
              <p class="mt-1">
                {{ selectedOrder.supportContact?.channel || "Channel" }}:
                {{ selectedOrder.supportContact?.value || "Shared after confirmation" }}
              </p>
            </div>

            <div class="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Voucher</p>
              <p class="mt-2 font-mono font-semibold">
                {{ selectedOrder.serviceVoucherCode || "Pending activation" }}
              </p>
              <p class="mt-2 leading-6">
                {{ selectedOrder.serviceVoucherInstructions || "Voucher instructions are not available yet." }}
              </p>
            </div>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Cancellation Policy</p>
            <p class="mt-2 leading-6">
              {{ selectedOrder.cancellationPolicy || "No policy configured." }}
            </p>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <h3 class="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
              Resource Assignment
            </h3>

            <div v-if="!selectedOrder.timeSlot" class="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
              This booking has no time slot, so there is no resource assignment workflow.
            </div>

            <div
              v-else-if="!canManageResourceAssignment"
              class="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500"
            >
              No assignable resources are available for {{ selectedOrder.timeSlot }}.
            </div>

            <div v-else class="mt-3 grid gap-3 md:grid-cols-2">
              <label class="space-y-1">
                <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Assignable Resource
                </span>
                <select
                  v-model="resourceForm.resourceId"
                  class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option
                    v-for="resource in assignableResources"
                    :key="resource.id"
                    :value="resource.id"
                  >
                    {{ buildResourceOptionLabel(resource) }}
                  </option>
                </select>
              </label>

              <div
                v-if="selectedResourceMeta"
                class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700"
              >
                <p class="font-semibold text-slate-900">{{ selectedResourceMeta.label }}</p>
                <p class="mt-2">
                  Status:
                  <span class="font-semibold">{{ selectedResourceMeta.status }}</span>
                </p>
                <p v-if="selectedResourceMeta.languages.length > 0" class="mt-1">
                  Languages:
                  <span class="font-semibold">{{ selectedResourceMeta.languages.join(" / ") }}</span>
                </p>
                <p v-if="selectedResourceMeta.seats" class="mt-1">
                  Seats:
                  <span class="font-semibold">{{ selectedResourceMeta.seats }}</span>
                </p>
                <p class="mt-1 text-xs text-slate-500">
                  Slot visibility:
                  {{ selectedResourceMeta.availableTimeSlots.includes(selectedOrder.timeSlot || "")
                    ? "Available for reassignment"
                    : "Currently held by this booking" }}
                </p>
              </div>

              <div class="md:col-span-2">
                <Button
                  label="Reassign Resource"
                  icon="pi pi-directions-alt"
                  class="!rounded-xl"
                  :loading="resourceActionLoading"
                  :disabled="!canSubmitResourceReassignment"
                  @click="submitResourceReassignment"
                />
              </div>
            </div>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <h3 class="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
              Update Booking Status
            </h3>
            <div class="mt-3 grid gap-3 md:grid-cols-2">
              <label class="space-y-1">
                <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Next Status
                </span>
                <select
                  v-model="actionForm.status"
                  class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option v-for="status in BOOKING_STATUSES" :key="status" :value="status">
                    {{ status }}
                  </option>
                </select>
              </label>

              <label class="space-y-1 md:col-span-2">
                <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Reason (optional)
                </span>
                <textarea
                  v-model="actionForm.reason"
                  rows="3"
                  class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Useful for cancel/refund transitions."
                />
              </label>
            </div>

            <Button
              label="Apply Status"
              icon="pi pi-sync"
              class="mt-4 !rounded-xl"
              :loading="actionLoading"
              @click="submitStatusUpdate"
            />
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <h3 class="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
              Payment Timeline
            </h3>
            <div class="mt-3 grid gap-3">
              <div
                v-for="event in selectedOrder.paymentEvents"
                :key="event.eventId"
                class="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
              >
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <Tag :value="event.source" severity="contrast" rounded />
                    <Tag :value="event.status" :severity="getEventSeverity(event)" rounded />
                  </div>
                  <span class="text-xs text-slate-500">{{ formatDate(event.createdAt) }}</span>
                </div>
                <p class="mt-2 text-xs text-slate-600">
                  {{ event.eventId }} · {{ event.paidAmount }} USDT · {{ event.confirmations }} confirmations
                </p>
                <p v-if="event.txHash" class="mt-1 break-all text-xs text-slate-500">
                  {{ event.txHash }}
                </p>
              </div>

              <p
                v-if="selectedOrder.paymentEvents.length === 0"
                class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500"
              >
                No payment events for this order.
              </p>
            </div>
          </div>
        </div>

        <p
          v-else
          class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500"
        >
          Select an order from the left to inspect its details.
        </p>
      </template>
    </Card>
  </section>
</template>
