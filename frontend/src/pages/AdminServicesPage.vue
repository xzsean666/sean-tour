<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import Button from "primevue/button";
import Card from "primevue/card";
import InputText from "primevue/inputtext";
import Message from "primevue/message";
import ProgressSpinner from "primevue/progressspinner";
import Tag from "primevue/tag";
import {
  adminCatalogService,
  type AdminServiceDetail,
  type AdminServiceItem,
  type ServiceAuditLog,
  type AdminUpsertServiceInput,
  type ServiceType,
} from "../api/adminCatalogService";

type ServiceForm = {
  id: string;
  type: ServiceType;
  title: string;
  city: string;
  description: string;
  status: string;
  basePriceAmount: string;
  languagesText: string;
  imagesText: string;
  packageDurationDays: string;
  packageItineraryText: string;
  guideLanguagesText: string;
  guideYearsOfExperience: string;
  guideCertificationsText: string;
  carSeats: string;
  carType: string;
  carLuggageCapacity: string;
  assistantSupportChannelsText: string;
  assistantServiceHours: string;
};

function createEmptyForm(): ServiceForm {
  return {
    id: "",
    type: "PACKAGE",
    title: "",
    city: "",
    description: "",
    status: "ACTIVE",
    basePriceAmount: "",
    languagesText: "",
    imagesText: "",
    packageDurationDays: "",
    packageItineraryText: "",
    guideLanguagesText: "",
    guideYearsOfExperience: "",
    guideCertificationsText: "",
    carSeats: "",
    carType: "",
    carLuggageCapacity: "",
    assistantSupportChannelsText: "",
    assistantServiceHours: "",
  };
}

const services = ref<AdminServiceItem[]>([]);
const listLoading = ref(false);
const detailLoading = ref(false);
const saveLoading = ref(false);
const statusLoading = ref(false);
const deleteLoading = ref(false);
const auditLoading = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const selectedServiceId = ref("");
const auditLogs = ref<ServiceAuditLog[]>([]);
const auditTotal = ref(0);
const form = reactive<ServiceForm>(createEmptyForm());

const adminConfigured = computed(() => adminCatalogService.isAdminConfigured());
const selectedService = computed(() =>
  services.value.find((item) => item.id === selectedServiceId.value),
);
const isEditing = computed(() => !!form.id);
const imagePreviewList = computed(() => splitText(form.imagesText));

function splitText(value: string): string[] {
  const items = value
    .split(/[\n,]/g)
    .map((item) => item.trim())
    .filter((item) => !!item);

  return Array.from(new Set(items));
}

function toNumber(value: string, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} must be a valid number.`);
  }

  return parsed;
}

function toInteger(value: string, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${fieldName} must be an integer.`);
  }

  return parsed;
}

function clearDetailFields(): void {
  form.packageDurationDays = "";
  form.packageItineraryText = "";
  form.guideLanguagesText = "";
  form.guideYearsOfExperience = "";
  form.guideCertificationsText = "";
  form.carSeats = "";
  form.carType = "";
  form.carLuggageCapacity = "";
  form.assistantSupportChannelsText = "";
  form.assistantServiceHours = "";
}

function fillDetailFields(detail: AdminServiceDetail): void {
  clearDetailFields();

  if (detail.type === "PACKAGE") {
    form.packageDurationDays = String(detail.durationDays);
    form.packageItineraryText = detail.itinerary.join("\n");
    return;
  }

  if (detail.type === "GUIDE") {
    form.guideLanguagesText = detail.languages.join(", ");
    form.guideYearsOfExperience = String(detail.yearsOfExperience);
    form.guideCertificationsText = detail.certifications.join("\n");
    return;
  }

  if (detail.type === "CAR") {
    form.carSeats = String(detail.seats);
    form.carType = detail.carType;
    form.carLuggageCapacity = detail.luggageCapacity || "";
    return;
  }

  form.assistantSupportChannelsText = detail.supportChannels.join(", ");
  form.assistantServiceHours = detail.serviceHours;
}

