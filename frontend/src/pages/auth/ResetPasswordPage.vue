<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import AuthCard from '../../components/AuthCard.vue';
import { authService } from '../../api/authService';

const router = useRouter();

const newPassword = ref('');
const confirmPassword = ref('');
const canReset = ref(false);
const isSubmitting = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const infoMessage = ref('Open this page from the reset link in your email.');

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
  <AuthCard title="Reset Password" subtitle="Set a new password for your account">
    <p v-if="infoMessage" class="status">{{ infoMessage }}</p>

    <form class="stack" @submit.prevent="handleResetPassword">
      <label class="field">
        <span>New Password</span>
        <input
          v-model="newPassword"
          class="input"
          type="password"
          required
          autocomplete="new-password"
          minlength="6"
        />
      </label>

      <label class="field">
        <span>Confirm New Password</span>
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
        {{ isSubmitting ? 'Updating...' : 'Update Password' }}
      </button>
    </form>

    <p v-if="errorMessage" class="status status-error">{{ errorMessage }}</p>
    <p v-if="successMessage" class="status status-success">{{ successMessage }}</p>

    <div class="auth-links">
      <RouterLink to="/auth/login">Back to login</RouterLink>
    </div>
  </AuthCard>
</template>
