<script setup>
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import AuthCard from '../../components/AuthCard.vue';
import { authService } from '../../api/authService';
import { initAuthStore, useAuthStore } from '../../stores/auth.store';

const route = useRoute();
const router = useRouter();

const isLoading = ref(true);
const errorMessage = ref('');
const statusMessage = ref('Completing sign in...');

function readHashError() {
  const hashText = window.location.hash || '';
  const hashQuery = hashText.startsWith('#') ? hashText.slice(1) : hashText;
  const params = new URLSearchParams(hashQuery);
  return params.get('error_description') || params.get('error') || '';
}

const routeError = computed(() => {
  const queryError = route.query.error_description || route.query.error;
  const hashError = readHashError();

  if (Array.isArray(queryError) && queryError.length > 0) {
    return queryError[0];
  }

  if (typeof queryError === 'string' && queryError) {
    return queryError;
  }

  return hashError;
});

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForSession() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await authService.getSession();

    if (result.error) {
      return result;
    }

    if (result.data?.session?.user) {
      return result;
    }

    await sleep(250);
  }

  return { data: { session: null }, error: null };
}

onMounted(async () => {
  if (routeError.value) {
    errorMessage.value = routeError.value;
    statusMessage.value = '';
    isLoading.value = false;
    return;
  }

  const { data, error } = await waitForSession();

  if (error) {
    errorMessage.value = error.message;
    statusMessage.value = '';
    isLoading.value = false;
    return;
  }

  if (data?.session?.user) {
    await initAuthStore();
    const { user } = useAuthStore();

    if (user.value) {
      await router.replace('/');
      return;
    }
  }

  errorMessage.value = 'No active session found. Please try login again.';
  statusMessage.value = '';
  isLoading.value = false;
});
</script>

<template>
  <AuthCard title="OAuth Callback" subtitle="Google sign-in result">
    <p v-if="isLoading" class="status">{{ statusMessage }}</p>
    <p v-if="errorMessage" class="status status-error">{{ errorMessage }}</p>

    <div v-if="!isLoading" class="auth-links">
      <RouterLink to="/auth/login">Back to login</RouterLink>
    </div>
  </AuthCard>
</template>
