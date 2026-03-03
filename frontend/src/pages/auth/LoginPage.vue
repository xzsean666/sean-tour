<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import Button from 'primevue/button';
import Divider from 'primevue/divider';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Password from 'primevue/password';
import { authService } from '../../api/authService';
import AuthSplitLayout from '../../components/auth/AuthSplitLayout.vue';

const router = useRouter();

const email = ref('');
const password = ref('');
const isSubmitting = ref(false);
const isGoogleSubmitting = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

const isEmailLoginDisabled = computed(() => {
  return (
    !email.value.trim() ||
    !password.value ||
    isSubmitting.value ||
    isGoogleSubmitting.value
  );
});

async function handleEmailLogin() {
  errorMessage.value = '';
  successMessage.value = '';
  isSubmitting.value = true;

  const { error } = await authService.signInWithEmail(
    email.value.trim(),
    password.value,
  );

  isSubmitting.value = false;

  if (error) {
    errorMessage.value = error.message;
    return;
  }

  successMessage.value = 'Login successful.';
  await router.push('/');
}

async function handleGoogleLogin() {
  errorMessage.value = '';
  successMessage.value = '';
  isGoogleSubmitting.value = true;

  const { error } = await authService.signInWithGoogle();

  isGoogleSubmitting.value = false;

  if (error) {
    errorMessage.value = error.message;
    return;
  }

  successMessage.value = 'Redirecting to Google...';
}
</script>

<template>
  <AuthSplitLayout
    title="Welcome back"
    subtitle="Sign in with email or continue with your social account."
    hero-title="Travel smarter with a Tripadvisor-inspired booking experience."
    hero-description="Compare stays, collect trusted reviews, and manage your whole itinerary in one place."
    :hero-points="[
      'Verified traveler reviews and ratings.',
      'Price comparison across popular destinations.',
      'Simple trip planning for your next adventure.',
    ]"
  >
    <form class="mt-1 space-y-4" @submit.prevent="handleEmailLogin">
      <div class="space-y-2">
        <label for="login-email" class="text-sm font-medium text-slate-700">Email</label>
        <InputText
          id="login-email"
          v-model="email"
          type="email"
          class="w-full"
          autocomplete="email"
          placeholder="you@example.com"
        />
      </div>

      <div class="space-y-2">
        <label for="login-password" class="text-sm font-medium text-slate-700">Password</label>
        <Password
          v-model="password"
          input-id="login-password"
          class="w-full"
          input-class="w-full"
          autocomplete="current-password"
          placeholder="Enter your password"
          :feedback="false"
          toggle-mask
        />
      </div>

      <Button
        type="submit"
        label="Sign In with Email"
        class="w-full !rounded-xl !border-slate-900 !bg-slate-900 !py-3 !text-sm !font-semibold hover:!border-slate-800 hover:!bg-slate-800"
        :loading="isSubmitting"
        :disabled="isEmailLoginDisabled"
      />

      <Divider align="center" class="!my-2">
        <span class="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">or</span>
      </Divider>

      <Button
        type="button"
        label="Continue with Google"
        icon="pi pi-google"
        severity="contrast"
        outlined
        class="w-full !rounded-xl !py-3 !text-sm !font-semibold"
        :loading="isGoogleSubmitting"
        :disabled="isSubmitting || isGoogleSubmitting"
        @click="handleGoogleLogin"
      />
    </form>

    <Message v-if="errorMessage" severity="error" class="mt-4">{{ errorMessage }}</Message>
    <Message v-if="successMessage" severity="success" class="mt-4">{{ successMessage }}</Message>

    <template #footer>
      <div class="mt-6 grid gap-2 text-sm">
        <RouterLink
          to="/auth/register"
          class="font-medium text-emerald-700 transition hover:text-emerald-600 hover:underline"
        >
          No account yet? Create one
        </RouterLink>
        <RouterLink
          to="/auth/forgot-password"
          class="font-medium text-slate-600 transition hover:text-slate-900 hover:underline"
        >
          Forgot password?
        </RouterLink>
      </div>
    </template>
  </AuthSplitLayout>
</template>
