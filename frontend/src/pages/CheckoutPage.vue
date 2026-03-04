<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import Button from "primevue/button";
import Card from "primevue/card";
import Message from "primevue/message";
import ProgressSpinner from "primevue/progressspinner";
import Tag from "primevue/tag";
import { travelService, type CheckoutPreview } from "../api/travelService";

const route = useRoute();
const router = useRouter();

const POLL_INTERVAL_MS = 15000;

const loading = ref(false);
const errorMessage = ref("");
const copySuccess = ref("");
const checkout = ref<CheckoutPreview | null>(null);

const bookingId = computed(() => String(route.params.bookingId || ""));
const paymentStatusSeverity = computed(() => {
  if (!checkout.value) {
    return "warn";
  }

  if (checkout.value.paymentStatus === "PAID") {
    return "success";
  }

  if (checkout.value.paymentStatus === "EXPIRED") {
    return "danger";
  }

  return "warn";
});

const statusDescription = computed(() => {
  if (!checkout.value) {
    return "";
  }

  if (checkout.value.paymentStatus === "PAID") {
    return "Payment confirmed. Redirecting to order detail...";
  }

  if (checkout.value.paymentStatus === "EXPIRED") {
    return "Payment intent expired. Please create a fresh payment from checkout.";
  }

  return "Waiting for on-chain transfer and confirmations.";
});

const expiresProgress = computed(() => {
  if (!checkout.value) {
    return 0;
  }

  const normalized = Math.max(Math.min(checkout.value.expiresInMinutes, 120), 0);
  return Math.round((normalized / 120) * 100);
});

let pollTimer: ReturnType<typeof setInterval> | null = null;

function stopPolling() {
  if (!pollTimer) {
    return;
  }

  clearInterval(pollTimer);
  pollTimer = null;
}

function startPolling() {
  if (pollTimer) {
    return;
  }

  pollTimer = setInterval(() => {
    void loadCheckout({ silent: true });
  }, POLL_INTERVAL_MS);
}

async function loadCheckout(options?: { silent?: boolean }) {
  const silent = options?.silent ?? false;

  if (!silent) {
    loading.value = true;
    errorMessage.value = "";
  }

  try {
    const preview = await travelService.getCheckoutPreview(bookingId.value);
    checkout.value = preview;

    if (preview.paymentStatus === "PAID") {
      stopPolling();
      await router.replace(`/orders/${bookingId.value}`);
      return;
    }

    if (preview.paymentStatus === "PENDING") {
      startPolling();
      return;
    }

    stopPolling();
  } catch (error) {
    if (!silent) {
      errorMessage.value =
        error instanceof Error ? error.message : "Failed to load checkout data.";
    }
  } finally {
    if (!silent) {
      loading.value = false;
    }
  }
}

async function copyPayAddress() {
  if (!checkout.value) {
    return;
  }

  try {
    await navigator.clipboard.writeText(checkout.value.payAddress);
    copySuccess.value = "Payment address copied.";
  } catch {
    copySuccess.value = "Copy failed. Please copy the address manually.";
  }
}

onMounted(async () => {
  await loadCheckout();
});

onUnmounted(() => {
  stopPolling();
});
</script>

