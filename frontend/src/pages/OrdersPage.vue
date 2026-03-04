<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import Button from "primevue/button";
import Card from "primevue/card";
import Message from "primevue/message";
import ProgressSpinner from "primevue/progressspinner";
import Tag from "primevue/tag";
import {
  travelService,
  type BookingStatus,
  type OrderItem,
} from "../api/travelService";

type BookingStatusFilter = "ALL" | BookingStatus;

const PAGE_SIZE = 8;

const bookingStatusFilter = ref<BookingStatusFilter>("ALL");
const loading = ref(false);
const errorMessage = ref("");
const orders = ref<OrderItem[]>([]);
const total = ref(0);
const offset = ref(0);
const hasMore = ref(false);

const bookingStatusOptions: Array<{
  label: string;
  value: BookingStatusFilter;
}> = [
  { label: "All", value: "ALL" },
  { label: "Pending Payment", value: "PENDING_PAYMENT" },
  { label: "Paid", value: "PAID" },
  { label: "Confirmed", value: "CONFIRMED" },
  { label: "In Service", value: "IN_SERVICE" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Canceled", value: "CANCELED" },
  { label: "Refunding", value: "REFUNDING" },
  { label: "Refunded", value: "REFUNDED" },
];

const hasPrevPage = computed(() => offset.value > 0);
const hasNextPage = computed(() => hasMore.value);
const pageStart = computed(() => (orders.value.length === 0 ? 0 : offset.value + 1));
const pageEnd = computed(() => offset.value + orders.value.length);

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
  status: "PENDING" | "PAID" | "EXPIRED",
): "success" | "warn" | "danger" {
  if (status === "PAID") {
    return "success";
  }

  if (status === "EXPIRED") {
    return "danger";
  }

  return "warn";
}

async function loadOrders(nextOffset: number = offset.value): Promise<void> {
  loading.value = true;
  errorMessage.value = "";

  try {
    const result = await travelService.getMyOrders({
      bookingStatus:
        bookingStatusFilter.value === "ALL"
          ? undefined
          : bookingStatusFilter.value,
      limit: PAGE_SIZE,
      offset: Math.max(nextOffset, 0),
    });

    orders.value = result.items;
    total.value = result.total;
    offset.value = result.offset;
    hasMore.value = result.hasMore;
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Failed to load orders.";
  } finally {
    loading.value = false;
  }
}

async function applyFilters(): Promise<void> {
  await loadOrders(0);
}

async function goPrevPage(): Promise<void> {
  if (!hasPrevPage.value || loading.value) {
    return;
  }

  await loadOrders(offset.value - PAGE_SIZE);
}

async function goNextPage(): Promise<void> {
  if (!hasNextPage.value || loading.value) {
    return;
  }

  await loadOrders(offset.value + PAGE_SIZE);
}

onMounted(async () => {
  await loadOrders(0);
});
</script>

<template>
  <section
    class="relative overflow-hidden rounded-3xl border border-[#0c6d64]/20 bg-gradient-to-br from-[#093039] via-[#0d4850] to-[#1a3a61] px-6 py-8 text-white shadow-[0_26px_90px_-55px_rgba(7,41,46,0.95)]"
  >
    <div class="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[#f8b03c]/22 blur-3xl" />
    <div class="absolute -left-16 -bottom-24 h-52 w-52 rounded-full bg-[#2ad0a1]/15 blur-3xl" />

    <p class="relative text-xs font-semibold uppercase tracking-[0.16em] text-teal-100/90">Orders</p>
    <h1 class="relative mt-2 text-3xl font-semibold leading-tight">Your Travel Orders</h1>
    <p class="relative mt-3 text-sm text-teal-50/90">
      Track booking progress, payment status, and open checkout whenever action is needed.
    </p>
  </section>

  <Card class="mt-4 !rounded-3xl !border !border-slate-200/90 !bg-white/95">
    <template #content>
      <div class="grid gap-3 md:grid-cols-[240px_auto_auto] md:items-end">
        <label class="space-y-1">
          <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Booking Status
          </span>
          <select
            v-model="bookingStatusFilter"
            class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option
              v-for="option in bookingStatusOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </label>

        <Button
          label="Apply Filter"
          icon="pi pi-filter"
          class="!rounded-xl"
          :loading="loading"
          @click="applyFilters"
        />

        <p class="text-sm text-slate-500 md:text-right">
          Showing {{ pageStart }} - {{ pageEnd }} of {{ total }} order(s)
        </p>
      </div>
    </template>
  </Card>

  <Message v-if="errorMessage" severity="error" class="mt-4">{{ errorMessage }}</Message>

  <div v-if="loading" class="mt-8 flex justify-center">
    <ProgressSpinner style="width: 40px; height: 40px" stroke-width="6" />
  </div>

  <section v-else class="mt-6 grid gap-4">
    <Card
      v-for="order in orders"
      :key="order.id"
      class="!rounded-3xl !border !border-slate-200/90 !bg-white/95"
    >
      <template #content>
        <div class="grid gap-4 lg:grid-cols-[1fr_auto]">
          <div class="space-y-3">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-lg font-semibold text-slate-900">{{ order.serviceTitle }}</h2>
              <Tag :value="order.bookingStatus" :severity="getBookingSeverity(order.bookingStatus)" rounded />
              <Tag :value="order.paymentStatus" :severity="getPaymentSeverity(order.paymentStatus)" rounded />
            </div>

            <div class="grid gap-1 text-sm text-slate-600">
              <p><span class="text-slate-500">Order ID:</span> {{ order.id }}</p>
              <p><span class="text-slate-500">Booking ID:</span> {{ order.bookingId }}</p>
              <p><span class="text-slate-500">City:</span> {{ order.city }}</p>
              <p><span class="text-slate-500">Created:</span> {{ formatDate(order.createdAt) }}</p>
            </div>
          </div>

          <div class="flex min-w-[186px] flex-col justify-between gap-3">
            <p class="text-right text-xl font-semibold text-[#0f5b54]">{{ order.expectedAmount }} USDT</p>

            <div class="grid gap-2">
              <RouterLink
                :to="`/orders/${order.id}`"
                class="inline-flex items-center justify-center rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
              >
                View Detail
              </RouterLink>

              <RouterLink
                :to="`/checkout/${order.bookingId}`"
                class="inline-flex items-center justify-center rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Open Checkout
              </RouterLink>
            </div>
          </div>
        </div>
      </template>
    </Card>

    <div
      v-if="orders.length === 0"
      class="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500"
    >
      No orders matched the current filter.
    </div>

    <div
      v-if="orders.length > 0"
      class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 md:flex-row md:items-center md:justify-between"
    >
      <p class="text-sm text-slate-600">
        Showing {{ pageStart }} - {{ pageEnd }} of {{ total }} order(s)
      </p>
      <div class="flex items-center gap-2">
        <Button
          label="Previous"
          icon="pi pi-angle-left"
          text
          :disabled="!hasPrevPage || loading"
          @click="goPrevPage"
        />
        <Button
          label="Next"
          icon="pi pi-angle-right"
          icon-pos="right"
          text
          :disabled="!hasNextPage || loading"
          @click="goNextPage"
        />
      </div>
    </div>
  </section>
</template>
