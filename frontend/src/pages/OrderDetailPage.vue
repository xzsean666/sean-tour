<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import Card from 'primevue/card';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';
import Tag from 'primevue/tag';
import { travelService, type OrderItem } from '../api/travelService';

const route = useRoute();

const loading = ref(false);
const errorMessage = ref('');
const order = ref<OrderItem | null>(null);

const orderId = computed(() => String(route.params.id || ''));

async function loadOrderDetail() {
  loading.value = true;
  errorMessage.value = '';

  try {
    order.value = await travelService.getOrderDetail(orderId.value);
    if (!order.value) {
      errorMessage.value = `Order ${orderId.value} not found.`;
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load order detail.';
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await loadOrderDetail();
});
</script>

<template>
  <section class="rounded-3xl border border-slate-200 bg-white px-6 py-7 shadow-sm">
    <p class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Order Detail</p>
    <h1 class="mt-2 text-3xl font-semibold text-slate-900">Order {{ orderId }}</h1>
  </section>

  <Message v-if="errorMessage" severity="error" class="mt-4">{{ errorMessage }}</Message>

  <div v-if="loading" class="mt-8 flex justify-center">
    <ProgressSpinner style="width: 40px; height: 40px" stroke-width="6" />
  </div>

  <Card v-else-if="order" class="mt-6 !rounded-2xl !border !border-slate-200">
    <template #content>
      <div class="grid gap-3 text-sm">
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="text-xl font-semibold text-slate-900">{{ order.serviceTitle }}</h2>
          <Tag :value="order.bookingStatus" severity="info" rounded />
          <Tag :value="order.paymentStatus" :severity="order.paymentStatus === 'PAID' ? 'success' : 'warn'" rounded />
        </div>
        <p><span class="text-slate-500">Booking ID:</span> {{ order.bookingId }}</p>
        <p><span class="text-slate-500">City:</span> {{ order.city }}</p>
        <p><span class="text-slate-500">Expected:</span> {{ order.expectedAmount }} USDT</p>
      </div>
    </template>
  </Card>
</template>
