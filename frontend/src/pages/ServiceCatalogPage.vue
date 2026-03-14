<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import Button from "primevue/button";
import Card from "primevue/card";
import InputText from "primevue/inputtext";
import Message from "primevue/message";
import ProgressSpinner from "primevue/progressspinner";
import Tag from "primevue/tag";
import {
  travelService,
  type ServiceItem,
  type ServiceType,
} from "../api/travelService";

const PAGE_SIZE = 9;
const route = useRoute();

const cityFilter = ref("");
const languageFilter = ref("");
const dateFilter = ref("");
const minPriceFilter = ref("");
const maxPriceFilter = ref("");
const services = ref<ServiceItem[]>([]);
const total = ref(0);
const offset = ref(0);
const hasMore = ref(false);
const loading = ref(false);
const errorMessage = ref("");

const serviceType = computed(() => route.meta.serviceType as ServiceType);
const pageTitle = computed(() => {
  return String(route.meta.pageTitle || "Service Catalog");
});
const hasPrevPage = computed(() => offset.value > 0);
const hasData = computed(() => services.value.length > 0);
const pageStart = computed(() => (services.value.length > 0 ? offset.value + 1 : 0));
const pageEnd = computed(() => offset.value + services.value.length);

function normalizePriceFilter(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Price filter must be a non-negative number.");
  }

  return parsed;
}

function getDetailPath(service: ServiceItem): string {
  if (service.type === "PACKAGE") {
    return `/packages/${service.id}`;
  }

  if (service.type === "GUIDE") {
    return `/guides/${service.id}`;
  }

  if (service.type === "CAR") {
    return `/cars/${service.id}`;
  }

  return "/assistant";
}

function getTypeSeverity(
  type: ServiceType,
): "success" | "info" | "warn" | "contrast" {
  if (type === "PACKAGE") {
    return "success";
  }

  if (type === "GUIDE") {
    return "info";
  }

  if (type === "CAR") {
    return "warn";
  }

  return "contrast";
}

