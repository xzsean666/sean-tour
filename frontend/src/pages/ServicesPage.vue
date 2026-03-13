<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
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

type ServiceTypeFilter = "ALL" | ServiceType;

const PAGE_SIZE = 9;

const router = useRouter();

const typeFilter = ref<ServiceTypeFilter>("ALL");
const cityFilter = ref("");
const languageFilter = ref("");
const dateFilter = ref("");
const minPriceFilter = ref("");
const maxPriceFilter = ref("");

const loading = ref(false);

const errorMessage = ref("");
const services = ref<ServiceItem[]>([]);
const total = ref(0);
const offset = ref(0);
const hasMore = ref(false);

const hasData = computed(() => services.value.length > 0);
const hasPrevPage = computed(() => offset.value > 0);
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

function getTypeAccentClass(type: ServiceType): string {
  if (type === "PACKAGE") {
    return "from-[#197b69] to-[#1e9d85]";
  }

  if (type === "GUIDE") {
    return "from-[#2f7db9] to-[#60a4d8]";
  }

  if (type === "CAR") {
    return "from-[#965f16] to-[#d79a41]";
  }

  return "from-[#5639a8] to-[#8f6bd8]";
}

function getFallbackImage(type: ServiceType): string {
  const palettes: Record<
    ServiceType,
    { from: string; to: string; accent: string; label: string }
  > = {
    PACKAGE: {
      from: "#155f52",
      to: "#2ea38b",
      accent: "#f8b03c",
      label: "China Packages",
    },
    GUIDE: {
      from: "#245d96",
      to: "#5da6da",
      accent: "#f3c36a",
      label: "Local Guides",
    },
    CAR: {
      from: "#88520f",
      to: "#d79a41",
      accent: "#fff0c5",
      label: "Private Car",
    },
    ASSISTANT: {
      from: "#4b3792",
      to: "#8f6bd8",
      accent: "#d7c4ff",
      label: "Remote Assistant",
    },
  };

  const palette = palettes[type];
  const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' width='1200' height='720' viewBox='0 0 1200 720'>
      <defs>
        <linearGradient id='bg' x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0%' stop-color='${palette.from}' />
          <stop offset='100%' stop-color='${palette.to}' />
        </linearGradient>
      </defs>
      <rect width='1200' height='720' fill='url(#bg)' />
      <circle cx='960' cy='140' r='180' fill='${palette.accent}' fill-opacity='0.25' />
      <circle cx='180' cy='640' r='240' fill='${palette.accent}' fill-opacity='0.16' />
      <text x='70' y='610' fill='white' fill-opacity='0.92' font-size='56' font-family='Manrope, sans-serif' font-weight='700'>
        ${palette.label}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getCoverImage(service: ServiceItem): string {
  const firstImage = service.images?.[0]?.trim();
  if (firstImage) {
    return firstImage;
  }

  return getFallbackImage(service.type);
}

async function loadServices(nextOffset: number = offset.value): Promise<void> {
  loading.value = true;
  errorMessage.value = "";

  try {
    const result = await travelService.getServiceList({
      type: typeFilter.value === "ALL" ? undefined : typeFilter.value,
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
  if (!hasPrevPage.value || loading.value) {
    return;
  }

  await loadServices(offset.value - PAGE_SIZE);
}

async function goNextPage(): Promise<void> {
  if (!hasMore.value || loading.value) {
    return;
  }

  await loadServices(offset.value + PAGE_SIZE);
}

async function openServiceDetail(service: ServiceItem): Promise<void> {
  if (service.type === "PACKAGE") {
    await router.push(`/packages/${service.id}`);
    return;
  }

  if (service.type === "GUIDE") {
    await router.push(`/guides/${service.id}`);
    return;
  }

  if (service.type === "CAR") {
    await router.push(`/cars/${service.id}`);
    return;
  }

  await router.push("/assistant");
}

onMounted(async () => {
  await loadServices(0);
});
</script>

<template>
  <section
    class="relative overflow-hidden rounded-3xl border border-[#0c6d64]/20 bg-gradient-to-br from-[#083331] via-[#0f5b54] to-[#0b3038] px-6 py-8 text-white shadow-[0_26px_90px_-55px_rgba(7,41,46,0.95)]"
  >
    <div class="absolute -right-24 -top-28 h-56 w-56 rounded-full bg-[#f8b03c]/25 blur-3xl" />
    <div class="absolute -left-16 -bottom-24 h-52 w-52 rounded-full bg-[#2ad0a1]/20 blur-3xl" />

    <div class="relative flex flex-wrap items-end justify-between gap-4">
      <div class="max-w-3xl">
        <p class="text-xs font-semibold uppercase tracking-[0.16em] text-teal-100/90">
          Sean Tour Marketplace
        </p>
        <h1 class="mt-2 text-3xl font-semibold leading-tight md:text-[2.1rem]">
          Book China experiences like Viator, pay in USDT.
        </h1>
        <p class="mt-3 text-sm leading-6 text-teal-50/90 md:text-[0.95rem]">
          Curated tours, local guides, private transfers, and remote assistant support across major
          cities. Lock your itinerary fast, then complete checkout on BSC/ERC20.
        </p>
      </div>

      <div class="grid min-w-[240px] gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm backdrop-blur-sm">
        <p class="text-teal-50/85">
          Showing <span class="font-semibold text-white">{{ pageStart }} - {{ pageEnd }}</span>
          of <span class="font-semibold text-white">{{ total }}</span>
        </p>
        <p class="text-xs text-teal-100/90">All prices are fixed in USDT.</p>
      </div>
    </div>

    <div class="relative mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <RouterLink
        to="/packages"
        class="rounded-2xl border border-white/20 bg-white/10 px-4 py-4 text-sm text-teal-50 transition hover:bg-white/14"
      >
        <p class="font-semibold text-white">Packages</p>
        <p class="mt-2 text-xs leading-5 text-teal-100/90">Multi-day curated China itineraries.</p>
      </RouterLink>
      <RouterLink
        to="/guides"
        class="rounded-2xl border border-white/20 bg-white/10 px-4 py-4 text-sm text-teal-50 transition hover:bg-white/14"
      >
        <p class="font-semibold text-white">Guides</p>
        <p class="mt-2 text-xs leading-5 text-teal-100/90">Private local experts and interpreters.</p>
      </RouterLink>
      <RouterLink
        to="/cars"
        class="rounded-2xl border border-white/20 bg-white/10 px-4 py-4 text-sm text-teal-50 transition hover:bg-white/14"
      >
        <p class="font-semibold text-white">Cars</p>
        <p class="mt-2 text-xs leading-5 text-teal-100/90">Airport pickup and chauffeur service.</p>
      </RouterLink>
      <RouterLink
        to="/assistant"
        class="rounded-2xl border border-white/20 bg-white/10 px-4 py-4 text-sm text-teal-50 transition hover:bg-white/14"
      >
        <p class="font-semibold text-white">Assistant</p>
        <p class="mt-2 text-xs leading-5 text-teal-100/90">Remote local support and coordination.</p>
      </RouterLink>
    </div>
  </section>

  <Card class="mt-5 !rounded-3xl !border !border-slate-200/80 !bg-white/95">
    <template #content>
      <div class="grid gap-3 lg:grid-cols-[170px_1fr_1fr_220px_180px_180px_auto]">
        <label class="space-y-1">
          <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Type</span>
          <select
            v-model="typeFilter"
            class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="ALL">All Types</option>
            <option value="PACKAGE">Packages</option>
            <option value="GUIDE">Guides</option>
            <option value="CAR">Car Service</option>
            <option value="ASSISTANT">Remote Assistant</option>
          </select>
        </label>

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
              :src="getCoverImage(service)"
              :alt="service.title"
              class="h-full w-full object-cover transition duration-500 hover:scale-105"
              loading="lazy"
              referrerpolicy="no-referrer"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
            <div class="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
              <Tag :value="service.type" :severity="getTypeSeverity(service.type)" rounded />
              <span
                class="rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-800"
                :class="`bg-gradient-to-r ${getTypeAccentClass(service.type)} text-white`"
              >
                {{ service.priceAmount }} {{ service.currency }}
              </span>
            </div>
          </div>

          <h3 class="text-lg font-semibold leading-snug text-slate-900">{{ service.title }}</h3>
          <p class="mt-1 text-sm text-slate-500">{{ service.city }} · {{ service.languages.join(" / ") }}</p>
          <p class="mt-3 min-h-[66px] text-sm leading-6 text-slate-600">
            {{ service.description }}
          </p>

          <Button
            label="View Detail"
            icon="pi pi-arrow-right"
            icon-pos="right"
            class="mt-4 !inline-flex !w-full !justify-center !rounded-xl !bg-slate-900 !px-4 !py-2.5 !text-sm !font-semibold !text-white hover:!bg-slate-800"
            @click="openServiceDetail(service)"
          />
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
