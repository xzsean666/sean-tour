<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import Card from "primevue/card";
import Message from "primevue/message";
import ProgressSpinner from "primevue/progressspinner";
import Tag from "primevue/tag";
import { travelService, type OrderItem } from "../api/travelService";

const route = useRoute();

const loading = ref(false);
const errorMessage = ref("");
const order = ref<OrderItem | null>(null);

const orderId = computed(() => String(route.params.id || ""));

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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
    class="rounded-3xl border border-slate-200 bg-white px-6 py-7 shadow-sm"
  >
    <p class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
      Order Detail
    </p>
    <h1 class="mt-2 text-3xl font-semibold text-slate-900">
      Order {{ orderId }}
    </h1>
  </section>

  <Message v-if="errorMessage" severity="error" class="mt-4">{{
    errorMessage
  }}</Message>

  <div v-if="loading" class="mt-8 flex justify-center">
    <ProgressSpinner style="width: 40px; height: 40px" stroke-width="6" />
  </div>

  <Card v-else-if="order" class="mt-6 !rounded-2xl !border !border-slate-200">
    <template #content>
      <div class="grid gap-3 text-sm">
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="text-xl font-semibold text-slate-900">
            {{ order.serviceTitle }}
          </h2>
          <Tag :value="order.bookingStatus" severity="info" rounded />
          <Tag
            :value="order.paymentStatus"
            :severity="order.paymentStatus === 'PAID' ? 'success' : 'warn'"
            rounded
          />
        </div>
        <p>
          <span class="text-slate-500">Booking ID:</span> {{ order.bookingId }}
        </p>
        <p><span class="text-slate-500">City:</span> {{ order.city }}</p>
        <p>
          <span class="text-slate-500">Expected:</span>
          {{ order.expectedAmount }} USDT
        </p>
        <div class="mt-3 border-t border-slate-200 pt-3">
          <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Payment Events
          </p>
          <div class="mt-2 grid gap-2">
            <div
              v-for="event in order.paymentEvents"
              :key="event.eventId"
              class="rounded-xl border border-slate-200 px-3 py-2 text-xs"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <Tag :value="event.source" severity="contrast" rounded />
                  <Tag
                    :value="event.status"
                    :severity="event.status === 'PAID' ? 'success' : 'warn'"
                    rounded
                  />
                </div>
                <span class="text-slate-500">{{ formatDate(event.createdAt) }}</span>
              </div>
              <p class="mt-1">
                <span class="text-slate-500">Paid:</span> {{ event.paidAmount }} USDT
                · <span class="text-slate-500">Conf:</span> {{ event.confirmations }}
              </p>
              <p v-if="event.txHash" class="mt-1 break-all text-slate-500">
                Tx: {{ event.txHash }}
              </p>
            </div>
            <p v-if="order.paymentEvents.length === 0" class="text-xs text-slate-500">
              No payment callback events yet.
            </p>
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>
