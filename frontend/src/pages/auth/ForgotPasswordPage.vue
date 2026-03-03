<script setup>
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import AuthCard from '../../components/AuthCard.vue';
import { authService } from '../../api/authService';

const email = ref('');
const isSubmitting = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

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
  <AuthCard
    title="Forgot Password"
    subtitle="Enter your email to receive a password reset link"
  >
    <form class="stack" @submit.prevent="handleSendResetEmail">
      <label class="field">
        <span>Email</span>
        <input v-model="email" class="input" type="email" required autocomplete="email" />
      </label>

      <button class="btn btn-primary btn-block" type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? 'Sending...' : 'Send Reset Link' }}
      </button>
    </form>

    <p v-if="errorMessage" class="status status-error">{{ errorMessage }}</p>
    <p v-if="successMessage" class="status status-success">{{ successMessage }}</p>

    <div class="auth-links">
      <RouterLink to="/auth/login">Back to login</RouterLink>
    </div>
  </AuthCard>
</template>
