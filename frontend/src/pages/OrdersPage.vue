<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Card from 'primevue/card';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';
import Tag from 'primevue/tag';
import { travelService, type OrderItem } from '../api/travelService';

const loading = ref(false);
const errorMessage = ref('');
const orders = ref<OrderItem[]>([]);

async function loadOrders() {
  loading.value = true;
  errorMessage.value = '';

  try {
    orders.value = await travelService.getMyOrders();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load orders.';
  } finally {
    loading.value = false;
  }
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

onMounted(async () => {
  await loadOrders();
});
</script>

<template>
  <section class="rounded-3xl border border-slate-200 bg-white px-6 py-7 shadow-sm">
    <p class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Orders</p>
    <h1 class="mt-2 text-3xl font-semibold text-slate-900">My Bookings</h1>
    <p class="mt-2 text-sm text-slate-600">
      Track booking progress, payment status, and jump back to checkout when needed.
    </p>
  </section>

  <Message v-if="errorMessage" severity="error" class="mt-4">{{ errorMessage }}</Message>

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
              <h2 class="text-lg font-semibold text-slate-900">{{ order.serviceTitle }}</h2>
              <Tag :value="order.bookingStatus" severity="info" rounded />
              <Tag :value="order.paymentStatus" :severity="order.paymentStatus === 'PAID' ? 'success' : 'warn'" rounded />
            </div>

            <div class="grid gap-1 text-sm text-slate-600">
              <p><span class="text-slate-500">Order ID:</span> {{ order.id }}</p>
              <p><span class="text-slate-500">Booking ID:</span> {{ order.bookingId }}</p>
              <p><span class="text-slate-500">City:</span> {{ order.city }}</p>
              <p><span class="text-slate-500">Created:</span> {{ formatDate(order.createdAt) }}</p>
            </div>
          </div>

          <div class="flex min-w-[180px] flex-col justify-between gap-3">
            <p class="text-right text-xl font-semibold text-slate-900">{{ order.expectedAmount }} USDT</p>

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

    <div v-if="orders.length === 0" class="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
      No orders yet. Start with a service from the home page.
    </div>
  </section>
</template>