function getFallbackImage(type: ServiceType): string {
  const label =
    type === "PACKAGE"
      ? "Travel Package"
      : type === "GUIDE"
        ? "Local Guide"
        : type === "CAR"
          ? "Private Car"
          : "Assistant";

  const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' width='1200' height='720' viewBox='0 0 1200 720'>
      <defs>
        <linearGradient id='bg' x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0%' stop-color='#0c5f53' />
          <stop offset='100%' stop-color='#1c7ea2' />
        </linearGradient>
      </defs>
      <rect width='1200' height='720' fill='url(#bg)' />
      <circle cx='940' cy='140' r='180' fill='#f8b03c' fill-opacity='0.28' />
      <text x='72' y='620' fill='white' fill-opacity='0.92' font-size='58' font-family='Manrope, sans-serif' font-weight='700'>
        ${label}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

async function loadServices(nextOffset: number = offset.value): Promise<void> {
  loading.value = true;
  errorMessage.value = "";

  try {
    const result = await travelService.getServiceList({
      type: serviceType.value,
      city: cityFilter.value,
      language: languageFilter.value,
      date: dateFilter.value,
      minPriceAmount: normalizePriceFilter(minPriceFilter.value),
      maxPriceAmount: normalizePriceFilter(maxPriceFilter.value),
      status: "ACTIVE",
      limit: PAGE_SIZE,
      offset: Math.max(nextOffset, 0),
    });

    services.value = result.items;
    total.value = result.total;
    offset.value = result.offset;
    hasMore.value = result.hasMore;
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Failed to load services.";
  } finally {
    loading.value = false;
  }
}

async function applyFilters(): Promise<void> {
  await loadServices(0);
}

async function goPrevPage(): Promise<void> {
  if (loading.value || !hasPrevPage.value) {
    return;
  }

  await loadServices(offset.value - PAGE_SIZE);
}

async function goNextPage(): Promise<void> {
  if (loading.value || !hasMore.value) {
    return;
  }

  await loadServices(offset.value + PAGE_SIZE);
}

watch(
  () => route.fullPath,
  async () => {
    await loadServices(0);
  },
  { immediate: true },
);
</script>

<template>
  <section
    class="relative overflow-hidden rounded-3xl border border-[#0c6d64]/20 bg-gradient-to-br from-[#083331] via-[#0f5b54] to-[#123b5d] px-6 py-8 text-white shadow-[0_26px_90px_-55px_rgba(7,41,46,0.95)]"
  >
    <div class="absolute -right-24 -top-28 h-56 w-56 rounded-full bg-[#f8b03c]/25 blur-3xl" />
    <div class="absolute -left-16 -bottom-24 h-52 w-52 rounded-full bg-[#2ad0a1]/20 blur-3xl" />

    <p class="relative text-xs font-semibold uppercase tracking-[0.16em] text-teal-100/90">
      Service Catalog
    </p>
    <h1 class="relative mt-2 text-3xl font-semibold leading-tight">{{ pageTitle }}</h1>
    <p class="relative mt-3 max-w-3xl text-sm leading-6 text-teal-50/90">
      Browse verified inventory, compare languages and cities, then open the detail page to choose
      dates, time slots, and traveler count before checkout.
    </p>
  </section>

  <Card class="mt-5 !rounded-3xl !border !border-slate-200/80 !bg-white/95">
    <template #content>
      <div class="grid gap-3 lg:grid-cols-[1fr_1fr_220px_180px_180px_auto]">
        <label class="space-y-1">
          <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">City</span>
          <InputText v-model="cityFilter" placeholder="Beijing / Shanghai" class="w-full" />
        </label>

        <label class="space-y-1">
          <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Language
          </span>
          <InputText v-model="languageFilter" placeholder="English / Chinese" class="w-full" />
        </label>

        <label class="space-y-1">
          <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Date</span>
          <input
            v-model="dateFilter"
            type="date"
            class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          />
        </label>

        <label class="space-y-1">
          <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Min USDT</span>
          <input
            v-model="minPriceFilter"
            type="number"
            min="0"
            step="1"
            class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            placeholder="0"
          />
        </label>

        <label class="space-y-1">
          <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Max USDT</span>
          <input
            v-model="maxPriceFilter"
            type="number"
            min="0"
            step="1"
            class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            placeholder="500"
          />
        </label>

        <div class="flex items-end">
          <Button
            label="Apply"
            icon="pi pi-search"
            class="w-full !rounded-xl !py-2.5"
            :loading="loading"
            @click="applyFilters"
          />
        </div>
      </div>
    </template>
  </Card>

  <Message v-if="errorMessage" severity="error" class="mt-4">{{ errorMessage }}</Message>

  <div v-if="loading" class="mt-8 flex justify-center">
    <ProgressSpinner style="width: 40px; height: 40px" stroke-width="6" />
  </div>

  <section v-else class="mt-6">
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Card
        v-for="service in services"
        :key="service.id"
        class="!overflow-hidden !rounded-3xl !border !border-slate-200/85 !bg-white"
      >
        <template #content>
          <div class="relative -mx-[1.125rem] -mt-[1rem] mb-4 h-44 overflow-hidden">
            <img
              :src="service.images[0] || getFallbackImage(service.type)"
              :alt="service.title"
              class="h-full w-full object-cover"
              loading="lazy"
              referrerpolicy="no-referrer"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
            <div class="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
              <Tag :value="service.type" :severity="getTypeSeverity(service.type)" rounded />
              <span class="rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-800">
                {{ service.priceAmount }} {{ service.currency }}
              </span>
            </div>
          </div>

          <h3 class="text-lg font-semibold leading-snug text-slate-900">{{ service.title }}</h3>
          <p class="mt-1 text-sm text-slate-500">{{ service.city }} · {{ service.languages.join(" / ") }}</p>
          <p class="mt-3 min-h-[66px] text-sm leading-6 text-slate-600">
            {{ service.description }}
          </p>

          <div class="mt-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span>Remaining: {{ service.capacity?.remaining ?? "N/A" }}</span>
            <span v-if="service.availableTimeSlots.length > 0">
              Slots: {{ service.availableTimeSlots.length }}
            </span>
          </div>

          <RouterLink
            :to="getDetailPath(service)"
            class="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            View Detail
          </RouterLink>
        </template>
      </Card>
    </div>

    <div
      v-if="!hasData"
      class="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500"
    >
      No services matched the current filters.
    </div>

    <div
      v-if="hasData"
      class="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 md:flex-row md:items-center md:justify-between"
    >
      <p class="text-sm text-slate-600">
        Showing {{ pageStart }} - {{ pageEnd }} of {{ total }} service(s)
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
          :disabled="!hasMore || loading"
          @click="goNextPage"
        />
      </div>
    </div>
  </section>
</template>
