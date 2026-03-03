<script setup>
import { onMounted, ref } from 'vue';
import { RouterLink, RouterView, useRouter } from 'vue-router';
import { hasSupabaseConfig } from './api/supabaseClient';
import { initAuthStore, useAuthStore } from './stores/auth.store';

const router = useRouter();
const { user, isReady, signOutFromAuthStore } = useAuthStore();

const isSigningOut = ref(false);
const supabaseConfigured = hasSupabaseConfig();

onMounted(async () => {
  await initAuthStore();
});

async function handleSignOut() {
  isSigningOut.value = true;

  const { error } = await signOutFromAuthStore();

  isSigningOut.value = false;

  if (!error) {
    await router.push('/auth/login');
  }
}
</script>

<template>
  <div class="app-shell">
    <header class="topbar panel">
      <RouterLink class="brand" to="/">Sean Tour</RouterLink>

      <nav class="nav-links">
        <RouterLink to="/">Demo</RouterLink>
        <RouterLink to="/auth/login">Login</RouterLink>
        <RouterLink to="/auth/register">Register</RouterLink>
      </nav>

      <div class="session-block">
        <span v-if="!isReady" class="muted">Checking session...</span>

        <template v-else-if="user">
          <span class="user-pill">{{ user.email || user.id }}</span>
          <button class="btn btn-ghost" :disabled="isSigningOut" @click="handleSignOut">
            {{ isSigningOut ? 'Signing out...' : 'Sign Out' }}
          </button>
        </template>
      </div>
    </header>

    <p v-if="!supabaseConfigured" class="config-warning">
      Supabase is not configured. Set VITE_SUPABASE_URL and
      VITE_SUPABASE_ANON_KEY in frontend/.env.
    </p>

    <main class="page-container">
      <RouterView />
    </main>
  </div>
</template>
