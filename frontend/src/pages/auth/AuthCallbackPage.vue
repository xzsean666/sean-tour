<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import Message from 'primevue/message';
import { authService } from '../../api/authService';
import { initAuthStore, useAuthStore } from '../../stores/auth.store';
import AuthSplitLayout from '../../components/auth/AuthSplitLayout.vue';

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
  <AuthSplitLayout
    title="Finishing sign in"
    subtitle="We are validating your OAuth session."
    hero-title="Secure social login for faster travel booking."
    hero-description="Sean Tour confirms your provider session and restores your account state automatically."
    :hero-points="[
      'OAuth callback is validated server-side.',
      'Session state is synced to your app store.',
      'Automatic redirect after sign-in success.',
    ]"
  >
    <Message v-if="isLoading" severity="info" class="mt-1">{{ statusMessage }}</Message>
    <Message v-if="errorMessage" severity="error" class="mt-4">{{ errorMessage }}</Message>

    <template #footer>
      <div v-if="!isLoading" class="mt-6 grid gap-2 text-sm">
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
