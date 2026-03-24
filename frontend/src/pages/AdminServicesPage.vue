<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import Button from "primevue/button";
import Card from "primevue/card";
import InputText from "primevue/inputtext";
import Message from "primevue/message";
import ProgressSpinner from "primevue/progressspinner";
import Tag from "primevue/tag";
import { adminOrderService } from "../api/adminOrderService";
import {
  adminCatalogService,
  type AdminServiceResourceSchedule,
  type AdminServiceResourceScheduleBooking,
  type AdminServiceDetail,
  type AdminServiceItem,
  type AdminUpsertServiceInput,
  type ServiceAuditLog,
  type ServiceType,
} from "../api/adminCatalogService";
import type { ServiceResource } from "../api/travelService";
import { useAuthStore } from "../stores/auth.store";

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
  cancellationPolicy: string;
  availableTimeSlotsText: string;
  capacityMin: string;
  capacityMax: string;
  capacityRemaining: string;
  supportContactName: string;
  supportContactChannel: string;
  supportContactValue: string;
  resourcesJson: string;
  voucherTemplate: string;
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

type ScheduleAttentionItem = {
  booking: AdminServiceResourceScheduleBooking;
  issue: "CONFLICT" | "UNASSIGNED";
  resourceId?: string;
  resourceLabel?: string;
};

type ScheduleSlotBoardBooking = {
  booking: AdminServiceResourceScheduleBooking;
  issue?: "CONFLICT" | "UNASSIGNED";
  resourceLabel?: string;
};

type ScheduleSlotBoardItem = {
  timeSlot: string;
  totalBookings: number;
  assignedCount: number;
  unassignedCount: number;
  conflictCount: number;
  resourceLabels: string[];
  bookings: ScheduleSlotBoardBooking[];
};

type ScheduleDateBoardItem = {
  date: string;
  slotCount: number;
  bookingCount: number;
  conflictCount: number;
  unassignedCount: number;
};

type ServiceSelectionOptions = {
  syncRoute?: boolean;
};

const ADMIN_SERVICES_ROUTE_QUERY_KEYS = ["serviceId", "scheduleDate"] as const;

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
    cancellationPolicy: "",
    availableTimeSlotsText: "",
    capacityMin: "",
    capacityMax: "",
    capacityRemaining: "",
    supportContactName: "",
    supportContactChannel: "",
    supportContactValue: "",
    resourcesJson: "[]",
    voucherTemplate: "",
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
const resourceScheduleLoading = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const selectedServiceId = ref("");
const resourceScheduleDate = ref("");
const resourceScheduleDraftDate = ref("");
const auditLogs = ref<ServiceAuditLog[]>([]);
const auditTotal = ref(0);
const resourceSchedule = ref<AdminServiceResourceSchedule | null>(null);
const bookingAssignmentOptions = ref<Record<string, ServiceResource[]>>({});
const bookingAssignmentLoading = ref<Record<string, boolean>>({});
const bookingAssignmentActionLoading = ref<Record<string, boolean>>({});
const form = reactive<ServiceForm>(createEmptyForm());
const bookingAssignmentSelections = reactive<Record<string, string>>({});
const route = useRoute();
const router = useRouter();
const skipNextRouteWatch = ref(false);
const { backendUser } = useAuthStore();

const hasAdminAccess = computed(() => !!backendUser.value?.isAdmin);
const selectedService = computed(() =>
  services.value.find((item) => item.id === selectedServiceId.value),
);
const isEditing = computed(() => !!form.id);
const imagePreviewList = computed(() => splitText(form.imagesText));
const timeSlotPreviewList = computed(() => splitText(form.availableTimeSlotsText));
const resourceScheduleConflictCount = computed(() => {
  return (
    resourceSchedule.value?.resources.reduce((total, item) => {
      return total + item.conflictTimeSlots.length;
    }, 0) || 0
  );
});
const resourceScheduleBookingCount = computed(() => {
  return (
    resourceSchedule.value?.resources.reduce((total, item) => {
      return total + item.bookings.length;
    }, 0) || 0
  );
});
const scheduleAttentionItems = computed<ScheduleAttentionItem[]>(() => {
  if (!resourceSchedule.value) {
    return [];
  }

  const items: ScheduleAttentionItem[] = [];
  const seen = new Set<string>();

  for (const resource of resourceSchedule.value.resources) {
    for (const booking of resource.bookings) {
      if (
        !booking.timeSlot ||
        !resource.conflictTimeSlots.includes(booking.timeSlot)
      ) {
        continue;
      }

      const key = `conflict:${booking.bookingId}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      items.push({
        booking,
        issue: "CONFLICT",
        resourceId: resource.resourceId,
        resourceLabel: resource.resourceLabel,
      });
    }
  }

  for (const booking of resourceSchedule.value.unassignedBookings) {
    const key = `unassigned:${booking.bookingId}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    items.push({
      booking,
      issue: "UNASSIGNED",
    });
  }

  return items;
});
const scheduleSlotBoardItems = computed<ScheduleSlotBoardItem[]>(() => {
  if (!resourceSchedule.value) {
    return [];
  }

  const slotMap = new Map<
    string,
    Omit<ScheduleSlotBoardItem, "resourceLabels"> & { resourceLabels: Set<string> }
  >();

  function ensureSlot(timeSlot: string) {
    let item = slotMap.get(timeSlot);

    if (!item) {
      item = {
        timeSlot,
        totalBookings: 0,
        assignedCount: 0,
        unassignedCount: 0,
        conflictCount: 0,
        resourceLabels: new Set<string>(),
        bookings: [],
      };
      slotMap.set(timeSlot, item);
    }

    return item;
  }

  for (const resource of resourceSchedule.value.resources) {
    const conflictSlots = new Set(resource.conflictTimeSlots);

    for (const booking of resource.bookings) {
      if (!booking.timeSlot) {
        continue;
      }

      const slotItem = ensureSlot(booking.timeSlot);
      const issue = conflictSlots.has(booking.timeSlot) ? "CONFLICT" : undefined;

      slotItem.totalBookings += 1;
      slotItem.assignedCount += 1;
      slotItem.resourceLabels.add(resource.resourceLabel);
      if (issue === "CONFLICT") {
        slotItem.conflictCount += 1;
      }
      slotItem.bookings.push({
        booking,
        issue,
        resourceLabel: resource.resourceLabel,
      });
    }
  }

  for (const booking of resourceSchedule.value.unassignedBookings) {
    if (!booking.timeSlot) {
      continue;
    }

    const slotItem = ensureSlot(booking.timeSlot);
    slotItem.totalBookings += 1;
    slotItem.unassignedCount += 1;
    slotItem.bookings.push({
      booking,
      issue: "UNASSIGNED",
    });
  }

  return Array.from(slotMap.values())
    .map((item) => ({
      ...item,
      resourceLabels: Array.from(item.resourceLabels),
    }))
    .sort((left, right) => left.timeSlot.localeCompare(right.timeSlot));
});
const scheduleDateBoardItems = computed<ScheduleDateBoardItem[]>(() => {
  const dateMap = new Map<string, ScheduleDateBoardItem>();

  for (const slot of scheduleSlotBoardItems.value) {
    const date = slot.timeSlot.slice(0, 10);
    const current = dateMap.get(date) || {
      date,
      slotCount: 0,
      bookingCount: 0,
      conflictCount: 0,
      unassignedCount: 0,
    };

    current.slotCount += 1;
    current.bookingCount += slot.totalBookings;
    current.conflictCount += slot.conflictCount;
    current.unassignedCount += slot.unassignedCount;
    dateMap.set(date, current);
  }

  return Array.from(dateMap.values()).sort((left, right) =>
    left.date.localeCompare(right.date),
  );
});

function getScheduleAttentionSeverity(
  issue: ScheduleAttentionItem["issue"],
): "danger" | "warn" {
  return issue === "CONFLICT" ? "danger" : "warn";
}

function getScheduleAttentionLabel(
  issue: ScheduleAttentionItem["issue"],
): string {
  return issue === "CONFLICT" ? "Conflict" : "Unassigned";
}

function splitText(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/g)
        .map((item) => item.trim())
        .filter((item) => !!item),
    ),
  );
}

function normalizeOptionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function readRouteQueryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return readRouteQueryValue(value[0]);
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function parseRouteScheduleDate(value: unknown): string {
  const normalized = readRouteQueryValue(value);
  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return "";
  }

  return normalized;
}

function buildRouteQuery(): Record<string, string> {
  const query: Record<string, string> = {};

  if (selectedServiceId.value) {
    query.serviceId = selectedServiceId.value;
  }

  if (resourceScheduleDate.value) {
    query.scheduleDate = resourceScheduleDate.value;
  }

  return query;
}

function getCurrentRouteQuery(): Record<string, string> {
  const current: Record<string, string> = {};

  ADMIN_SERVICES_ROUTE_QUERY_KEYS.forEach((key) => {
    const value = readRouteQueryValue(route.query[key]);
    if (value) {
      current[key] = value;
    }
  });

  return current;
}

function isSameRouteQuery(
  left: Record<string, string>,
  right: Record<string, string>,
): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every(
    (key, index) => key === rightKeys[index] && left[key] === right[key],
  );
}

async function syncRouteQuery(): Promise<void> {
  const nextQuery = buildRouteQuery();
  if (isSameRouteQuery(nextQuery, getCurrentRouteQuery())) {
    return;
  }

  skipNextRouteWatch.value = true;
  await router.replace({
    query: nextQuery,
  });
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
  form.cancellationPolicy = service.cancellationPolicy || "";
  form.availableTimeSlotsText = service.availableTimeSlots.join("\n");
  form.capacityMin =
    service.capacity?.min !== undefined ? String(service.capacity.min) : "";
  form.capacityMax =
    service.capacity?.max !== undefined ? String(service.capacity.max) : "";
  form.capacityRemaining =
    service.capacity?.remaining !== undefined
      ? String(service.capacity.remaining)
      : "";
  form.supportContactName = service.supportContact?.name || "";
  form.supportContactChannel = service.supportContact?.channel || "";
  form.supportContactValue = service.supportContact?.value || "";
  form.resourcesJson = JSON.stringify(service.resources || [], null, 2);
  form.voucherTemplate = service.voucherTemplate || "";
}