function fillBaseFields(service: AdminServiceItem): void {
  form.id = service.id;
  form.type = service.type;
  form.title = service.title;
  form.city = service.city;
  form.description = service.description;
  form.status = service.status || "ACTIVE";
  form.basePriceAmount = String(service.basePriceAmount);
  form.languagesText = service.languages.join(", ");
  form.imagesText = service.images.join("\n");
}

function resetToCreateMode(): void {
  Object.assign(form, createEmptyForm());
  selectedServiceId.value = "";
  auditLogs.value = [];
  auditTotal.value = 0;
  successMessage.value = "";
  errorMessage.value = "";
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function loadServices(): Promise<void> {
  listLoading.value = true;
  errorMessage.value = "";

  try {
    const result = await adminCatalogService.listServices({
      limit: 100,
      offset: 0,
    });

    services.value = result.items;
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Failed to load service list.";
  } finally {
    listLoading.value = false;
  }
}

async function selectService(service: AdminServiceItem): Promise<void> {
  selectedServiceId.value = service.id;
  fillBaseFields(service);
  detailLoading.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const [detail] = await Promise.all([
      adminCatalogService.getServiceDetail(service.id),
      loadAuditLogs(service.id),
    ]);
    fillDetailFields(detail);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Failed to load service detail.";
    clearDetailFields();
  } finally {
    detailLoading.value = false;
  }
}

function buildMutationInput(): AdminUpsertServiceInput {
  const input: AdminUpsertServiceInput = {
    ...(form.id ? { id: form.id } : {}),
    type: form.type,
    title: form.title.trim(),
    city: form.city.trim(),
    description: form.description.trim(),
    status: form.status.trim() || "ACTIVE",
    basePriceAmount: toNumber(form.basePriceAmount, "Base price"),
    languages: splitText(form.languagesText),
    ...(form.imagesText.trim() ? { images: splitText(form.imagesText) } : {}),
  };

  if (input.languages.length === 0) {
    throw new Error("Languages is required.");
  }

  if (form.type === "PACKAGE") {
    input.packageDetail = {
      durationDays: toInteger(form.packageDurationDays, "Package duration days"),
      itinerary: splitText(form.packageItineraryText),
    };
  } else if (form.type === "GUIDE") {
    input.guideDetail = {
      languages: splitText(form.guideLanguagesText),
      yearsOfExperience: toInteger(
        form.guideYearsOfExperience,
        "Guide years of experience",
      ),
      certifications: splitText(form.guideCertificationsText),
    };
  } else if (form.type === "CAR") {
    input.carDetail = {
      seats: toInteger(form.carSeats, "Car seats"),
      carType: form.carType.trim(),
      ...(form.carLuggageCapacity.trim()
        ? { luggageCapacity: form.carLuggageCapacity.trim() }
        : {}),
    };
  } else {
    input.assistantDetail = {
      supportChannels: splitText(form.assistantSupportChannelsText),
      serviceHours: form.assistantServiceHours.trim(),
    };
  }

  return input;
}

async function loadAuditLogs(serviceId: string): Promise<void> {
  if (!adminConfigured.value) {
    auditLogs.value = [];
    auditTotal.value = 0;
    return;
  }

  auditLoading.value = true;

  try {
    const result = await adminCatalogService.listAuditLogs({
      serviceId,
      limit: 20,
      offset: 0,
    });
    auditLogs.value = result.items;
    auditTotal.value = result.total;
  } finally {
    auditLoading.value = false;
  }
}

async function saveService(): Promise<void> {
  saveLoading.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    if (!adminConfigured.value) {
      throw new Error(
        "VITE_BACKEND_ADMIN_AUTH_CODE is not configured in frontend/.env.",
      );
    }

    const input = buildMutationInput();
    const saved = await adminCatalogService.upsertService(input);
    await loadServices();
    successMessage.value = `Service ${saved.id} saved.`;

    const latest =
      services.value.find((item) => item.id === saved.id) || saved;
    await selectService(latest);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Failed to save service.";
  } finally {
    saveLoading.value = false;
  }
}

