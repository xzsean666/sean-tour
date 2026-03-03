<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';
import Tag from 'primevue/tag';
import { travelService, type CheckoutPreview } from '../api/travelService';

const route = useRoute();

const loading = ref(false);
const errorMessage = ref('');
const copySuccess = ref('');
const checkout = ref<CheckoutPreview | null>(null);

const bookingId = computed(() => String(route.params.bookingId || ''));

async function loadCheckout() {
  loading.value = true;
  errorMessage.value = '';

  try {
    checkout.value = await travelService.getCheckoutPreview(bookingId.value);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load checkout data.';
  } finally {
    loading.value = false;
  }
}

async function copyPayAddress() {
  if (!checkout.value) {
    return;
  }

  await navigator.clipboard.writeText(checkout.value.payAddress);
  copySuccess.value = 'Payment address copied.';
}

onMounted(async () => {
  await loadCheckout();
});
</script>

<template>
  <section class="rounded-3xl border border-slate-200 bg-white px-6 py-7 shadow-sm">
    <p class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Checkout</p>
    <h1 class="mt-2 text-3xl font-semibold text-slate-900">USDT Payment Panel</h1>
    <p class="mt-2 text-sm text-slate-600">
      Booking ID: <span class="font-semibold text-slate-900">{{ bookingId }}</span>
    </p>
  </section>

  <Message v-if="errorMessage" severity="error" class="mt-4">{{ errorMessage }}</Message>
  <Message v-if="copySuccess" severity="success" class="mt-4">{{ copySuccess }}</Message>

  <div v-if="loading" class="mt-8 flex justify-center">
    <ProgressSpinner style="width: 40px; height: 40px" stroke-width="6" />
  </div>

  <div v-else-if="checkout" class="mt-6 grid gap-4 lg:grid-cols-2">
    <Card class="!rounded-2xl !border !border-slate-200">
      <template #title>
        <h2 class="text-xl font-semibold text-slate-900">Booking Summary</h2>
      </template>

      <template #content>
        <dl class="space-y-3 text-sm">
          <div class="flex items-center justify-between gap-3">
            <dt class="text-slate-500">Service</dt>
            <dd class="font-medium text-slate-900">{{ checkout.serviceTitle }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-slate-500">Travelers</dt>
            <dd class="font-medium text-slate-900">{{ checkout.travelerCount }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-slate-500">Date</dt>
            <dd class="font-medium text-slate-900">{{ checkout.travelDateRange }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <dt class="text-slate-500">Expected Amount</dt>
            <dd class="text-lg font-semibold text-slate-900">
              {{ checkout.expectedAmount }} {{ checkout.currency }}
            </dd>
          </div>
        </dl>
      </template>
    </Card>

    <Card class="!rounded-2xl !border !border-slate-200">
      <template #title>
        <h2 class="text-xl font-semibold text-slate-900">USDT (BSC/ERC20)</h2>
      </template>

      <template #content>
        <div class="space-y-4 text-sm">
          <div class="flex items-center justify-between gap-3">
            <p class="text-slate-500">Network</p>
            <p class="font-medium text-slate-900">{{ checkout.network }} / {{ checkout.tokenStandard }}</p>
          </div>

          <div class="flex items-center justify-between gap-3">
            <p class="text-slate-500">Status</p>
            <Tag :value="checkout.paymentStatus" :severity="checkout.paymentStatus === 'PAID' ? 'success' : 'warn'" />
          </div>

          <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p class="text-xs uppercase tracking-[0.12em] text-slate-500">Payment Address</p>
            <p class="mt-1 break-all font-mono text-sm text-slate-800">{{ checkout.payAddress }}</p>
          </div>

          <p class="text-slate-500">This intent expires in {{ checkout.expiresInMinutes }} minutes.</p>

          <Button
            label="Copy Address"
            icon="pi pi-copy"
            class="w-full !rounded-xl"
            @click="copyPayAddress"
          />
        </div>
      </template>
    </Card>
  </div>
</template>
