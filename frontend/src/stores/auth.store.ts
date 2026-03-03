import type { User } from '@supabase/supabase-js';
import { readonly, ref } from 'vue';
import { authService } from '../api/authService';

const user = ref<User | null>(null);
const isReady = ref(false);

let initPromise: Promise<void> | null = null;
let authSubscription: (() => void) | null = null;

function ensureAuthSubscription(): void {
  if (authSubscription) {
    return;
  }

  const { data } = authService.onAuthStateChange((_event, session) => {
    user.value = session?.user ?? null;
    isReady.value = true;
  });

  authSubscription = data?.subscription?.unsubscribe ?? null;
}

async function refreshUser() {
  const { data, error } = await authService.getUser();

  if (!error) {
    user.value = data?.user ?? null;
  }

  isReady.value = true;
  return { data, error };
}

export async function initAuthStore() {
  if (!initPromise) {
    initPromise = (async () => {
      ensureAuthSubscription();
      await refreshUser();
    })();
  }

  return initPromise;
}

export async function signOutFromAuthStore() {
  const { error } = await authService.signOut();

  if (!error) {
    user.value = null;
  }

  return { error };
}

export function useAuthStore() {
  return {
    user: readonly(user),
    isReady: readonly(isReady),
    refreshUser,
    signOutFromAuthStore,
  };
}