async function resetToCreateMode(
  options: ServiceSelectionOptions = {},
): Promise<void> {
  Object.assign(form, createEmptyForm());
  selectedServiceId.value = "";
  resourceScheduleDate.value = "";
  resourceScheduleDraftDate.value = "";
  auditLogs.value = [];
  auditTotal.value = 0;
  resourceSchedule.value = null;
  bookingAssignmentOptions.value = {};
  bookingAssignmentLoading.value = {};
  bookingAssignmentActionLoading.value = {};
  for (const key of Object.keys(bookingAssignmentSelections)) {
    delete bookingAssignmentSelections[key];
  }
  successMessage.value = "";
  errorMessage.value = "";

  if (options.syncRoute !== false) {
    await syncRouteQuery();
  }
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

function buildCapacityInput():
  | {
      min: number;
      max: number;
      remaining: number;
    }
  | undefined {
  const values = [form.capacityMin, form.capacityMax, form.capacityRemaining].map(
    (value) => value.trim(),
  );

  if (values.every((value) => !value)) {
    return undefined;
  }

  if (values.some((value) => !value)) {
    throw new Error("Capacity min/max/remaining must be filled together.");
  }

  const capacity = {
    min: toInteger(form.capacityMin, "Capacity min"),
    max: toInteger(form.capacityMax, "Capacity max"),
    remaining: toInteger(form.capacityRemaining, "Capacity remaining"),
  };

  if (capacity.min < 1) {
    throw new Error("Capacity min must be at least 1.");
  }

  if (capacity.max < capacity.min) {
    throw new Error("Capacity max must be greater than or equal to min.");
  }

  if (capacity.remaining < 0 || capacity.remaining > capacity.max) {
    throw new Error("Capacity remaining must be between 0 and max.");
  }

  return capacity;
}

function buildSupportContact():
  | {
      name: string;
      channel: string;
      value: string;
    }
  | undefined {
  const name = normalizeOptionalText(form.supportContactName);
  const channel = normalizeOptionalText(form.supportContactChannel);
  const value = normalizeOptionalText(form.supportContactValue);

  if (!name && !channel && !value) {
    return undefined;
  }

  if (!name || !channel || !value) {
    throw new Error("Support contact name/channel/value must be filled together.");
  }

  return {
    name,
    channel,
    value,
  };
}

function parseResourcesJson(): AdminUpsertServiceInput["resources"] {
  const normalized = form.resourcesJson.trim();

  if (!normalized) {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(normalized);
  } catch {
    throw new Error("Resource roster must be valid JSON.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Resource roster must be a JSON array.");
  }

  return parsed as AdminUpsertServiceInput["resources"];
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

async function refreshServices(): Promise<void> {
  await loadServices();
  await applyRouteSelection();
}

async function loadAuditLogs(serviceId: string): Promise<void> {
  if (!hasAdminAccess.value) {
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

async function loadResourceSchedule(serviceId: string): Promise<void> {
  if (!hasAdminAccess.value) {
    resourceSchedule.value = null;
    return;
  }

  resourceScheduleLoading.value = true;

  try {
    resourceSchedule.value =
      await adminCatalogService.getServiceResourceSchedule(
        serviceId,
        resourceScheduleDate.value.trim() || undefined,
      );
    bookingAssignmentOptions.value = {};
    bookingAssignmentLoading.value = {};
    bookingAssignmentActionLoading.value = {};
    for (const key of Object.keys(bookingAssignmentSelections)) {
      delete bookingAssignmentSelections[key];
    }
  } catch (error) {
    resourceSchedule.value = null;
    errorMessage.value =
      error instanceof Error ? error.message : "Failed to load resource schedule.";
  } finally {
    resourceScheduleLoading.value = false;
  }
}

async function clearResourceScheduleFilter(): Promise<void> {
  resourceScheduleDraftDate.value = "";
  resourceScheduleDate.value = "";

  if (form.id) {
    await loadResourceSchedule(form.id);
  }

  await syncRouteQuery();
}

async function applyResourceScheduleDate(date: string): Promise<void> {
  resourceScheduleDraftDate.value = date;
  resourceScheduleDate.value = date;

  if (form.id) {
    await loadResourceSchedule(form.id);
  }

  await syncRouteQuery();
}

function getBookingAssignmentOptions(bookingId: string): ServiceResource[] {
  return bookingAssignmentOptions.value[bookingId] || [];
}

function isBookingAssignmentBusy(bookingId: string): boolean {
  return !!bookingAssignmentLoading.value[bookingId] || !!bookingAssignmentActionLoading.value[bookingId];
}

function buildBookingAssignmentOptionLabel(
  resource: ServiceResource,
  currentResourceId?: string,
): string {
  const currentSuffix = resource.id === currentResourceId ? " (Current)" : "";
  const seatsSuffix = resource.seats ? ` · ${resource.seats} seats` : "";
  return `${resource.label}${currentSuffix}${seatsSuffix}`;
}

function getBookingAssignmentLoadLabel(currentResourceId?: string): string {
  return currentResourceId ? "Load Reassign Options" : "Load Assign Options";
}

function getBookingAssignmentSubmitLabel(currentResourceId?: string): string {
  return currentResourceId ? "Reassign" : "Assign";
}

function isBookingAssignmentSubmitDisabled(
  bookingId: string,
  currentResourceId?: string,
): boolean {
  const selectedResourceId = bookingAssignmentSelections[bookingId];
  return (
    isBookingAssignmentBusy(bookingId) ||
    !selectedResourceId ||
    selectedResourceId === currentResourceId
  );
}

async function prepareBookingAssignment(
  bookingId: string,
  currentResourceId?: string,
): Promise<void> {
  if (isBookingAssignmentBusy(bookingId)) {
    return;
  }

  bookingAssignmentLoading.value = {
    ...bookingAssignmentLoading.value,
    [bookingId]: true,
  };
  errorMessage.value = "";

  try {
    const options = await adminOrderService.listAssignableBookingResources(
      bookingId,
    );
    bookingAssignmentOptions.value = {
      ...bookingAssignmentOptions.value,
      [bookingId]: options,
    };

    if (
      !bookingAssignmentSelections[bookingId] ||
      !options.some((option) => option.id === bookingAssignmentSelections[bookingId])
    ) {
      bookingAssignmentSelections[bookingId] =
        currentResourceId && options.some((option) => option.id === currentResourceId)
          ? currentResourceId
          : options[0]?.id || "";
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Failed to load assignable resources.";
  } finally {
    bookingAssignmentLoading.value = {
      ...bookingAssignmentLoading.value,
      [bookingId]: false,
    };
  }
}

async function submitBookingAssignment(
  bookingId: string,
  currentResourceId?: string,
): Promise<void> {
  const resourceId = bookingAssignmentSelections[bookingId];
  if (!resourceId || resourceId === currentResourceId || !form.id) {
    return;
  }

  bookingAssignmentActionLoading.value = {
    ...bookingAssignmentActionLoading.value,
    [bookingId]: true,
  };
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const updated = await adminOrderService.reassignBookingResource({
      bookingId,
      resourceId,
    });

    successMessage.value = updated.assignedResource
      ? `Booking ${updated.id} reassigned to ${updated.assignedResource.label}.`
      : `Booking ${updated.id} assignment updated.`;
    await loadResourceSchedule(form.id);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Failed to reassign booking.";
  } finally {
    bookingAssignmentActionLoading.value = {
      ...bookingAssignmentActionLoading.value,
      [bookingId]: false,
    };
  }
}

async function selectService(
  service: AdminServiceItem,
  options: ServiceSelectionOptions = {},
): Promise<void> {
  selectedServiceId.value = service.id;
  resourceScheduleDraftDate.value = resourceScheduleDate.value;
  detailLoading.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const [serviceItem, detail] = await Promise.all([
      adminCatalogService.getServiceItem(service.id),
      adminCatalogService.getServiceDetail(service.id),
      loadAuditLogs(service.id),
      loadResourceSchedule(service.id),
    ]);

    fillBaseFields(serviceItem);
    fillDetailFields(detail);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Failed to load service detail.";
    clearDetailFields();
    resourceSchedule.value = null;
  } finally {
    detailLoading.value = false;
  }

  if (options.syncRoute !== false) {
    await syncRouteQuery();
  }
}

async function applyRouteSelection(): Promise<void> {
  const routeServiceId = readRouteQueryValue(route.query.serviceId) || "";
  const routeScheduleDate = parseRouteScheduleDate(route.query.scheduleDate);

  resourceScheduleDate.value = routeScheduleDate;
  resourceScheduleDraftDate.value = routeScheduleDate;

  if (!routeServiceId) {
    if (form.id || selectedServiceId.value) {
      await resetToCreateMode({ syncRoute: false });
    }
    if (Object.keys(getCurrentRouteQuery()).length > 0) {
      await syncRouteQuery();
    }
    return;
  }

  if (services.value.length === 0 && !listLoading.value) {
    await loadServices();
  }

  const targetService =
    services.value.find((item) => item.id === routeServiceId) || null;

  if (!targetService) {
    await resetToCreateMode({ syncRoute: false });
    await syncRouteQuery();
    return;
  }

  if (form.id === routeServiceId) {
    resourceScheduleDraftDate.value = resourceScheduleDate.value;
    await loadResourceSchedule(routeServiceId);
    if (!isSameRouteQuery(buildRouteQuery(), getCurrentRouteQuery())) {
      await syncRouteQuery();
    }
    return;
  }

  await selectService(targetService, { syncRoute: false });
  if (!isSameRouteQuery(buildRouteQuery(), getCurrentRouteQuery())) {
    await syncRouteQuery();
  }
}

function buildMutationInput(): AdminUpsertServiceInput {
  const cancellationPolicy = normalizeOptionalText(form.cancellationPolicy);
  const capacity = buildCapacityInput();
  const supportContact = buildSupportContact();
  const resources = parseResourcesJson();
  const voucherTemplate = normalizeOptionalText(form.voucherTemplate);

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
    ...(cancellationPolicy ? { cancellationPolicy } : {}),
    ...(timeSlotPreviewList.value.length > 0
      ? { availableTimeSlots: timeSlotPreviewList.value }
      : {}),
    ...(capacity ? { capacity } : {}),
    ...(supportContact ? { supportContact } : {}),
    resources,
    ...(voucherTemplate ? { voucherTemplate } : {}),
  };

  if (!input.title || !input.city || !input.description) {
    throw new Error("Title, city, and description are required.");
  }

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
      ...(normalizeOptionalText(form.carLuggageCapacity)
        ? { luggageCapacity: normalizeOptionalText(form.carLuggageCapacity) }
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

async function saveService(): Promise<void> {
  saveLoading.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    if (!hasAdminAccess.value) {
      throw new Error("This account does not have admin access.");
    }

    const input = buildMutationInput();
    const saved = await adminCatalogService.upsertService(input);
    await loadServices();
    successMessage.value = `Service ${saved.id} saved.`;

    const latest = services.value.find((item) => item.id === saved.id) || saved;
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
  await refreshServices();
});

watch(
  () => route.query,
  async () => {
    if (skipNextRouteWatch.value) {
      skipNextRouteWatch.value = false;
      return;
    }

    await applyRouteSelection();
  },
);
</script>

<template>
  <section class="rounded-3xl border border-slate-200 bg-white px-6 py-7 shadow-sm">
    <p class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
      Admin
    </p>
    <h1 class="mt-2 text-3xl font-semibold text-slate-900">
      Service Management
    </h1>
    <p class="mt-2 text-sm text-slate-600">
      Maintain catalog content, availability, voucher instructions, and delivery contacts in one place.
    </p>
  </section>

  <Message v-if="!hasAdminAccess" severity="warn" class="mt-4">
    This account does not have admin access.
  </Message>
  <Message v-if="errorMessage" severity="error" class="mt-4">{{ errorMessage }}</Message>
  <Message v-if="successMessage" severity="success" class="mt-4">{{ successMessage }}</Message>

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
            @click="refreshServices"
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
            <p class="mt-1 text-xs text-slate-500">
              {{ item.status }} · {{ item.capacity?.remaining ?? "N/A" }} left
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
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
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
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Title
            </span>
            <InputText v-model="form.title" class="w-full" />
          </label>

          <label class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              City
            </span>
            <InputText v-model="form.city" class="w-full" />
          </label>

          <label class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Status
            </span>
            <InputText v-model="form.status" class="w-full" />
          </label>

          <label class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Base Price (USDT)
            </span>
            <InputText v-model="form.basePriceAmount" class="w-full" />
          </label>

          <label class="space-y-1 md:col-span-2">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Description
            </span>
            <textarea
              v-model="form.description"
              rows="3"
              class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label class="space-y-1 md:col-span-2">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Languages (comma/newline)
            </span>
            <textarea
              v-model="form.languagesText"
              rows="2"
              class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label class="space-y-1 md:col-span-2">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
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
            Availability & Delivery
          </h3>

          <div class="mt-3 grid gap-3 md:grid-cols-2">
            <label class="space-y-1 md:col-span-2">
              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Cancellation Policy
              </span>
              <textarea
                v-model="form.cancellationPolicy"
                rows="3"
                class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label class="space-y-1 md:col-span-2">
              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Available Time Slots (comma/newline)
              </span>
              <textarea
                v-model="form.availableTimeSlotsText"
                rows="3"
                class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <p class="text-xs text-slate-500">
                Parsed slots: {{ timeSlotPreviewList.length }}
              </p>
            </label>

            <label class="space-y-1">
              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Capacity Min
              </span>
              <InputText v-model="form.capacityMin" class="w-full" />
            </label>
            <label class="space-y-1">
              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Capacity Max
              </span>
              <InputText v-model="form.capacityMax" class="w-full" />
            </label>
            <label class="space-y-1">
              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Capacity Remaining
              </span>
              <InputText v-model="form.capacityRemaining" class="w-full" />
            </label>

            <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              Set all three capacity fields together. Leave blank only if the service should stay unrestricted.
            </div>

            <label class="space-y-1">
              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Support Contact Name
              </span>
              <InputText v-model="form.supportContactName" class="w-full" />
            </label>
            <label class="space-y-1">
              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Support Contact Channel
              </span>
              <InputText v-model="form.supportContactChannel" class="w-full" />
            </label>
            <label class="space-y-1 md:col-span-2">
              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Support Contact Value
              </span>
              <InputText v-model="form.supportContactValue" class="w-full" />
            </label>

            <label class="space-y-1 md:col-span-2">
              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Resource Roster (JSON array)
              </span>
              <textarea
                v-model="form.resourcesJson"
                rows="8"
                class="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs"
              />
              <p class="text-xs text-slate-500">
                Each item supports: <code>id</code>, <code>label</code>, <code>status</code>,
                <code>languages</code>, optional <code>seats</code>, and
                <code>availableTimeSlots</code>.
              </p>
            </label>

            <label class="space-y-1 md:col-span-2">
              <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Voucher Template
              </span>
              <textarea
                v-model="form.voucherTemplate"
                rows="3"
                class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <p class="text-xs text-slate-500">
                Use <code>{`{bookingId}`}</code> as placeholder.
              </p>
            </label>
          </div>
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
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 class="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
              Resource Schedule
            </h3>
            <div class="flex flex-wrap items-center gap-2">
              <input
                v-model="resourceScheduleDraftDate"
                type="date"
                class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
              />
              <Button
                label="Apply Date"
                icon="pi pi-filter"
                text
                :loading="resourceScheduleLoading"
                @click="applyResourceScheduleDate(resourceScheduleDraftDate)"
              />
              <Button
                v-if="resourceScheduleDate"
                label="Clear"
                icon="pi pi-times"
                text
                @click="clearResourceScheduleFilter"
              />
              <Button
                label="Refresh Schedule"
                icon="pi pi-refresh"
                text
                :loading="resourceScheduleLoading"
                @click="loadResourceSchedule(form.id)"
              />
            </div>
          </div>

          <div v-if="resourceScheduleLoading" class="flex justify-center py-4">
            <ProgressSpinner style="width: 28px; height: 28px" stroke-width="6" />
          </div>

          <div v-else-if="resourceSchedule" class="grid gap-3">
            <div class="grid gap-3 md:grid-cols-4">
              <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                <p class="text-xs uppercase tracking-[0.12em] text-slate-500">Resources</p>
                <p class="mt-2 text-xl font-semibold text-slate-900">
                  {{ resourceSchedule.resources.length }}
                </p>
              </div>
              <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                <p class="text-xs uppercase tracking-[0.12em] text-slate-500">Assigned Bookings</p>
                <p class="mt-2 text-xl font-semibold text-slate-900">
                  {{ resourceScheduleBookingCount }}
                </p>
              </div>
              <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                <p class="text-xs uppercase tracking-[0.12em] text-slate-500">Unassigned</p>
                <p class="mt-2 text-xl font-semibold text-slate-900">
                  {{ resourceSchedule.unassignedBookings.length }}
                </p>
              </div>
              <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                <p class="text-xs uppercase tracking-[0.12em] text-slate-500">Conflict Slots</p>
                <p class="mt-2 text-xl font-semibold" :class="resourceScheduleConflictCount > 0 ? 'text-red-600' : 'text-slate-900'">
                  {{ resourceScheduleConflictCount }}
                </p>
              </div>
            </div>

            <p v-if="resourceScheduleDate" class="text-sm text-slate-600">
              Showing schedule for {{ resourceScheduleDate }}.
            </p>

            <div class="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 class="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Date Load
                  </h4>
                  <p class="mt-1 text-sm text-slate-600">
                    Scan booking pressure by day and jump into a filtered dispatch view.
                  </p>
                </div>
                <Tag
                  :value="`${scheduleDateBoardItems.length} day(s)`"
                  severity="info"
                  rounded
                />
              </div>

              <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <button
                  v-for="item in scheduleDateBoardItems"
                  :key="item.date"
                  type="button"
                  class="rounded-xl border px-3 py-3 text-left transition"
                  :class="
                    resourceScheduleDate === item.date
                      ? 'border-slate-800 bg-slate-50'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-400'
                  "
                  @click="applyResourceScheduleDate(item.date)"
                >
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="font-semibold text-slate-900">{{ item.date }}</p>
                    <Tag :value="`${item.bookingCount} booking(s)`" severity="info" rounded />
                  </div>
                  <p class="mt-2 text-xs text-slate-500">
                    {{ item.slotCount }} slot(s) scheduled
                  </p>
                  <div class="mt-3 flex flex-wrap items-center gap-2">
                    <Tag
                      v-if="item.unassignedCount > 0"
                      :value="`${item.unassignedCount} unassigned`"
                      severity="warn"
                      rounded
                    />
                    <Tag
                      v-if="item.conflictCount > 0"
                      :value="`${item.conflictCount} in conflict`"
                      severity="danger"
                      rounded
                    />
                    <Tag
                      v-if="item.unassignedCount === 0 && item.conflictCount === 0"
                      value="Ready"
                      severity="success"
                      rounded
                    />
                  </div>
                </button>
                <p
                  v-if="scheduleDateBoardItems.length === 0"
                  class="text-sm text-slate-500"
                >
                  No dated schedule data yet.
                </p>
              </div>
            </div>

            <div class="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 class="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Dispatch Timeline
                  </h4>
                  <p class="mt-1 text-sm text-slate-600">
                    Group active bookings by service slot to spot overbooking pressure and dispatch gaps.
                  </p>
                </div>
                <Tag
                  :value="`${scheduleSlotBoardItems.length} slot(s)`"
                  severity="info"
                  rounded
                />
              </div>

              <div class="mt-3 grid gap-3 xl:grid-cols-2">
                <div
                  v-for="slot in scheduleSlotBoardItems"
                  :key="slot.timeSlot"
                  class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
                >
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="font-semibold text-slate-900">{{ slot.timeSlot }}</p>
                    <Tag :value="`${slot.totalBookings} booking(s)`" severity="info" rounded />
                    <Tag
                      v-if="slot.unassignedCount > 0"
                      :value="`${slot.unassignedCount} unassigned`"
                      severity="warn"
                      rounded
                    />
                    <Tag
                      v-if="slot.conflictCount > 0"
                      :value="`${slot.conflictCount} in conflict`"
                      severity="danger"
                      rounded
                    />
                  </div>
                  <p class="mt-2 text-xs text-slate-500">
                    Assigned resources:
                    {{ slot.resourceLabels.join(" · ") || "No resource assigned yet" }}
                  </p>

                  <div class="mt-3 grid gap-2">
                    <div
                      v-for="item in slot.bookings"
                      :key="item.booking.bookingId"
                      class="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700"
                    >
                      <div class="flex flex-wrap items-center gap-2">
                        <Tag :value="item.booking.bookingStatus" severity="contrast" rounded />
                        <Tag
                          v-if="item.issue"
                          :value="getScheduleAttentionLabel(item.issue)"
                          :severity="getScheduleAttentionSeverity(item.issue)"
                          rounded
                        />
                        <p class="font-semibold text-slate-900">
                          {{ item.booking.bookingId }}
                        </p>
                        <Tag
                          v-if="item.resourceLabel"
                          :value="item.resourceLabel"
                          severity="secondary"
                          rounded
                        />
                      </div>
                      <p class="mt-2 text-xs text-slate-500">
                        {{ item.booking.userId }} · {{ item.booking.startDate }} to
                        {{ item.booking.endDate }}
                      </p>
                      <p class="mt-1 text-xs text-slate-500">
                        Travelers: {{ item.booking.travelerCount }}
                      </p>
                      <div class="mt-3 flex flex-wrap items-center gap-2">
                        <Button
                          :label="getBookingAssignmentLoadLabel(item.booking.assignedResourceId)"
                          icon="pi pi-send"
                          text
                          size="small"
                          :loading="bookingAssignmentLoading[item.booking.bookingId]"
                          @click="
                            prepareBookingAssignment(
                              item.booking.bookingId,
                              item.booking.assignedResourceId,
                            )
                          "
                        />
                        <RouterLink
                          :to="{
                            name: 'admin-orders',
                            query: {
                              bookingId: item.booking.bookingId,
                              serviceId: form.id,
                            },
                          }"
                          class="inline-flex items-center rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
                        >
                          Open Order
                        </RouterLink>
                      </div>

                      <div
                        v-if="getBookingAssignmentOptions(item.booking.bookingId).length > 0"
                        class="mt-3 grid gap-2 md:grid-cols-[1fr_auto]"
                      >
                        <select
                          v-model="bookingAssignmentSelections[item.booking.bookingId]"
                          class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                        >
                          <option
                            v-for="resource in getBookingAssignmentOptions(item.booking.bookingId)"
                            :key="resource.id"
                            :value="resource.id"
                          >
                            {{
                              buildBookingAssignmentOptionLabel(
                                resource,
                                item.booking.assignedResourceId,
                              )
                            }}
                          </option>
                        </select>
                        <Button
                          :label="getBookingAssignmentSubmitLabel(item.booking.assignedResourceId)"
                          icon="pi pi-check"
                          size="small"
                          class="!rounded-xl"
                          :loading="bookingAssignmentActionLoading[item.booking.bookingId]"
                          :disabled="
                            isBookingAssignmentSubmitDisabled(
                              item.booking.bookingId,
                              item.booking.assignedResourceId,
                            )
                          "
                          @click="
                            submitBookingAssignment(
                              item.booking.bookingId,
                              item.booking.assignedResourceId,
                            )
                          "
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <p
                  v-if="scheduleSlotBoardItems.length === 0"
                  class="text-sm text-slate-500"
                >
                  No active time-slot bookings.
                </p>
              </div>
            </div>

            <div class="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-4">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 class="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">
                    Needs Attention
                  </h4>
                  <p class="mt-1 text-sm text-slate-600">
                    Review conflict bookings and unassigned time-slot bookings before dispatch.
                  </p>
                </div>
                <Tag
                  :value="`${scheduleAttentionItems.length} item(s)`"
                  :severity="scheduleAttentionItems.length > 0 ? 'warn' : 'success'"
                  rounded
                />
              </div>

              <div class="mt-3 grid gap-2">
                <div
                  v-for="item in scheduleAttentionItems"
                  :key="`${item.issue}-${item.booking.bookingId}`"
                  class="rounded-xl border px-3 py-3 text-sm"
                  :class="
                    item.issue === 'CONFLICT'
                      ? 'border-red-200 bg-white text-slate-700'
                      : 'border-amber-200 bg-white text-slate-700'
                  "
                >
                  <div class="flex flex-wrap items-center gap-2">
                    <Tag
                      :value="getScheduleAttentionLabel(item.issue)"
                      :severity="getScheduleAttentionSeverity(item.issue)"
                      rounded
                    />
                    <p class="font-semibold text-slate-900">
                      {{ item.booking.bookingId }}
                    </p>
                    <Tag
                      v-if="item.resourceLabel"
                      :value="item.resourceLabel"
                      severity="secondary"
                      rounded
                    />
                  </div>
                  <p class="mt-2 text-xs text-slate-500">
                    {{ item.booking.userId }} · {{ item.booking.startDate }} to
                    {{ item.booking.endDate }}
                  </p>
                  <p v-if="item.booking.timeSlot" class="mt-1 text-xs text-slate-500">
                    Slot: {{ item.booking.timeSlot }}
                  </p>
                  <p class="mt-1 text-xs text-slate-500">
                    Travelers: {{ item.booking.travelerCount }}
                  </p>
                  <p
                    class="mt-2 text-xs"
                    :class="item.issue === 'CONFLICT' ? 'text-red-600' : 'text-amber-700'"
                  >
                    {{
                      item.issue === "CONFLICT"
                        ? `Current assignment on ${item.resourceLabel || item.booking.assignedResourceLabel || "resource"} has a slot conflict.`
                        : "No resource is currently assigned to this timed booking."
                    }}
                  </p>
                  <div class="mt-3 grid gap-2">
                    <div class="flex flex-wrap items-center gap-2">
                      <Button
                        :label="getBookingAssignmentLoadLabel(item.booking.assignedResourceId)"
                        icon="pi pi-send"
                        text
                        size="small"
                        :loading="bookingAssignmentLoading[item.booking.bookingId]"
                        @click="
                          prepareBookingAssignment(
                            item.booking.bookingId,
                            item.booking.assignedResourceId,
                          )
                        "
                      />
                      <RouterLink
                        :to="{
                          name: 'admin-orders',
                          query: {
                            bookingId: item.booking.bookingId,
                            serviceId: form.id,
                          },
                        }"
                        class="inline-flex items-center rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
                      >
                        Open Order
                      </RouterLink>
                    </div>

                    <div
                      v-if="getBookingAssignmentOptions(item.booking.bookingId).length > 0"
                      class="grid gap-2 md:grid-cols-[1fr_auto]"
                    >
                      <select
                        v-model="bookingAssignmentSelections[item.booking.bookingId]"
                        class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        <option
                          v-for="resource in getBookingAssignmentOptions(item.booking.bookingId)"
                          :key="resource.id"
                          :value="resource.id"
                        >
                          {{
                            buildBookingAssignmentOptionLabel(
                              resource,
                              item.booking.assignedResourceId,
                            )
                          }}
                        </option>
                      </select>
                      <Button
                        :label="getBookingAssignmentSubmitLabel(item.booking.assignedResourceId)"
                        icon="pi pi-check"
                        size="small"
                        class="!rounded-xl"
                        :loading="bookingAssignmentActionLoading[item.booking.bookingId]"
                        :disabled="
                          isBookingAssignmentSubmitDisabled(
                            item.booking.bookingId,
                            item.booking.assignedResourceId,
                          )
                        "
                        @click="
                          submitBookingAssignment(
                            item.booking.bookingId,
                            item.booking.assignedResourceId,
                          )
                        "
                      />
                    </div>
                  </div>
                </div>
                <p
                  v-if="scheduleAttentionItems.length === 0"
                  class="text-sm text-slate-500"
                >
                  No conflict or unassigned bookings.
                </p>
              </div>
            </div>

            <div class="grid gap-3">
              <div
                v-for="item in resourceSchedule.resources"
                :key="item.resourceId"
                class="rounded-2xl border border-slate-200 bg-white px-4 py-4"
              >
                <div class="flex flex-wrap items-center gap-2">
                  <Tag :value="item.status" :severity="item.status === 'ACTIVE' ? 'success' : 'warn'" rounded />
                  <p class="font-semibold text-slate-900">{{ item.resourceLabel }}</p>
                  <Tag
                    v-if="item.conflictTimeSlots.length > 0"
                    :value="`${item.conflictTimeSlots.length} conflict slot(s)`"
                    severity="danger"
                    rounded
                  />
                </div>
                <p class="mt-2 text-sm text-slate-600">
                  {{ item.languages.join(" / ") || "No languages set" }}
                  <span v-if="item.seats"> · {{ item.seats }} seats</span>
                  · {{ item.availableTimeSlots.length }} open slot(s)
                </p>
                <p v-if="item.conflictTimeSlots.length > 0" class="mt-2 text-xs text-red-600">
                  Conflict slots: {{ item.conflictTimeSlots.join(" · ") }}
                </p>

                <div class="mt-3 grid gap-2">
                  <div
                    v-for="booking in item.bookings"
                    :key="booking.bookingId"
                    class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700"
                  >
                    <div class="flex flex-wrap items-center gap-2">
                      <Tag :value="booking.bookingStatus" severity="contrast" rounded />
                      <p class="font-semibold text-slate-900">{{ booking.bookingId }}</p>
                    </div>
                    <p class="mt-2 text-xs text-slate-500">
                      {{ booking.userId }} · {{ booking.startDate }} to {{ booking.endDate }}
                    </p>
                    <p v-if="booking.timeSlot" class="mt-1 text-xs text-slate-500">
                      Slot: {{ booking.timeSlot }}
                    </p>
                    <p class="mt-1 text-xs text-slate-500">
                      Travelers: {{ booking.travelerCount }}
                    </p>
                    <div class="mt-3 grid gap-2">
                      <div class="flex flex-wrap items-center gap-2">
                        <Button
                          :label="getBookingAssignmentLoadLabel(booking.assignedResourceId)"
                          icon="pi pi-send"
                          text
                          size="small"
                          :loading="bookingAssignmentLoading[booking.bookingId]"
                          @click="prepareBookingAssignment(booking.bookingId, booking.assignedResourceId)"
                        />
                        <RouterLink
                          :to="{
                            name: 'admin-orders',
                            query: {
                              bookingId: booking.bookingId,
                              serviceId: form.id,
                            },
                          }"
                          class="inline-flex items-center rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
                        >
                          Open Order
                        </RouterLink>
                      </div>

                      <div
                        v-if="getBookingAssignmentOptions(booking.bookingId).length > 0"
                        class="grid gap-2 md:grid-cols-[1fr_auto]"
                      >
                        <select
                          v-model="bookingAssignmentSelections[booking.bookingId]"
                          class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                        >
                          <option
                            v-for="resource in getBookingAssignmentOptions(booking.bookingId)"
                            :key="resource.id"
                            :value="resource.id"
                          >
                            {{ buildBookingAssignmentOptionLabel(resource, booking.assignedResourceId) }}
                          </option>
                        </select>
                        <Button
                          :label="getBookingAssignmentSubmitLabel(booking.assignedResourceId)"
                          icon="pi pi-check"
                          size="small"
                          class="!rounded-xl"
                          :loading="bookingAssignmentActionLoading[booking.bookingId]"
                          :disabled="
                            isBookingAssignmentSubmitDisabled(
                              booking.bookingId,
                              booking.assignedResourceId,
                            )
                          "
                          @click="submitBookingAssignment(booking.bookingId, booking.assignedResourceId)"
                        />
                      </div>
                    </div>
                  </div>
                  <p v-if="item.bookings.length === 0" class="text-sm text-slate-500">
                    No active bookings assigned.
                  </p>
                </div>
              </div>
            </div>

            <div class="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <h4 class="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                Unassigned Bookings
              </h4>
              <div class="mt-3 grid gap-2">
                <div
                  v-for="booking in resourceSchedule.unassignedBookings"
                  :key="booking.bookingId"
                  class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700"
                >
                  <div class="flex flex-wrap items-center gap-2">
                    <Tag :value="booking.bookingStatus" severity="warn" rounded />
                    <p class="font-semibold text-slate-900">{{ booking.bookingId }}</p>
                  </div>
                  <p class="mt-2 text-xs text-slate-500">
                    {{ booking.userId }} · {{ booking.startDate }} to {{ booking.endDate }}
                  </p>
                  <p v-if="booking.timeSlot" class="mt-1 text-xs text-slate-500">
                    Slot: {{ booking.timeSlot }}
                  </p>
                  <p class="mt-1 text-xs text-slate-500">
                    Travelers: {{ booking.travelerCount }}
                  </p>
                  <div class="mt-3 grid gap-2">
                    <div class="flex flex-wrap items-center gap-2">
                      <Button
                        :label="getBookingAssignmentLoadLabel(booking.assignedResourceId)"
                        icon="pi pi-send"
                        text
                        size="small"
                        :loading="bookingAssignmentLoading[booking.bookingId]"
                        @click="prepareBookingAssignment(booking.bookingId)"
                      />
                      <RouterLink
                        :to="{
                          name: 'admin-orders',
                          query: {
                            bookingId: booking.bookingId,
                            serviceId: form.id,
                          },
                        }"
                        class="inline-flex items-center rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
                      >
                        Open Order
                      </RouterLink>
                    </div>

                    <div
                      v-if="getBookingAssignmentOptions(booking.bookingId).length > 0"
                      class="grid gap-2 md:grid-cols-[1fr_auto]"
                    >
                      <select
                        v-model="bookingAssignmentSelections[booking.bookingId]"
                        class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        <option
                          v-for="resource in getBookingAssignmentOptions(booking.bookingId)"
                          :key="resource.id"
                          :value="resource.id"
                        >
                          {{ buildBookingAssignmentOptionLabel(resource) }}
                        </option>
                      </select>
                      <Button
                        :label="getBookingAssignmentSubmitLabel(booking.assignedResourceId)"
                        icon="pi pi-check"
                        size="small"
                        class="!rounded-xl"
                        :loading="bookingAssignmentActionLoading[booking.bookingId]"
                        :disabled="
                          isBookingAssignmentSubmitDisabled(
                            booking.bookingId,
                            booking.assignedResourceId,
                          )
                        "
                        @click="submitBookingAssignment(booking.bookingId)"
                      />
                    </div>
                  </div>
                </div>
                <p
                  v-if="resourceSchedule.unassignedBookings.length === 0"
                  class="text-sm text-slate-500"
                >
                  No unassigned bookings.
                </p>
              </div>
            </div>
          </div>

          <div class="mt-6 border-t border-slate-200 pt-4">
          <div class="mb-3 flex items-center justify-between gap-2">
            <h3 class="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
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
        </div>
      </template>
    </Card>
  </section>
</template>
