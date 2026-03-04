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
const pageStart = computed(() =>
  orders.value.length === 0 ? 0 : offset.value + 1,
);
const pageEnd = computed(() => offset.value + orders.value.length);

async function loadOrders(nextOffset: number = offset.value) {
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

async function applyFilters() {
  await loadOrders(0);
}

async function goPrevPage() {
  if (!hasPrevPage.value || loading.value) {
    return;
  }

  await loadOrders(offset.value - PAGE_SIZE);
}

async function goNextPage() {
  if (!hasNextPage.value || loading.value) {
    return;
  }

  await loadOrders(offset.value + PAGE_SIZE);
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

onMounted(async () => {
  await loadOrders(0);
});
</script>

<template>
  <section
    class="rounded-3xl border border-slate-200 bg-white px-6 py-7 shadow-sm"
  >
    <p class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
      Orders
    </p>
    <h1 class="mt-2 text-3xl font-semibold text-slate-900">My Bookings</h1>
    <p class="mt-2 text-sm text-slate-600">
      Track booking progress, payment status, and jump back to checkout when
      needed.
    </p>
  </section>

  <Card class="mt-4 !rounded-2xl !border !border-slate-200">
    <template #content>
      <div class="grid gap-3 md:grid-cols-[220px_auto]">
        <label class="space-y-1">
          <span
            class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
          >
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

        <div class="flex items-end justify-start">
          <Button
            label="Apply Filter"
            icon="pi pi-filter"
            class="!rounded-xl"
            :loading="loading"
            @click="applyFilters"
          />
        </div>
      </div>
    </template>
  </Card>

  <Message v-if="errorMessage" severity="error" class="mt-4">{{
    errorMessage
  }}</Message>

  <div v-if="loading" class="mt-8 flex justify-center">
    <ProgressSpinner style="width: 40px; height: 40px" stroke-width="6" />
  </div>

  <section v-else class="mt-6 grid gap-4">
    <Card
      v-for="order in orders"
      :key="order.id"
      class="!rounded-2xl !border !border-slate-200"
    >
      <template #content>
        <div class="grid gap-4 lg:grid-cols-[1fr_auto]">
          <div class="space-y-3">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-lg font-semibold text-slate-900">
                {{ order.serviceTitle }}
              </h2>
              <Tag :value="order.bookingStatus" severity="info" rounded />
              <Tag
                :value="order.paymentStatus"
                :severity="order.paymentStatus === 'PAID' ? 'success' : 'warn'"
                rounded
              />
            </div>

            <div class="grid gap-1 text-sm text-slate-600">
              <p>
                <span class="text-slate-500">Order ID:</span> {{ order.id }}
              </p>
              <p>
                <span class="text-slate-500">Booking ID:</span>
                {{ order.bookingId }}
              </p>
              <p><span class="text-slate-500">City:</span> {{ order.city }}</p>
              <p>
                <span class="text-slate-500">Created:</span>
                {{ formatDate(order.createdAt) }}
              </p>
            </div>
          </div>

          <div class="flex min-w-[180px] flex-col justify-between gap-3">
            <p class="text-right text-xl font-semibold text-slate-900">
              {{ order.expectedAmount }} USDT
            </p>

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
