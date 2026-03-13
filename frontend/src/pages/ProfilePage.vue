<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import Button from "primevue/button";
import Card from "primevue/card";
import InputText from "primevue/inputtext";
import Message from "primevue/message";
import ProgressSpinner from "primevue/progressspinner";
import Tag from "primevue/tag";
import {
  notificationService,
  type NotificationItem,
} from "../api/notificationService";
import { userProfileService, type UserProfile } from "../api/userProfileService";

type ProfileForm = {
  fullName: string;
  email: string;
  phone: string;
  passportNumber: string;
  passportCountry: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  preferredLanguage: string;
  notes: string;
};

function createEmptyForm(): ProfileForm {
  return {
    fullName: "",
    email: "",
    phone: "",
    passportNumber: "",
    passportCountry: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    preferredLanguage: "",
    notes: "",
  };
}

const router = useRouter();

const loading = ref(false);
const saveLoading = ref(false);
const exportLoading = ref(false);
const deleteLoading = ref(false);
const notificationsLoading = ref(false);
const actioningNotificationId = ref("");
const errorMessage = ref("");
const successMessage = ref("");
const profile = ref<UserProfile | null>(null);
const notifications = ref<NotificationItem[]>([]);
const form = reactive<ProfileForm>(createEmptyForm());

const unreadCount = computed(
  () => notifications.value.filter((item) => !item.readAt).length,
);

function fillForm(nextProfile: UserProfile): void {
  form.fullName = nextProfile.fullName || "";
  form.email = nextProfile.email || "";
  form.phone = nextProfile.phone || "";
  form.passportNumber = nextProfile.passportNumber || "";
  form.passportCountry = nextProfile.passportCountry || "";
  form.emergencyContactName = nextProfile.emergencyContactName || "";
  form.emergencyContactPhone = nextProfile.emergencyContactPhone || "";
  form.preferredLanguage = nextProfile.preferredLanguage || "";
  form.notes = nextProfile.notes || "";
}

function normalizeOptionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
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

async function loadNotifications(): Promise<void> {
  notificationsLoading.value = true;

  try {
    const result = await notificationService.getMyNotifications({
      limit: 20,
      offset: 0,
    });
    notifications.value = result.items;
  } finally {
    notificationsLoading.value = false;
  }
}

async function loadPage(): Promise<void> {
  loading.value = true;
  errorMessage.value = "";

  try {
    const [profileData] = await Promise.all([
      userProfileService.getMyProfile(),
      loadNotifications(),
    ]);

    profile.value = profileData;
    fillForm(profileData);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Failed to load profile.";
  } finally {
    loading.value = false;
  }
}

async function saveProfile(): Promise<void> {
  saveLoading.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const saved = await userProfileService.upsertMyProfile({
      fullName: normalizeOptionalText(form.fullName),
      email: normalizeOptionalText(form.email),
      phone: normalizeOptionalText(form.phone),
      passportNumber: normalizeOptionalText(form.passportNumber),
      passportCountry: normalizeOptionalText(form.passportCountry),
      emergencyContactName: normalizeOptionalText(form.emergencyContactName),
      emergencyContactPhone: normalizeOptionalText(form.emergencyContactPhone),
      preferredLanguage: normalizeOptionalText(form.preferredLanguage),
      notes: normalizeOptionalText(form.notes),
    });

    profile.value = saved;
    fillForm(saved);
    successMessage.value = "Traveler profile saved.";
    await loadNotifications();
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Failed to save profile.";
  } finally {
    saveLoading.value = false;
  }
}

async function exportMyData(): Promise<void> {
  exportLoading.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const exported = await userProfileService.exportMyData();
    const blob = new Blob([exported.payloadJson], {
      type: "application/json;charset=utf-8",
    });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `sean-tour-data-${exported.userId}.json`;
    link.click();
    URL.revokeObjectURL(blobUrl);
    successMessage.value = `Exported profile data at ${formatDate(exported.exportedAt)}.`;
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Failed to export profile data.";
  } finally {
    exportLoading.value = false;
  }
}

async function deleteMyData(): Promise<void> {
  const confirmed = window.confirm(
    "This will delete your saved profile fields and notification history. Continue?",
  );
  if (!confirmed) {
    return;
  }

  deleteLoading.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    await userProfileService.deleteMyData();
    successMessage.value = "Saved profile data deleted.";
    await loadPage();
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Failed to delete profile data.";
  } finally {
    deleteLoading.value = false;
  }
}