async function setServiceStatus(status: string): Promise<void> {
  if (!form.id) {
    return;
  }

  statusLoading.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const updated = await adminCatalogService.setServiceStatus({
      id: form.id,
      status,
    });
    await loadServices();
    successMessage.value = `Service ${updated.id} status updated to ${updated.status}.`;

    const latest = services.value.find((item) => item.id === updated.id) || updated;
    await selectService(latest);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Failed to update service status.";
  } finally {
    statusLoading.value = false;
  }
}

async function deleteService(hardDelete: boolean): Promise<void> {
  if (!form.id) {
    return;
  }

  const confirmed = window.confirm(
    hardDelete
      ? "This will permanently delete this service. Continue?"
      : "This will soft-delete the service by setting status to DELETED. Continue?",
  );

  if (!confirmed) {
    return;
  }

  deleteLoading.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    await adminCatalogService.deleteService({
      id: form.id,
      hardDelete,
    });

    await loadServices();

    if (hardDelete) {
      successMessage.value = `Service ${form.id} permanently deleted.`;
      resetToCreateMode();
    } else {
      successMessage.value = `Service ${form.id} soft-deleted.`;
      const latest = services.value.find((item) => item.id === form.id);
      if (latest) {
        await selectService(latest);
      }
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Failed to delete service.";
  } finally {
    deleteLoading.value = false;
  }
}

onMounted(async () => {
  await loadServices();
});
</script>

