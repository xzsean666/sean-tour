<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import Button from "primevue/button";
import Card from "primevue/card";
import InputNumber from "primevue/inputnumber";
import Message from "primevue/message";
import ProgressSpinner from "primevue/progressspinner";
import Tag from "primevue/tag";
import {
  travelService,
  type ServiceDetail,
  type ServiceType,
} from "../api/travelService";
import { useAuthStore } from "../stores/auth.store";

const route = useRoute();
const router = useRouter();
const { user } = useAuthStore();

const loading = ref(false);
const submitting = ref(false);
const errorMessage = ref("");
const service = ref<ServiceDetail | null>(null);
const startDate = ref("");
const endDate = ref("");
const travelerCount = ref(2);
const timeSlot = ref("");

const serviceId = computed(() => String(route.params.id || ""));
const coverImage = computed(() => service.value?.images[0] || "");
const resourceRoster = computed(() => service.value?.resources || []);
const travelerLimit = computed(() => {
  if (!service.value) {
    return 1;
  }

  if (service.value.detail.type === "CAR") {
    return service.value.detail.seats;
  }

  return service.value.capacity?.max || 6;
});

function toIsoDate(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function resolveTypeLabel(type: ServiceType): string {
  if (type === "PACKAGE") {
    return "Package";
  }

  if (type === "GUIDE") {
    return "Guide";
  }

  if (type === "CAR") {
    return "Car";
  }

  return "Assistant";
}

async function loadServiceDetail(): Promise<void> {
  loading.value = true;
  errorMessage.value = "";

  try {
    const detail = await travelService.getServiceDetail(serviceId.value);
    service.value = detail;
    startDate.value = toIsoDate(14);
    endDate.value = toIsoDate(detail.detail.type === "PACKAGE" ? 16 : 14);
    travelerCount.value = Math.min(detail.capacity?.min || 2, travelerLimit.value);
    timeSlot.value = detail.availableTimeSlots[0] || "";
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Failed to load service detail.";
  } finally {
    loading.value = false;
  }
}

async function createBooking(): Promise<void> {
  if (!service.value) {
    return;
  }

  errorMessage.value = "";

  if (!user.value) {
    await router.push({
      path: "/auth/login",
      query: {
        redirect: route.fullPath,
      },
    });
    return;
  }

  submitting.value = true;

  try {
    const { bookingId } = await travelService.createBooking({
      serviceId: service.value.id,
      startDate: startDate.value,
      endDate: endDate.value,
      travelerCount: travelerCount.value,
      ...(timeSlot.value ? { timeSlot: timeSlot.value } : {}),
    });

    await router.push(`/checkout/${bookingId}`);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Failed to create booking.";
  } finally {
    submitting.value = false;
  }
}

watch(
  () => route.fullPath,
  async () => {
    await loadServiceDetail();
  },
  { immediate: true },
);
</script>

<template>
  <Message v-if="errorMessage" severity="error">{{ errorMessage }}</Message>

  <div v-if="loading" class="mt-8 flex justify-center">
    <ProgressSpinner style="width: 44px; height: 44px" stroke-width="6" />
  </div>

  <section v-else-if="service" class="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
    <div class="grid gap-5">
      <section
        class="relative overflow-hidden rounded-3xl border border-[#0c6d64]/20 bg-gradient-to-br from-[#083331] via-[#0f5b54] to-[#123b5d] px-6 py-8 text-white shadow-[0_26px_90px_-55px_rgba(7,41,46,0.95)]"
      >
        <div class="absolute -right-24 -top-28 h-56 w-56 rounded-full bg-[#f8b03c]/25 blur-3xl" />
        <div class="absolute -left-16 -bottom-24 h-52 w-52 rounded-full bg-[#2ad0a1]/20 blur-3xl" />

        <div class="relative flex flex-wrap items-center gap-2">
          <Tag :value="resolveTypeLabel(service.type)" severity="contrast" rounded />
          <Tag :value="`${service.priceAmount} ${service.currency}`" severity="success" rounded />
        </div>

        <h1 class="relative mt-3 text-3xl font-semibold leading-tight">{{ service.title }}</h1>
        <p class="relative mt-3 max-w-3xl text-sm leading-6 text-teal-50/90">
          {{ service.description }}
        </p>
      </section>

      <Card class="!overflow-hidden !rounded-3xl !border !border-slate-200/90 !bg-white/95">
        <template #content>
          <img
            v-if="coverImage"
            :src="coverImage"
            :alt="service.title"
            class="h-72 w-full rounded-2xl object-cover"
            referrerpolicy="no-referrer"
          />

          <div class="mt-5 grid gap-4 lg:grid-cols-2">
            <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm">
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Service Scope</p>
              <p class="mt-3 text-slate-700">
                City: <span class="font-semibold">{{ service.city }}</span>
              </p>
              <p class="mt-2 text-slate-700">
                Languages: <span class="font-semibold">{{ service.languages.join(" / ") }}</span>
              </p>
              <p class="mt-2 text-slate-700">
                Remaining: <span class="font-semibold">{{ service.capacity?.remaining ?? "N/A" }}</span>
              </p>
              <p class="mt-2 text-slate-700">
                Active roster: <span class="font-semibold">{{ resourceRoster.length }}</span>
              </p>
            </div>

            <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm">
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Cancellation Policy
              </p>
              <p class="mt-3 leading-6 text-slate-700">{{ service.cancellationPolicy }}</p>
            </div>
          </div>
        </template>
      </Card>

      <Card class="!rounded-3xl !border !border-slate-200/90 !bg-white/95">
        <template #title>
          <h2 class="text-xl font-semibold text-slate-900">Available Time & Detail</h2>
        </template>
        <template #content>
          <div class="grid gap-4">
            <div v-if="service.availableTimeSlots.length > 0" class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Available Time Slots
              </p>
              <div class="mt-3 flex flex-wrap gap-2">
                <Tag
                  v-for="slot in service.availableTimeSlots"
                  :key="slot"
                  :value="slot"
                  severity="info"
                  rounded
                />
              </div>
              <p v-if="resourceRoster.length > 0" class="mt-3 text-xs text-slate-500">
                First matching active guide / vehicle / assistant resource is auto-assigned after booking.
              </p>
            </div>

            <div
              v-if="resourceRoster.length > 0"
              class="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700"
            >
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Resource Roster
              </p>
              <div class="mt-3 grid gap-3">
                <div
                  v-for="resource in resourceRoster"
                  :key="resource.id"
                  class="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
                >
                  <div class="flex flex-wrap items-center gap-2">
                    <Tag :value="resource.status" :severity="resource.status === 'ACTIVE' ? 'success' : 'warn'" rounded />
                    <span class="font-semibold text-slate-900">{{ resource.label }}</span>
                  </div>
                  <p v-if="resource.languages.length > 0" class="mt-2">
                    Languages: <span class="font-semibold">{{ resource.languages.join(" / ") }}</span>
                  </p>
                  <p v-if="resource.seats" class="mt-2">
                    Seats: <span class="font-semibold">{{ resource.seats }}</span>
                  </p>
                  <p class="mt-2 text-xs text-slate-500">
                    Slots: {{ resource.availableTimeSlots.join(" · ") || "No open slots" }}
                  </p>
                </div>
              </div>
            </div>

            <div
              v-if="service.detail.type === 'PACKAGE'"
              class="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm"
            >
              <p class="font-semibold text-slate-900">
                Duration: {{ service.detail.durationDays }} day(s)
              </p>
              <ul class="mt-3 list-disc space-y-2 pl-5 text-slate-700">
                <li v-for="item in service.detail.itinerary" :key="item">{{ item }}</li>
              </ul>
            </div>

            <div
              v-else-if="service.detail.type === 'GUIDE'"
              class="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700"
            >
              <p>Experience: <span class="font-semibold">{{ service.detail.yearsOfExperience }} years</span></p>
              <p class="mt-2">Languages: <span class="font-semibold">{{ service.detail.languages.join(" / ") }}</span></p>
              <p class="mt-2">
                Certifications:
                <span class="font-semibold">{{ service.detail.certifications.join(" / ") }}</span>
              </p>
            </div>

            <div
              v-else-if="service.detail.type === 'CAR'"
              class="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700"
            >
              <p>Vehicle: <span class="font-semibold">{{ service.detail.carType }}</span></p>
              <p class="mt-2">Seats: <span class="font-semibold">{{ service.detail.seats }}</span></p>
              <p v-if="service.detail.luggageCapacity" class="mt-2">
                Luggage: <span class="font-semibold">{{ service.detail.luggageCapacity }}</span>
              </p>
            </div>

            <div
              v-else
              class="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700"
            >
              <p>Channels: <span class="font-semibold">{{ service.detail.supportChannels.join(" / ") }}</span></p>
              <p class="mt-2">Hours: <span class="font-semibold">{{ service.detail.serviceHours }}</span></p>
            </div>
          </div>
        </template>
      </Card>
    </div>

    <Card class="!rounded-3xl !border !border-slate-200/90 !bg-white/95 xl:sticky xl:top-5 xl:self-start">
      <template #title>
        <h2 class="text-xl font-semibold text-slate-900">Book This Service</h2>
      </template>
      <template #content>
        <div class="grid gap-3">
          <label class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Start Date</span>
            <input v-model="startDate" type="date" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </label>

          <label class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">End Date</span>
            <input v-model="endDate" type="date" class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </label>

          <label class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Travelers</span>
            <InputNumber
              v-model="travelerCount"
              :min="service.capacity?.min || 1"
              :max="travelerLimit"
              input-class="w-full"
              class="w-full"
            />
          </label>

          <label v-if="service.availableTimeSlots.length > 0" class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Time Slot</span>
            <select
              v-model="timeSlot"
              class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option v-for="slot in service.availableTimeSlots" :key="slot" :value="slot">
                {{ slot }}
              </option>
            </select>
          </label>

          <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Support Contact</p>
            <p class="mt-2 font-semibold">
              {{ service.supportContact?.name || "Sean Tour Ops" }}
            </p>
            <p class="mt-1">
              {{ service.supportContact?.channel || "Channel" }}:
              {{ service.supportContact?.value || "TBD after booking" }}
            </p>
          </div>

          <Button
            label="Create Booking"
            icon="pi pi-arrow-right"
            icon-pos="right"
            class="!rounded-xl !bg-slate-900 !py-2.5 !text-white"
            :loading="submitting"
            @click="createBooking"
          />
        </div>
      </template>
    </Card>
  </section>
</template>
