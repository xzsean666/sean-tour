<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { hasSupabaseConfig } from './api/supabaseClient';
import { initAuthStore, useAuthStore } from './stores/auth.store';

const router = useRouter();
const route = useRoute();
const { user, isReady, signOutFromAuthStore } = useAuthStore();

const isSigningOut = ref(false);
const supabaseConfigured = hasSupabaseConfig();
const isAuthRoute = computed(() => route.path.startsWith('/auth/'));

const primaryLinks = computed(() => {
  return [
    { to: '/', label: 'Services' },
    ...(user.value
      ? [
          { to: '/orders', label: 'Orders' },
          { to: '/assistant', label: 'Assistant' },
          { to: '/admin/services', label: 'Admin Services' },
          { to: '/admin/payments', label: 'Admin Payments' },
          { to: '/admin/assistant', label: 'Admin Assistant' },
        ]
      : [
          { to: '/auth/login', label: 'Login' },
          { to: '/auth/register', label: 'Register' },
        ]),
  ];
});

onMounted(async () => {
  await initAuthStore();
});

function isActiveLink(path: string): boolean {
  if (path === '/') {
    return route.path === '/';
  }

  return route.path === path || route.path.startsWith(`${path}/`);
}

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
    <header v-if="!isAuthRoute" class="topbar topbar-glass">
      <div class="brand-block">
        <RouterLink class="brand" to="/">Sean Tour</RouterLink>
        <p class="brand-subtitle">China Experiences · USDT Checkout</p>
      </div>

      <nav class="nav-links" aria-label="Primary">
        <RouterLink
          v-for="link in primaryLinks"
          :key="link.to"
          :to="link.to"
          class="nav-link"
          :class="{ 'nav-link-active': isActiveLink(link.to) }"
        >
          {{ link.label }}
        </RouterLink>
      </nav>

      <div class="session-block">
        <span v-if="!isReady" class="muted">Checking session...</span>

        <template v-else-if="user">
          <span class="user-pill">{{ user.email || user.id }}</span>
          <button class="btn btn-ghost nav-signout" :disabled="isSigningOut" @click="handleSignOut">
            {{ isSigningOut ? 'Signing out...' : 'Sign Out' }}
          </button>
        </template>
      </div>
    </header>

    <div v-else class="auth-top-hint">
      <RouterLink class="brand" to="/">Sean Tour</RouterLink>
    </div>

    <p v-if="!supabaseConfigured" class="config-warning">
      Supabase is not configured. Set VITE_SUPABASE_URL and
      VITE_SUPABASE_ANON_KEY in frontend/.env.
    </p>

    <main class="page-container">
      <RouterView />
    </main>
  </div>
</template>
