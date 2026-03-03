<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Password from 'primevue/password';
import { authService } from '../../api/authService';
import AuthSplitLayout from '../../components/auth/AuthSplitLayout.vue';

const router = useRouter();

const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const isSubmitting = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

const isRegisterDisabled = computed(() => {
  return (
    !email.value.trim() ||
    !password.value ||
    !confirmPassword.value ||
    isSubmitting.value
  );
});

async function handleRegister() {
  errorMessage.value = '';
  successMessage.value = '';

  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Password confirmation does not match.';
    return;
  }

  isSubmitting.value = true;

  const { data, error } = await authService.signUpWithEmail(
    email.value.trim(),
    password.value,
  );

  isSubmitting.value = false;

  if (error) {
    errorMessage.value = error.message;
    return;
  }

  if (data?.session) {
    successMessage.value = 'Account created and signed in.';
    await router.push('/');
    return;
  }

  successMessage.value =
    'Registration successful. Check your email to confirm your account.';
}
</script>

<template>
  <AuthSplitLayout
    title="Create your account"
    subtitle="Join Sean Tour and start planning your next destination."
    hero-title="One account for reviews, bookings, and trip planning."
    hero-description="Create your profile in seconds and keep every travel decision in one place."
    :hero-points="[
      'Save favorite hotels and restaurants.',
      'Track itinerary details across devices.',
      'Unlock personalized destination ideas.',
    ]"
  >
    <form class="mt-1 space-y-4" @submit.prevent="handleRegister">
      <div class="space-y-2">
        <label for="register-email" class="text-sm font-medium text-slate-700">Email</label>
        <InputText
          id="register-email"
          v-model="email"
          type="email"
          class="w-full"
          autocomplete="email"
          placeholder="you@example.com"
        />
      </div>

      <div class="space-y-2">
        <label for="register-password" class="text-sm font-medium text-slate-700">Password</label>
        <Password
          v-model="password"
          input-id="register-password"
          class="w-full"
          input-class="w-full"
          autocomplete="new-password"
          placeholder="At least 6 characters"
          :feedback="false"
          toggle-mask
        />
      </div>

      <div class="space-y-2">
        <label for="register-confirm-password" class="text-sm font-medium text-slate-700"
          >Confirm Password</label
        >
        <Password
          v-model="confirmPassword"
          input-id="register-confirm-password"
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
        label="Create Account"
        class="w-full !rounded-xl !border-slate-900 !bg-slate-900 !py-3 !text-sm !font-semibold hover:!border-slate-800 hover:!bg-slate-800"
        :loading="isSubmitting"
        :disabled="isRegisterDisabled"
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
          Already have an account? Sign in
        </RouterLink>
      </div>
    </template>
  </AuthSplitLayout>
</template>
