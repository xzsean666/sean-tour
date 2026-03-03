import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHash,
} from 'crypto';
import jwt from 'jsonwebtoken';

export interface JWTPayload {
  [key: string]: unknown;
}

export class JWTHelper {
  private readonly secretKey: string;

  constructor(secretKey: string) {
    this.secretKey = secretKey;
  }

  generateToken(payload: JWTPayload, expiresInSeconds = 3600): string {
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
    return jwt.sign({ ...payload, exp: expiresAt }, this.secretKey);
  }

  verifyToken(token: string): JWTPayload {
    return jwt.verify(token, this.secretKey) as JWTPayload;
  }

  decodeToken(token: string): JWTPayload | null {
    return jwt.decode(token) as JWTPayload | null;
  }
}

export class CryptoHelper {
  static encryptAES(value: string, secret: string): string {
    const iv = randomBytes(12);
    const key = createHash('sha256').update(secret).digest();
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  static decryptAES(value: string, secret: string): string {
    const [ivBase64, tagBase64, payloadBase64] = value.split(':');
    if (!ivBase64 || !tagBase64 || !payloadBase64) {
      throw new Error('Invalid encrypted payload format');
    }
    const key = createHash('sha256').update(secret).digest();
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivBase64, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tagBase64, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payloadBase64, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }
}

function normalizeToken(token: string): string {
  const numeric = Number(token);
  if (!Number.isFinite(numeric)) {
    return token;
  }
  return Math.floor(numeric).toString().padStart(6, '0');
}

export class OTPUtils {
  async newSecret(username: string, issuer = 'Sean Tour') {
    const secret = randomBytes(20).toString('hex');
    const otpauth =
      `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(username)}` +
      `?secret=${secret}&issuer=${encodeURIComponent(issuer)}&period=30&digits=6`;

    return {
      secret,
      otpauth,
      imageUrl: '',
    };
  }

  verifyToken(token: string, secret: string): boolean {
    const current = this.generateToken(secret, 0);
    const prev = this.generateToken(secret, -1);
    const next = this.generateToken(secret, 1);
    const normalized = normalizeToken(token);
    return normalized === current || normalized === prev || normalized === next;
  }

  private generateToken(secret: string, offsetWindow: number): string {
    const step = 30;
    const counter = Math.floor(Date.now() / 1000 / step) + offsetWindow;
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigUInt64BE(BigInt(counter), 0);

    const secretHash = createHash('sha1').update(secret).digest();
    const hmac = createHash('sha1')
      .update(Buffer.concat([secretHash, counterBuffer]))
      .digest();

    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    return (binary % 1_000_000).toString().padStart(6, '0');
  }
}

type SearchFilter = {
  contains?: Record<string, unknown>;
};

type SearchResult = {
  data: any[];
};

class InMemoryKVDatabase {
  private static readonly tableStore = new Map<string, Map<string, unknown>>();
  protected readonly store: Map<string, unknown>;

  constructor(
    protected readonly dbUrl = ':memory:',
    protected readonly tableName = 'default',
  ) {
    const tableKey = `${dbUrl}:${tableName}`;
    if (!InMemoryKVDatabase.tableStore.has(tableKey)) {
      InMemoryKVDatabase.tableStore.set(tableKey, new Map());
    }
    this.store = InMemoryKVDatabase.tableStore.get(tableKey) as Map<
      string,
      unknown
    >;
  }

  async put(key: string, value: any): Promise<void> {
    this.store.set(key, value);
  }

  async get<T = any>(key: string): Promise<T | undefined> {
    return this.store.get(key) as T | undefined;
  }

  async merge(key: string, value: any): Promise<void> {
    const current = (await this.get<any>(key)) ?? {};
    const merged =
      typeof current === 'object' && current !== null
        ? { ...current, ...value }
        : value;
    this.store.set(key, merged);
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async searchJson(filter: SearchFilter): Promise<SearchResult> {
    const contains = filter.contains ?? {};
    const data: any[] = [];

    for (const [key, value] of this.store.entries()) {
      if (!value || typeof value !== 'object') {
        continue;
      }

      const row = value as any;
      const matched = Object.entries(contains).every(
        ([queryKey, queryValue]) => row[queryKey] === queryValue,
      );

      if (matched) {
        data.push({ key, ...row });
      }
    }

    return { data };
  }

  async close(): Promise<void> {
    return;
  }
}

export enum SqliteValueType {
  JSON = 'json',
  TEXT = 'text',
}

export class SqliteKVDatabase extends InMemoryKVDatabase {
  constructor(
    dbUrl = ':memory:',
    tableName = 'default',
    protected readonly _valueType: SqliteValueType = SqliteValueType.JSON,
  ) {
    super(dbUrl, tableName);
  }
}

export class PGKVDatabase extends InMemoryKVDatabase {}

export function createCacheDecorator(
  db: Pick<SqliteKVDatabase, 'get' | 'put'>,
) {
  return function <T extends (...args: any[]) => any>(
    fn: T,
    getKey?: (...args: Parameters<T>) => string,
  ) {
    return async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
      const cacheKey = getKey ? getKey(...args) : JSON.stringify(args);
      const cached = await db.get(cacheKey);

      if (cached !== undefined) {
        return cached as Awaited<ReturnType<T>>;
      }

      const result = await fn(...args);
      await db.put(cacheKey, result);
      return result as Awaited<ReturnType<T>>;
    };
  };
}