async function openNotification(item: NotificationItem): Promise<void> {
  actioningNotificationId.value = item.id;
  errorMessage.value = "";

  try {
    if (!item.readAt) {
      const updated = await notificationService.markNotificationRead(item.id);
      notifications.value = notifications.value.map((entry) =>
        entry.id === updated.id ? updated : entry,
      );
    }

    if (item.targetPath) {
      await router.push(item.targetPath);
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Failed to open notification.";
  } finally {
    actioningNotificationId.value = "";
  }
}

onMounted(async () => {
  await loadPage();
});
</script>

<template>
  <section
    class="relative overflow-hidden rounded-3xl border border-[#0c6d64]/20 bg-gradient-to-br from-[#0a2f37] via-[#0f4d53] to-[#1f355d] px-6 py-8 text-white shadow-[0_26px_90px_-55px_rgba(7,41,46,0.95)]"
  >
    <div class="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[#f8b03c]/22 blur-3xl" />
    <div class="absolute -left-16 -bottom-24 h-52 w-52 rounded-full bg-[#2ad0a1]/15 blur-3xl" />

    <p class="relative text-xs font-semibold uppercase tracking-[0.16em] text-teal-100/90">Profile</p>
    <h1 class="relative mt-2 text-3xl font-semibold leading-tight">Traveler Identity & Notifications</h1>
    <p class="relative mt-3 text-sm text-teal-50/90">
      Save your traveler profile once, reuse it across bookings, and keep service updates in one place.
    </p>
  </section>

  <Message v-if="errorMessage" severity="error" class="mt-4">{{ errorMessage }}</Message>
  <Message v-if="successMessage" severity="success" class="mt-4">{{ successMessage }}</Message>

  <div v-if="loading" class="mt-8 flex justify-center">
    <ProgressSpinner style="width: 40px; height: 40px" stroke-width="6" />
  </div>

  <section v-else class="mt-6 grid gap-4 xl:grid-cols-[1.04fr_0.96fr]">
    <Card class="!rounded-3xl !border !border-slate-200/90 !bg-white/95">
      <template #title>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-xl font-semibold text-slate-900">Traveler Profile</h2>
          <Tag
            v-if="profile"
            :value="`Updated ${formatDate(profile.updatedAt)}`"
            severity="info"
            rounded
          />
        </div>
      </template>

      <template #content>
        <div class="grid gap-3 md:grid-cols-2">
          <label class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Full Name</span>
            <InputText v-model="form.fullName" class="w-full" />
          </label>

          <label class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Email</span>
            <InputText v-model="form.email" class="w-full" />
          </label>

          <label class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Phone</span>
            <InputText v-model="form.phone" class="w-full" />
          </label>

          <label class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Preferred Language</span>
            <InputText v-model="form.preferredLanguage" class="w-full" />
          </label>

          <label class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Passport Number</span>
            <InputText v-model="form.passportNumber" class="w-full" />
            <p v-if="profile?.passportNumberMasked" class="text-xs text-slate-500">
              Saved: {{ profile.passportNumberMasked }}
            </p>
          </label>

          <label class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Passport Country</span>
            <InputText v-model="form.passportCountry" class="w-full" />
          </label>

          <label class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Emergency Contact Name
            </span>
            <InputText v-model="form.emergencyContactName" class="w-full" />
          </label>

          <label class="space-y-1">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Emergency Contact Phone
            </span>
            <InputText v-model="form.emergencyContactPhone" class="w-full" />
          </label>

          <label class="space-y-1 md:col-span-2">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Notes</span>
            <textarea
              v-model="form.notes"
              rows="4"
              class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="Dietary notes, arrival preferences, anything ops should know."
            />
          </label>
        </div>

        <div class="mt-5 flex flex-wrap gap-2">
          <Button
            label="Save Profile"
            icon="pi pi-save"
            class="!rounded-xl"
            :loading="saveLoading"
            @click="saveProfile"
          />
          <Button
            label="Export Data"
            icon="pi pi-download"
            severity="secondary"
            outlined
            class="!rounded-xl"
            :loading="exportLoading"
            @click="exportMyData"
          />
          <Button
            label="Delete Saved Data"
            icon="pi pi-trash"
            severity="danger"
            outlined
            class="!rounded-xl"
            :loading="deleteLoading"
            @click="deleteMyData"
          />
        </div>
      </template>
    </Card>

    <div class="grid gap-4">
      <Card class="!rounded-3xl !border !border-slate-200/90 !bg-white/95">
        <template #content>
          <div class="grid gap-3 md:grid-cols-3">
            <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Profile ID</p>
              <p class="mt-2 break-all font-mono text-sm text-slate-900">
                {{ profile?.userId || "-" }}
              </p>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Unread Notifications</p>
              <p class="mt-2 text-2xl font-semibold text-slate-900">{{ unreadCount }}</p>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Created</p>
              <p class="mt-2 text-sm font-semibold text-slate-900">
                {{ profile ? formatDate(profile.createdAt) : "-" }}
              </p>
            </div>
          </div>
        </template>
      </Card>

      <Card class="!rounded-3xl !border !border-slate-200/90 !bg-white/95">
        <template #title>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-xl font-semibold text-slate-900">Notifications</h2>
            <Button
              label="Reload"
              icon="pi pi-refresh"
              text
              :loading="notificationsLoading"
              @click="loadNotifications"
            />
          </div>
        </template>

        <template #content>
          <div v-if="notificationsLoading" class="flex justify-center py-6">
            <ProgressSpinner style="width: 34px; height: 34px" stroke-width="6" />
          </div>

          <div v-else class="grid gap-3">
            <button
              v-for="item in notifications"
              :key="item.id"
              type="button"
              class="rounded-2xl border border-slate-200 px-4 py-4 text-left transition hover:border-slate-400"
              @click="openNotification(item)"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <Tag :value="item.type" severity="contrast" rounded />
                  <Tag
                    :value="item.readAt ? 'Read' : 'Unread'"
                    :severity="item.readAt ? 'success' : 'warn'"
                    rounded
                  />
                </div>
                <span class="text-xs text-slate-500">{{ formatDate(item.createdAt) }}</span>
              </div>
              <p class="mt-3 font-semibold text-slate-900">{{ item.title }}</p>
              <p class="mt-2 text-sm leading-6 text-slate-600">{{ item.message }}</p>
              <p v-if="item.targetPath" class="mt-2 text-xs text-sky-700">
                {{ actioningNotificationId === item.id ? "Opening..." : item.targetPath }}
              </p>
            </button>

            <p
              v-if="notifications.length === 0"
              class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500"
            >
              No notifications yet.
            </p>
          </div>
        </template>
      </Card>
    </div>
  </section>
</template>