<template>
  <section
    class="relative overflow-hidden rounded-3xl border border-[#0c6d64]/20 bg-gradient-to-br from-[#092b35] via-[#0f4f57] to-[#113746] px-6 py-8 text-white shadow-[0_26px_90px_-55px_rgba(7,41,46,0.95)]"
  >
    <div class="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[#f8b03c]/20 blur-3xl" />
    <div class="absolute -left-16 -bottom-24 h-52 w-52 rounded-full bg-[#2ad0a1]/15 blur-3xl" />

    <p class="relative text-xs font-semibold uppercase tracking-[0.16em] text-teal-100/90">Checkout</p>
    <h1 class="relative mt-2 text-3xl font-semibold leading-tight">USDT Payment Desk</h1>
    <p class="relative mt-3 text-sm text-teal-50/90">
      Booking: <span class="font-semibold text-white">{{ bookingId }}</span>
    </p>
  </section>

  <Message v-if="errorMessage" severity="error" class="mt-4">{{ errorMessage }}</Message>
  <Message v-if="copySuccess" severity="success" class="mt-4">{{ copySuccess }}</Message>

  <div v-if="loading" class="mt-8 flex justify-center">
    <ProgressSpinner style="width: 40px; height: 40px" stroke-width="6" />
  </div>

  <div v-else-if="checkout" class="mt-6 grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
    <Card class="!rounded-3xl !border !border-slate-200/90 !bg-white/95">
      <template #title>
        <h2 class="text-xl font-semibold text-slate-900">Trip Summary</h2>
      </template>

      <template #content>
        <dl class="space-y-3 text-sm">
          <div class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <dt class="text-slate-500">Service</dt>
            <dd class="text-right font-semibold text-slate-900">{{ checkout.serviceTitle }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <dt class="text-slate-500">Travelers</dt>
            <dd class="font-semibold text-slate-900">{{ checkout.travelerCount }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <dt class="text-slate-500">Date</dt>
            <dd class="font-semibold text-slate-900">{{ checkout.travelDateRange }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <dt class="text-slate-500">Network</dt>
            <dd class="font-semibold text-slate-900">
              {{ checkout.network }} / {{ checkout.tokenStandard }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-3 rounded-xl border border-[#0f5b54]/20 bg-[#effaf7] px-3 py-3">
            <dt class="text-[#0f5b54]">Expected Amount</dt>
            <dd class="text-xl font-semibold text-[#0f5b54]">
              {{ checkout.expectedAmount }} {{ checkout.currency }}
            </dd>
          </div>
        </dl>

        <div class="mt-4 rounded-xl border border-[#0f5b54]/20 bg-[#f2faf8] px-3 py-3">
          <div class="mb-2 flex items-center justify-between gap-2 text-xs">
            <span class="font-semibold uppercase tracking-[0.12em] text-[#0f5b54]">Expiry Window</span>
            <span class="font-semibold text-[#0f5b54]">{{ checkout.expiresInMinutes }} min left</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-[#cae9e2]">
            <div
              class="h-full rounded-full bg-gradient-to-r from-[#0f5b54] to-[#1f8a79]"
              :style="{ width: `${expiresProgress}%` }"
            />
          </div>
        </div>
      </template>
    </Card>

    <Card class="!rounded-3xl !border !border-slate-200/90 !bg-white/95">
      <template #title>
        <h2 class="text-xl font-semibold text-slate-900">Send Payment</h2>
      </template>

      <template #content>
        <div class="space-y-4 text-sm">
          <div class="flex items-center justify-between gap-3">
            <p class="text-slate-500">Status</p>
            <Tag :value="checkout.paymentStatus" :severity="paymentStatusSeverity" rounded />
          </div>

          <p class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {{ statusDescription }}
          </p>

          <div class="rounded-2xl border border-slate-200 bg-white px-3 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Payment Address</p>
            <p class="mt-2 break-all rounded-xl bg-slate-100 px-2 py-2 font-mono text-xs text-slate-800">
              {{ checkout.payAddress }}
            </p>
            <Button
              label="Copy Address"
              icon="pi pi-copy"
              class="mt-3 !w-full !rounded-xl"
              @click="copyPayAddress"
            />
          </div>

          <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
            <p>1. Send exact amount in USDT on BSC/ERC20.</p>
            <p class="mt-1">2. Wait for chain confirmations.</p>
            <p class="mt-1">3. This page auto-refreshes every 15 seconds.</p>
          </div>

          <Button
            label="Refresh Status"
            icon="pi pi-refresh"
            severity="secondary"
            outlined
            class="w-full !rounded-xl"
            :loading="loading"
            @click="loadCheckout()"
          />
        </div>
      </template>
    </Card>
  </div>
</template>
