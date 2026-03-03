<script setup>
import { ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import AuthCard from '../../components/AuthCard.vue';
import { authService } from '../../api/authService';

const router = useRouter();

const email = ref('');
const password = ref('');
const isSubmitting = ref(false);
const isGoogleSubmitting = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

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
  <AuthCard title="Sign In" subtitle="Email login or Google OAuth">
    <form class="stack" @submit.prevent="handleEmailLogin">
      <label class="field">
        <span>Email</span>
        <input v-model="email" class="input" type="email" required autocomplete="email" />
      </label>

      <label class="field">
        <span>Password</span>
        <input
          v-model="password"
          class="input"
          type="password"
          required
          autocomplete="current-password"
        />
      </label>

      <button class="btn btn-primary btn-block" type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? 'Signing in...' : 'Sign In with Email' }}
      </button>

      <button
        class="btn btn-secondary btn-block"
        type="button"
        :disabled="isGoogleSubmitting"
        @click="handleGoogleLogin"
      >
        {{ isGoogleSubmitting ? 'Redirecting...' : 'Continue with Google' }}
      </button>
    </form>

    <p v-if="errorMessage" class="status status-error">{{ errorMessage }}</p>
    <p v-if="successMessage" class="status status-success">{{ successMessage }}</p>

    <div class="auth-links">
      <RouterLink to="/auth/register">No account? Create one</RouterLink>
      <RouterLink to="/auth/forgot-password">Forgot password?</RouterLink>
    </div>
  </AuthCard>
</template>
