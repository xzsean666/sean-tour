<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import Button from 'primevue/button';
import Message from 'primevue/message';
import Password from 'primevue/password';
import { authService } from '../../api/authService';
import AuthSplitLayout from '../../components/auth/AuthSplitLayout.vue';

const router = useRouter();

const newPassword = ref('');
const confirmPassword = ref('');
const canReset = ref(false);
const isSubmitting = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const infoMessage = ref('Open this page from the reset link in your email.');

const isUpdateDisabled = computed(() => {
  return (
    !newPassword.value ||
    !confirmPassword.value ||
    isSubmitting.value ||
    !canReset.value
  );
});

let unsubscribe = () => {};

onMounted(async () => {
  const { data, error } = await authService.getSession();

  if (error) {
    errorMessage.value = error.message;
    return;
  }

  if (data?.session?.user) {
    canReset.value = true;
    infoMessage.value = '';
  }

  const authListener = authService.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY' || session?.user) {
      canReset.value = true;
      infoMessage.value = '';
    }
  });

  unsubscribe = authListener?.data?.subscription?.unsubscribe || (() => {});
});

onUnmounted(() => {
  unsubscribe();
});

async function handleResetPassword() {
  errorMessage.value = '';
  successMessage.value = '';

  if (!canReset.value) {
    errorMessage.value =
      'No recovery session found. Use the reset link sent to your email.';
    return;
  }

  if (newPassword.value !== confirmPassword.value) {
    errorMessage.value = 'Password confirmation does not match.';
    return;
  }

  isSubmitting.value = true;

  const { error } = await authService.updatePassword(newPassword.value);

  isSubmitting.value = false;

  if (error) {
    errorMessage.value = error.message;
    return;
  }

  successMessage.value = 'Password updated. Redirecting to login...';
  setTimeout(() => {
    router.push('/auth/login');
  }, 1000);
}
</script>

<template>
  <AuthSplitLayout
    title="Set a new password"
    subtitle="Create a new secure password for your Sean Tour account."
    hero-title="Protect your account and continue your travel planning."
    hero-description="After updating the password, you can sign in again and continue where you left off."
    :hero-points="[
      'Recovery sessions are validated before update.',
      'Instant sign-in flow after password reset.',
      'Your account preferences remain unchanged.',
    ]"
  >
    <Message v-if="infoMessage" severity="info" class="mt-1">{{ infoMessage }}</Message>

    <form class="mt-4 space-y-4" @submit.prevent="handleResetPassword">
      <div class="space-y-2">
        <label for="reset-password" class="text-sm font-medium text-slate-700">New Password</label>
        <Password
          v-model="newPassword"
          input-id="reset-password"
          class="w-full"
          input-class="w-full"
          autocomplete="new-password"
          placeholder="At least 6 characters"
          :feedback="false"
          toggle-mask
        />
      </div>

      <div class="space-y-2">
        <label for="reset-confirm-password" class="text-sm font-medium text-slate-700"
          >Confirm New Password</label
        >
        <Password
          v-model="confirmPassword"
          input-id="reset-confirm-password"
          class="w-full"
          input-class="w-full"
          autocomplete="new-password"
          placeholder="Re-enter your password"
          :feedback="false"
          toggle-mask
        />
      </div>

      <Button
        type="submit"
        label="Update Password"
        class="w-full !rounded-xl !border-slate-900 !bg-slate-900 !py-3 !text-sm !font-semibold hover:!border-slate-800 hover:!bg-slate-800"
        :loading="isSubmitting"
        :disabled="isUpdateDisabled"
      />
    </form>

    <Message v-if="errorMessage" severity="error" class="mt-4">{{ errorMessage }}</Message>
    <Message v-if="successMessage" severity="success" class="mt-4">{{ successMessage }}</Message>

    <template #footer>
      <div class="mt-6 grid gap-2 text-sm">
        <RouterLink
          to="/auth/login"
          class="font-medium text-emerald-700 transition hover:text-emerald-600 hover:underline"
        >
          Back to login
        </RouterLink>
      </div>
    </template>
  </AuthSplitLayout>
</template>
