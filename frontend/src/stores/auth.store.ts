import type { Session, User } from "@supabase/supabase-js";
import { readonly, ref } from "vue";
import { authService } from "../api/authService";
import { backendAuthService } from "../api/backendAuthService";
import {
  backendCurrentUserService,
  type BackendCurrentUser,
} from "../api/backendCurrentUserService";
import {
  clearBackendToken,
  getBackendToken,
  setBackendToken,
} from "../api/backendTokenStorage";

const user = ref<User | null>(null);
const isReady = ref(false);
const backendToken = ref<string | null>(getBackendToken());
const backendUser = ref<BackendCurrentUser | null>(null);

let initPromise: Promise<void> | null = null;
let authSubscription: (() => void) | null = null;
let latestSupabaseAccessToken: string | null = null;

function ensureAuthSubscription(): void {
  if (authSubscription) {
    return;
  }

  const { data } = authService.onAuthStateChange((_event, session) => {
    user.value = session?.user ?? null;
    void syncBackendToken(session);
    isReady.value = true;
  });

  authSubscription = data?.subscription?.unsubscribe ?? null;
}

async function syncBackendToken(session: Session | null): Promise<void> {
  const accessToken = session?.access_token?.trim() || "";

  if (!accessToken) {
    latestSupabaseAccessToken = null;
    backendToken.value = null;
    backendUser.value = null;
    clearBackendToken();
    return;
  }

  if (
    latestSupabaseAccessToken === accessToken &&
    backendToken.value &&
    backendUser.value
  ) {
    return;
  }

  const { token, error } =
    await backendAuthService.exchangeSupabaseAccessToken(accessToken);

  if (error || !token) {
    latestSupabaseAccessToken = null;
    backendToken.value = null;
    backendUser.value = null;
    clearBackendToken();
    return;
  }

  latestSupabaseAccessToken = accessToken;
  backendToken.value = token;
  setBackendToken(token);

  try {
    backendUser.value = await backendCurrentUserService.getCurrentUser(token);
  } catch {
    backendUser.value = null;
  }
}

async function refreshUser() {
  const { data, error } = await authService.getSession();

  if (!error) {
    user.value = data?.session?.user ?? null;
    await syncBackendToken(data?.session ?? null);
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
    latestSupabaseAccessToken = null;
    user.value = null;
    backendToken.value = null;
    backendUser.value = null;
    clearBackendToken();
  }

  return { error };
}

export function useAuthStore() {
  return {
    user: readonly(user),
    isReady: readonly(isReady),
    backendToken: readonly(backendToken),
    backendUser: readonly(backendUser),
    refreshUser,
    signOutFromAuthStore,
  };
}
