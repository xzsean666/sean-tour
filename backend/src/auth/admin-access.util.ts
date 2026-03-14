import { config } from '../config';

type UserLike = Record<string, unknown>;

function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseCsv(
  value: string | undefined,
  normalize?: (value: string) => string,
): Set<string> {
  return new Set(
    (value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => (normalize ? normalize(item) : item)),
  );
}

function asUser(value: unknown): UserLike {
  return value && typeof value === 'object' ? (value as UserLike) : {};
}

export function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAdminUser(user: unknown): boolean {
  const candidate = asUser(user);
  const userId = readText(candidate.user_id);
  const email = normalizeAdminEmail(readText(candidate.email));

  const adminUserIds = parseCsv(config.auth.ADMIN_USER_IDS);
  if (userId && adminUserIds.has(userId)) {
    return true;
  }

  const adminEmails = parseCsv(
    config.auth.ADMIN_USER_EMAILS,
    normalizeAdminEmail,
  );
  return !!email && adminEmails.has(email);
}

export function buildAdminActor(user: unknown): string {
  const candidate = asUser(user);
  const userId = readText(candidate.user_id);
  if (userId) {
    return `admin:${userId}`;
  }

  const email = normalizeAdminEmail(readText(candidate.email));
  if (email) {
    return `admin:${email}`;
  }

  return 'admin_auth_code';
}