<template>
  <section
    class="rounded-3xl border border-slate-200 bg-white px-6 py-7 shadow-sm"
  >
    <p class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
      Admin
    </p>
    <h1 class="mt-2 text-3xl font-semibold text-slate-900">
      Service Management
    </h1>
    <p class="mt-2 text-sm text-slate-600">
      Manage catalog services with typed detail editors.
    </p>
  </section>

  <Message v-if="!adminConfigured" severity="warn" class="mt-4">
    Missing <code>VITE_BACKEND_ADMIN_AUTH_CODE</code>. Save action will fail
    until it is configured.
  </Message>
  <Message v-if="errorMessage" severity="error" class="mt-4">{{
    errorMessage
  }}</Message>
  <Message v-if="successMessage" severity="success" class="mt-4">{{
    successMessage
  }}</Message>

  <section class="mt-6 grid gap-4 lg:grid-cols-[360px_1fr]">
    <Card class="!rounded-2xl !border !border-slate-200">
      <template #title>
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-lg font-semibold text-slate-900">Services</h2>
          <Button
            label="Refresh"
            icon="pi pi-refresh"
            text
            :loading="listLoading"
            @click="loadServices"
          />
        </div>
      </template>

      <template #content>
        <div class="mb-3">
          <Button
            label="Create New Service"
            icon="pi pi-plus"
            class="w-full !rounded-xl"
            @click="resetToCreateMode"
          />
        </div>

        <div v-if="listLoading" class="flex justify-center py-8">
          <ProgressSpinner style="width: 34px; height: 34px" stroke-width="6" />
        </div>

        <div v-else class="grid gap-2">
          <button
            v-for="item in services"
            :key="item.id"
            type="button"
            class="rounded-xl border px-3 py-3 text-left transition"
            :class="
              item.id === selectedServiceId
                ? 'border-slate-800 bg-slate-50'
                : 'border-slate-200 hover:border-slate-400'
            "
            @click="selectService(item)"
          >
            <div class="flex items-center justify-between gap-2">
              <p class="font-semibold text-slate-900">{{ item.title }}</p>
              <Tag :value="item.type" rounded />
            </div>
            <p class="mt-1 text-xs text-slate-500">
              {{ item.city }} · {{ item.basePriceAmount }} USDT
            </p>
          </button>

          <p v-if="services.length === 0" class="text-sm text-slate-500">
            No services found.
          </p>
        </div>
      </template>
    </Card>

    <Card class="!rounded-2xl !border !border-slate-200">
      <template #title>
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-lg font-semibold text-slate-900">
            {{ isEditing ? `Edit ${form.id}` : "Create Service" }}
          </h2>
          <Tag
            v-if="selectedService"
            :value="`Updated ${new Date(selectedService.updatedAt).toLocaleDateString()}`"
            severity="info"
            rounded
          />
        </div>
      </template>

      <template #content>
        <div v-if="detailLoading" class="mb-3 flex justify-center">
          <ProgressSpinner style="width: 30px; height: 30px" stroke-width="6" />
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <label class="space-y-1 md:col-span-2">
            <span
              class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
            >
              Type
            </span>
            <select
              v-model="form.type"
              class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="PACKAGE">PACKAGE</option>
              <option value="GUIDE">GUIDE</option>
              <option value="CAR">CAR</option>
              <option value="ASSISTANT">ASSISTANT</option>
            </select>
          </label>

          <label class="space-y-1">
            <span
              class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
            >
              Title
            </span>
            <InputText v-model="form.title" class="w-full" />
          </label>

          <label class="space-y-1">
            <span
              class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
            >
              City
            </span>
            <InputText v-model="form.city" class="w-full" />
          </label>

          <label class="space-y-1">
            <span
              class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
            >
              Status
            </span>
            <InputText v-model="form.status" class="w-full" />
          </label>

          <label class="space-y-1">
            <span
              class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
            >
              Base Price (USDT)
            </span>
            <InputText v-model="form.basePriceAmount" class="w-full" />
          </label>

          <label class="space-y-1 md:col-span-2">
            <span
              class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
            >
              Description
            </span>
            <textarea
              v-model="form.description"
              rows="3"
              class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label class="space-y-1 md:col-span-2">
            <span
              class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
            >
              Languages (comma/newline)
            </span>
            <textarea
              v-model="form.languagesText"
              rows="2"
              class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label class="space-y-1 md:col-span-2">
            <span
              class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
            >
              Images (optional, comma/newline)
            </span>
            <textarea
              v-model="form.imagesText"
              rows="2"
              class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p class="text-xs text-slate-500">
                Parsed images: {{ imagePreviewList.length }}
              </p>
              <div class="mt-1 grid gap-1">
                <a
                  v-for="(imageUrl, idx) in imagePreviewList"
                  :key="`${imageUrl}-${idx}`"
                  :href="imageUrl"
                  target="_blank"
                  rel="noreferrer"
                  class="truncate text-xs text-sky-700 underline"
                >
                  {{ imageUrl }}
                </a>
                <p v-if="imagePreviewList.length === 0" class="text-xs text-slate-400">
                  No images configured.
                </p>
              </div>
            </div>
          </label>
        </div>

        <div class="mt-5 border-t border-slate-200 pt-4">
          <h3 class="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
            Detail Fields
          </h3>

          <div v-if="form.type === 'PACKAGE'" class="mt-3 grid gap-3 md:grid-cols-2">
            <label class="space-y-1">
              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Duration Days
              </span>
              <InputText v-model="form.packageDurationDays" class="w-full" />
            </label>
            <label class="space-y-1 md:col-span-2">
              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Itinerary (comma/newline)
              </span>
              <textarea
                v-model="form.packageItineraryText"
                rows="3"
                class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div v-else-if="form.type === 'GUIDE'" class="mt-3 grid gap-3 md:grid-cols-2">
            <label class="space-y-1 md:col-span-2">
              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Guide Languages (comma/newline)
              </span>
              <textarea
                v-model="form.guideLanguagesText"
                rows="2"
                class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label class="space-y-1">
              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Years of Experience
              </span>
              <InputText v-model="form.guideYearsOfExperience" class="w-full" />
            </label>
            <label class="space-y-1 md:col-span-2">
              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Certifications (comma/newline)
              </span>
              <textarea
                v-model="form.guideCertificationsText"
                rows="3"
                class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div v-else-if="form.type === 'CAR'" class="mt-3 grid gap-3 md:grid-cols-2">
            <label class="space-y-1">
              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Seats
              </span>
              <InputText v-model="form.carSeats" class="w-full" />
            </label>
            <label class="space-y-1">
              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Car Type
              </span>
              <InputText v-model="form.carType" class="w-full" />
            </label>
            <label class="space-y-1 md:col-span-2">
              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Luggage Capacity
              </span>
              <InputText v-model="form.carLuggageCapacity" class="w-full" />
            </label>
          </div>

          <div v-else class="mt-3 grid gap-3 md:grid-cols-2">
            <label class="space-y-1 md:col-span-2">
              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Support Channels (comma/newline)
              </span>
              <textarea
                v-model="form.assistantSupportChannelsText"
                rows="2"
                class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label class="space-y-1 md:col-span-2">
              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Service Hours
              </span>
              <InputText v-model="form.assistantServiceHours" class="w-full" />
            </label>
          </div>
        </div>

        <div class="mt-5 flex flex-wrap items-center gap-2">
          <Button
            label="Save Service"
            icon="pi pi-save"
            class="!rounded-xl"
            :loading="saveLoading"
            @click="saveService"
          />
          <Button
            label="Reset"
            icon="pi pi-undo"
            severity="secondary"
            outlined
            class="!rounded-xl"
            @click="resetToCreateMode"
          />
          <Button
            v-if="isEditing"
            label="Set ACTIVE"
            icon="pi pi-check-circle"
            severity="success"
            outlined
            class="!rounded-xl"
            :loading="statusLoading"
            @click="setServiceStatus('ACTIVE')"
          />
          <Button
            v-if="isEditing"
            label="Set INACTIVE"
            icon="pi pi-pause-circle"
            severity="warn"
            outlined
            class="!rounded-xl"
            :loading="statusLoading"
            @click="setServiceStatus('INACTIVE')"
          />
          <Button
            v-if="isEditing"
            label="Soft Delete"
            icon="pi pi-trash"
            severity="danger"
            outlined
            class="!rounded-xl"
            :loading="deleteLoading"
            @click="deleteService(false)"
          />
          <Button
            v-if="isEditing"
            label="Hard Delete"
            icon="pi pi-times-circle"
            severity="danger"
            class="!rounded-xl"
            :loading="deleteLoading"
            @click="deleteService(true)"
          />
        </div>

        <div v-if="isEditing" class="mt-6 border-t border-slate-200 pt-4">
          <div class="mb-3 flex items-center justify-between gap-2">
            <h3
              class="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500"
            >
              Audit Logs
            </h3>
            <Button
              label="Refresh Logs"
              icon="pi pi-refresh"
              text
              :loading="auditLoading"
              @click="loadAuditLogs(form.id)"
            />
          </div>

          <div v-if="auditLoading" class="flex justify-center py-4">
            <ProgressSpinner style="width: 28px; height: 28px" stroke-width="6" />
          </div>

          <div v-else class="grid gap-2">
            <div
              v-for="log in auditLogs"
              :key="log.id"
              class="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="font-semibold text-slate-900">{{ log.action }}</p>
                <p class="text-xs text-slate-500">{{ formatDate(log.createdAt) }}</p>
              </div>
              <p class="mt-1 text-xs text-slate-500">
                {{ log.beforeStatus || "-" }} -> {{ log.afterStatus || "-" }}
              </p>
              <p v-if="log.note" class="mt-1 text-xs text-slate-600">
                {{ log.note }}
              </p>
            </div>
            <p v-if="auditLogs.length === 0" class="text-sm text-slate-500">
              No audit logs for this service.
            </p>
            <p class="text-xs text-slate-500">Total logs: {{ auditTotal }}</p>
          </div>
        </div>
      </template>
    </Card>
  </section>
</template>
