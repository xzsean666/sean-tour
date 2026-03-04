const BACKEND_TOKEN_KEY = "sean_tour_backend_token";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function getBackendToken(): string | null {
  if (!canUseStorage()) {
    return null;
  }

  return window.localStorage.getItem(BACKEND_TOKEN_KEY);
}

export function setBackendToken(token: string): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(BACKEND_TOKEN_KEY, token);
}

export function clearBackendToken(): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(BACKEND_TOKEN_KEY);
}
