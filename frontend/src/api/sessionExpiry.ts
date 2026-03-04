import { authService } from './authService';
import { clearBackendToken } from './backendTokenStorage';

const SESSION_EXPIRED_REASON = 'session-expired';

let isHandlingSessionExpiry = false;

function canUseWindow(): boolean {
  return typeof window !== 'undefined' && !!window.location;
}

function getCurrentPath(): string {
  if (!canUseWindow()) {
    return '/';
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}` || '/';
}

function isAuthPage(pathname: string): boolean {
  return pathname.startsWith('/auth/');
}

export function isSessionExpiredReason(value: unknown): boolean {
  return value === SESSION_EXPIRED_REASON;
}

export function isSessionExpiredErrorMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();

  return (
    normalized.includes('no token provided') ||
    normalized.includes('invalid token') ||
    normalized.includes('invalid user context')
  );
}

export async function handleSessionExpired(redirectPath?: string): Promise<void> {
  if (isHandlingSessionExpiry || !canUseWindow()) {
    return;
  }

  isHandlingSessionExpiry = true;
  clearBackendToken();
  await authService.signOut();

  if (isAuthPage(window.location.pathname)) {
    isHandlingSessionExpiry = false;
    return;
  }

  const loginUrl = new URL('/auth/login', window.location.origin);
  loginUrl.searchParams.set('reason', SESSION_EXPIRED_REASON);

  const targetPath = (redirectPath || getCurrentPath()).trim();
  if (targetPath.startsWith('/')) {
    loginUrl.searchParams.set('redirect', targetPath);
  }

  window.location.replace(loginUrl.toString());
}
