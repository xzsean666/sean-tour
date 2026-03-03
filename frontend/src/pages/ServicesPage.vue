<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Button from 'primevue/button';
import Card from 'primevue/card';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';
import Tag from 'primevue/tag';
import { travelService, type ServiceItem, type ServiceType } from '../api/travelService';

const typeFilter = ref<'ALL' | ServiceType>('ALL');
const cityFilter = ref('');
const languageFilter = ref('');
const loading = ref(false);
const errorMessage = ref('');
const services = ref<ServiceItem[]>([]);
const total = ref(0);

const hasData = computed(() => services.value.length > 0);

async function loadServices() {
  loading.value = true;
  errorMessage.value = '';

  try {
    const result = await travelService.getServiceList({
      type: typeFilter.value === 'ALL' ? undefined : typeFilter.value,
      city: cityFilter.value,
      language: languageFilter.value,
      limit: 12,
      offset: 0,
    });

    services.value = result.items;
    total.value = result.total;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load services.';
  } finally {
    loading.value = false;
  }
}

function getTypeSeverity(type: ServiceType): 'success' | 'info' | 'warn' | 'contrast' {
  if (type === 'PACKAGE') {
    return 'success';
  }

  if (type === 'GUIDE') {
    return 'info';
  }

  if (type === 'CAR') {
    return 'warn';
  }

  return 'contrast';
}

onMounted(async () => {
  await loadServices();
});
</script>

<template>
  <section class="rounded-3xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-6 py-7 shadow-sm">
    <p class="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Sean Tour Services</p>
    <h1 class="mt-2 text-3xl font-semibold text-slate-900">Crypto-ready China Travel Catalog</h1>
    <p class="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
      Fixed pricing in USDT, BSC/ERC20 checkout flow, and cross-city support for packages, guides,
      chauffeured rides, and remote assistants.
    </p>
  </section>

  <Card class="mt-5 !rounded-3xl !border !border-slate-200/80 !bg-white/95">
    <template #content>
      <div class="grid gap-3 md:grid-cols-4">
        <label class="space-y-1">
          <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Type</span>
          <select
            v-model="typeFilter"
            class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="ALL">All</option>
            <option value="PACKAGE">Package</option>
            <option value="GUIDE">Guide</option>
            <option value="CAR">Car</option>
            <option value="ASSISTANT">Assistant</option>
          </select>
        </label>

        <label class="space-y-1">
          <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">City</span>
          <InputText v-model="cityFilter" placeholder="Beijing / Shanghai" class="w-full" />
        </label>

        <label class="space-y-1">
          <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Language</span>
          <InputText v-model="languageFilter" placeholder="English / Chinese" class="w-full" />
        </label>

        <div class="flex items-end">
          <Button
            label="Apply Filters"
            icon="pi pi-search"
            class="w-full !rounded-xl !py-2.5"
            :loading="loading"
            @click="loadServices"
          />
        </div>
      </div>
    </template>
  </Card>

  <Message v-if="errorMessage" severity="error" class="mt-4">{{ errorMessage }}</Message>

  <div v-if="loading" class="mt-6 flex justify-center">
    <ProgressSpinner style="width: 38px; height: 38px" stroke-width="6" />
  </div>

  <section v-else class="mt-6">
    <div class="mb-4 flex items-center justify-between gap-3">
      <h2 class="text-xl font-semibold text-slate-900">Available Services</h2>
      <p class="text-sm text-slate-500">{{ total }} result(s)</p>
    </div>

    <div v-if="!hasData" class="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
      No services matched the current filters.
    </div>

    <div v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Card
        v-for="service in services"
        :key="service.id"
        class="!rounded-2xl !border !border-slate-200/80 !bg-white"
      >
        <template #title>
          <div class="flex items-start justify-between gap-3">
            <h3 class="text-lg font-semibold text-slate-900">{{ service.title }}</h3>
            <Tag :severity="getTypeSeverity(service.type)" :value="service.type" rounded />
          </div>
        </template>

        <template #subtitle>
          <p class="text-sm text-slate-500">{{ service.city }} · {{ service.languages.join(' / ') }}</p>
        </template>

        <template #content>
          <p class="text-sm leading-6 text-slate-600">{{ service.description }}</p>

          <div class="mt-4 flex items-center justify-between">
            <p class="text-sm text-slate-500">From</p>
            <p class="text-lg font-semibold text-slate-900">{{ service.priceAmount }} {{ service.currency }}</p>
          </div>

          <RouterLink
            :to="`/checkout/bk_demo_${service.id}`"
            class="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Enter Checkout Demo
          </RouterLink>
        </template>
      </Card>
    </div>
  </section>
</template>
