<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import { authService } from '../../api/authService';
import AuthSplitLayout from '../../components/auth/AuthSplitLayout.vue';

const email = ref('');
const isSubmitting = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

const isSendDisabled = computed(() => {
  return !email.value.trim() || isSubmitting.value;
});

async function handleSendResetEmail() {
  errorMessage.value = '';
  successMessage.value = '';
  isSubmitting.value = true;

  const { error } = await authService.sendPasswordResetEmail(email.value.trim());

  isSubmitting.value = false;

  if (error) {
    errorMessage.value = error.message;
    return;
  }

  successMessage.value =
    'If this email exists, a password reset link has been sent.';
}
</script>

<template>
  <AuthSplitLayout
    title="Reset your password"
    subtitle="Enter your email and we will send a secure reset link."
    hero-title="Recover account access without contacting support."
    hero-description="Use your registered email to receive a recovery link and get back to planning your trip."
    :hero-points="[
      'Secure one-time password reset flow.',
      'Works on desktop and mobile browsers.',
      'Fast return to your saved itineraries.',
    ]"
  >
    <form class="mt-1 space-y-4" @submit.prevent="handleSendResetEmail">
      <div class="space-y-2">
        <label for="forgot-email" class="text-sm font-medium text-slate-700">Email</label>
        <InputText
          id="forgot-email"
          v-model="email"
          type="email"
          class="w-full"
          autocomplete="email"
          placeholder="you@example.com"
        />
      </div>

      <Button
        type="submit"
        label="Send Reset Link"
        class="w-full !rounded-xl !border-slate-900 !bg-slate-900 !py-3 !text-sm !font-semibold hover:!border-slate-800 hover:!bg-slate-800"
        :loading="isSubmitting"
        :disabled="isSendDisabled"
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
