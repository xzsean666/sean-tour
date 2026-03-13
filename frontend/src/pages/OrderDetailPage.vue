<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import Button from "primevue/button";
import Card from "primevue/card";
import Message from "primevue/message";
import ProgressSpinner from "primevue/progressspinner";
import Tag from "primevue/tag";
import {
  travelService,
  type BookingStatus,
  type OrderItem,
  type PaymentEvent,
  type PaymentStatus,
} from "../api/travelService";

const route = useRoute();

const loading = ref(false);
const errorMessage = ref("");
const order = ref<OrderItem | null>(null);

const orderId = computed(() => String(route.params.id || ""));
const paymentEvents = computed(() => order.value?.paymentEvents || []);
const needsCheckout = computed(() => {
  if (!order.value) {
    return false;
  }

  return (
    order.value.paymentStatus === "PENDING" ||
    order.value.paymentStatus === "PARTIALLY_PAID" ||
    order.value.paymentStatus === "UNDERPAID"
  );
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
  if (event.status === "PAID") {
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

  if (event.status === "REFUNDED") {
    return "success";
  }

  return "warn";
}

async function loadOrderDetail() {
  loading.value = true;
  errorMessage.value = "";

  try {
    order.value = await travelService.getOrderDetail(orderId.value);
    if (!order.value) {
      errorMessage.value = `Order ${orderId.value} not found.`;
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Failed to load order detail.";
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await loadOrderDetail();
});
</script>

<template>
  <section
    class="relative overflow-hidden rounded-3xl border border-[#0c6d64]/20 bg-gradient-to-br from-[#093039] via-[#0f4850] to-[#12365f] px-6 py-8 text-white shadow-[0_26px_90px_-55px_rgba(7,41,46,0.95)]"
  >
    <div class="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[#f8b03c]/20 blur-3xl" />
    <div class="absolute -left-16 -bottom-24 h-52 w-52 rounded-full bg-[#2ad0a1]/15 blur-3xl" />

    <p class="relative text-xs font-semibold uppercase tracking-[0.16em] text-teal-100/90">Order Detail</p>
    <h1 class="relative mt-2 text-3xl font-semibold leading-tight">Order {{ orderId }}</h1>
  </section>

  <Message v-if="errorMessage" severity="error" class="mt-4">{{ errorMessage }}</Message>

  <div v-if="loading" class="mt-8 flex justify-center">
    <ProgressSpinner style="width: 40px; height: 40px" stroke-width="6" />
  </div>

  <section v-else-if="order" class="mt-6 grid gap-4 lg:grid-cols-[1.02fr_0.98fr]">
    <Card class="!rounded-3xl !border !border-slate-200/90 !bg-white/95">
      <template #title>
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="text-xl font-semibold text-slate-900">{{ order.serviceTitle }}</h2>
          <Tag :value="order.bookingStatus" :severity="getBookingSeverity(order.bookingStatus)" rounded />
          <Tag :value="order.paymentStatus" :severity="getPaymentSeverity(order.paymentStatus)" rounded />
        </div>
      </template>

      <template #content>
        <div class="grid gap-3 text-sm">
          <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p><span class="text-slate-500">Booking ID:</span> {{ order.bookingId }}</p>
            <p class="mt-1"><span class="text-slate-500">City:</span> {{ order.city }}</p>
            <p class="mt-1"><span class="text-slate-500">Travel:</span> {{ order.startDate }} to {{ order.endDate }}</p>
            <p v-if="order.timeSlot" class="mt-1"><span class="text-slate-500">Time Slot:</span> {{ order.timeSlot }}</p>
            <p v-if="order.assignedResourceLabel" class="mt-1">
              <span class="text-slate-500">Assigned Resource:</span>
              {{ order.assignedResourceLabel }}
            </p>
            <p class="mt-1">
              <span class="text-slate-500">Expected Amount:</span>
              <span class="font-semibold text-[#0f5b54]">{{ order.expectedAmount }} USDT</span>
            </p>
            <p class="mt-1"><span class="text-slate-500">Created:</span> {{ formatDate(order.createdAt) }}</p>
          </div>

          <div class="grid gap-2 sm:grid-cols-2">
            <RouterLink
              v-if="needsCheckout"
              :to="`/checkout/${order.bookingId}`"
              class="inline-flex items-center justify-center rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Open Checkout
            </RouterLink>
            <RouterLink
              :to="`/assistant/requests?bookingId=${order.bookingId}`"
              class="inline-flex items-center justify-center rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
            >
              Request Assistant
            </RouterLink>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Support Contact</p>
            <p class="mt-2 font-semibold">{{ order.supportContact?.name || "Sean Tour Ops" }}</p>
            <p class="mt-1">
              {{ order.supportContact?.channel || "Channel" }}:
              {{ order.supportContact?.value || "Shared after confirmation" }}
            </p>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Voucher</p>
            <p class="mt-2">
              Code:
              <span class="font-mono font-semibold">
                {{ order.serviceVoucherCode || "Available after payment confirmation" }}
              </span>
            </p>
            <p class="mt-2 leading-6">
              {{ order.serviceVoucherInstructions || "Voucher instructions will appear here once the order is active." }}
            </p>
          </div>

          <div
            v-if="order.cancellationPolicy"
            class="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700"
          >
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Cancellation Policy
            </p>
            <p class="mt-2 leading-6">{{ order.cancellationPolicy }}</p>
          </div>
        </div>
      </template>
    </Card>

    <Card class="!rounded-3xl !border !border-slate-200/90 !bg-white/95">
      <template #title>
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-xl font-semibold text-slate-900">Payment Timeline</h2>
          <Button
            icon="pi pi-refresh"
            text
            rounded
            aria-label="Refresh"
            @click="loadOrderDetail"
          />
        </div>
      </template>

      <template #content>
        <div class="grid gap-3">
          <div
            v-for="event in paymentEvents"
            :key="event.eventId"
            class="rounded-2xl border border-slate-200 bg-white px-3 py-3"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <Tag :value="event.source" severity="contrast" rounded />
                <Tag :value="event.status" :severity="getEventSeverity(event)" rounded />
              </div>
              <span class="text-xs text-slate-500">{{ formatDate(event.createdAt) }}</span>
            </div>

            <p class="mt-2 text-xs text-slate-600">
              Event ID: <span class="font-mono">{{ event.eventId }}</span>
            </p>
            <p class="mt-1 text-xs text-slate-600">
              Paid: <span class="font-semibold">{{ event.paidAmount }} USDT</span>
              · Confirmations: <span class="font-semibold">{{ event.confirmations }}</span>
            </p>
            <p v-if="event.txHash" class="mt-1 break-all text-xs text-slate-500">
              Tx: {{ event.txHash }}
            </p>
          </div>

          <p
            v-if="paymentEvents.length === 0"
            class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-6 text-sm text-slate-500"
          >
            No payment callback events yet.
          </p>
        </div>
      </template>
    </Card>
  </section>
</template>
