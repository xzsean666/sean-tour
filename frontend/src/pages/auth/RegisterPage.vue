<script setup>
import { ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import AuthCard from '../../components/AuthCard.vue';
import { authService } from '../../api/authService';

const router = useRouter();

const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const isSubmitting = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

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
  <AuthCard title="Create Account" subtitle="Register with email and password">
    <form class="stack" @submit.prevent="handleRegister">
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
          autocomplete="new-password"
          minlength="6"
        />
      </label>

      <label class="field">
        <span>Confirm Password</span>
        <input
          v-model="confirmPassword"
          class="input"
          type="password"
          required
          autocomplete="new-password"
          minlength="6"
        />
      </label>

      <button class="btn btn-primary btn-block" type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? 'Creating account...' : 'Register' }}
      </button>
    </form>

    <p v-if="errorMessage" class="status status-error">{{ errorMessage }}</p>
    <p v-if="successMessage" class="status status-success">{{ successMessage }}</p>

    <div class="auth-links">
      <RouterLink to="/auth/login">Already have an account? Sign in</RouterLink>
    </div>
  </AuthCard>
</template>
