import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DBService, PGKVDatabase } from '../common/db.service';
import { config } from '../config';
import {
  buildAdminActor,
  isAdminUser,
  normalizeAdminEmail,
} from './admin-access.util';

export type RoleAccessRole = 'ADMIN' | 'SUPPORT_AGENT';

export type RoleAccessEntry = {
  id: string;
  role: RoleAccessRole;
  principalType: 'USER_ID' | 'EMAIL';
  principalValue: string;
  userId?: string;
  email?: string;
  displayName?: string;
  note?: string;
  source: 'ENV' | 'DB';
  enabled: boolean;
  editable: boolean;
  grantedBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type SetRoleAccessInput = {
  userId?: string;
  email?: string;
  displayName?: string;
  note?: string;
  enabled: boolean;
};

type RoleAccessRecord = {
  entityType: 'ROLE_ACCESS';
  role: RoleAccessRole;
  id: string;
  principalType: 'USER_ID' | 'EMAIL';
  principalValue: string;
  userId?: string;
  email?: string;
  displayName?: string;
  note?: string;
  enabled: boolean;
  grantedBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
};

type LegacyAdminAccessRecord = {
  entityType: 'ADMIN_ACCESS';
  id: string;
  principalType: 'USER_ID' | 'EMAIL';
  principalValue: string;
  userId?: string;
  email?: string;
  displayName?: string;
  note?: string;
  enabled: boolean;
  grantedBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
};

type LegacySupportAgentRecord = {
  entityType: 'SUPPORT_AGENT';
  userId: string;
  displayName?: string;
  email?: string;
  note?: string;
  enabled: boolean;
  isActive: boolean;
  lastAssignedAt?: string;
  grantedBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
};

type StoredRow = {
  value: unknown;
  created_at?: Date;
  updated_at?: Date;
};

@Injectable()
export class RoleAccessService {
  private readonly travelDB: PGKVDatabase;

  constructor(dbService: DBService) {
    this.travelDB = dbService.getDBInstance('travel_kv');
  }

  async isRoleGranted(
    role: RoleAccessRole,
    identity: {
      userId?: string;
      email?: string;
    },
  ): Promise<boolean> {
    if (
      role === 'ADMIN' &&
      isAdminUser({
        user_id: identity.userId,
        email: identity.email,
      })
    ) {
      return true;
    }

    const userId = this.normalizeOptionalText(identity.userId);
    if (userId) {
      const byUserId = await this.getRoleEntryByUserId(role, userId);
      if (byUserId?.enabled) {
        return true;
      }
    }

    const email = this.normalizeOptionalEmail(identity.email);
    if (email) {
      const byEmail = await this.getRoleEntryByEmail(role, email);
      if (byEmail?.enabled) {
        return true;
      }
    }

    return false;
  }

  async listRoleEntries(role: RoleAccessRole): Promise<RoleAccessEntry[]> {
    const envEntries = this.listEnvEntries(role);
    const envIds = new Set(envEntries.map((item) => item.id));
    const dbEntries = (await this.listRoleRecords(role))
      .filter((record) => !envIds.has(record.id))
      .map((record) => this.toRoleAccessEntry(record));

    return [...envEntries, ...dbEntries].sort((left, right) => {
      if (left.source !== right.source) {
        return left.source.localeCompare(right.source);
      }

      return (
        (right.updatedAt || right.createdAt || '').localeCompare(
          left.updatedAt || left.createdAt || '',
        ) ||
        (
          left.displayName ||
          left.email ||
          left.userId ||
          left.id
        ).localeCompare(
          right.displayName || right.email || right.userId || right.id,
        )
      );
    });
  }

  async getRoleEntryByUserId(
    role: RoleAccessRole,
    userId: string,
  ): Promise<RoleAccessEntry | null> {
    const normalizedUserId = this.normalizeOptionalText(userId);
    if (!normalizedUserId) {
      return null;
    }

    const record = await this.getRoleRecord(role, `user:${normalizedUserId}`);
    return record ? this.toRoleAccessEntry(record) : null;
  }

  async getRoleEntryByEmail(
    role: RoleAccessRole,
    email: string,
  ): Promise<RoleAccessEntry | null> {
    const normalizedEmail = this.normalizeOptionalEmail(email);
    if (!normalizedEmail) {
      return null;
    }

    const record = await this.getRoleRecord(role, `email:${normalizedEmail}`);
    return record ? this.toRoleAccessEntry(record) : null;
  }

  async setRoleAccess(
    role: RoleAccessRole,
    input: SetRoleAccessInput,
    actorUser: Record<string, unknown> | undefined,
    options?: {
      requireUserId?: boolean;
      protectLastAdmin?: boolean;
    },
  ): Promise<RoleAccessEntry> {
    const userId = this.normalizeOptionalText(input.userId);
    const email = this.normalizeOptionalEmail(input.email);

    if (options?.requireUserId && !userId) {
      throw new BadRequestException('userId is required');
    }

    if (!userId && !email) {
      throw new BadRequestException('userId or email is required');
    }

    const recordId = userId ? `user:${userId}` : `email:${email}`;
    if (this.isEnvManagedRecord(role, recordId)) {
      throw new ForbiddenException(
        'Environment-managed role access must be updated in backend env config',
      );
    }

    const existing = await this.getRoleRecord(role, recordId);
    if (!input.enabled && !existing) {
      throw new NotFoundException('Role access entry not found');
    }

    if (
      role === 'ADMIN' &&
      options?.protectLastAdmin &&
      existing?.enabled &&
      !input.enabled
    ) {
      await this.assertNotRemovingLastAdmin(recordId);
    }

    const actor = buildAdminActor(actorUser);
    const now = new Date().toISOString();
    const record: RoleAccessRecord = {
      entityType: 'ROLE_ACCESS',
      role,
      id: recordId,
      principalType: userId ? 'USER_ID' : 'EMAIL',
      principalValue: userId || email || '',
      userId,
      email,
      displayName:
        this.normalizeOptionalText(input.displayName) ?? existing?.displayName,
      note: this.normalizeOptionalText(input.note) ?? existing?.note,
      enabled: input.enabled,
      grantedBy: existing?.grantedBy ?? actor,
      updatedBy: actor,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await this.travelDB.put(this.buildRoleAccessKey(role, record.id), record);
    return this.toRoleAccessEntry(record);
  }

  private async assertNotRemovingLastAdmin(recordId: string): Promise<void> {
    const effective = new Set(
      this.listEnvEntries('ADMIN').map((item) => item.id),
    );
    const dbRecords = await this.listRoleRecords('ADMIN');

    for (const record of dbRecords) {
      if (!record.enabled || record.id === recordId) {
        continue;
      }

      effective.add(record.id);
    }

    if (effective.size === 0) {
      throw new ForbiddenException(
        'At least one admin access entry must remain enabled',
      );
    }
  }

  private listEnvEntries(role: RoleAccessRole): RoleAccessEntry[] {
    if (role !== 'ADMIN') {
      return [];
    }

    const envEntries: RoleAccessEntry[] = [];
    const now = undefined;

    for (const userId of this.parseCsv(config.auth.ADMIN_USER_IDS)) {
      envEntries.push({
        id: `user:${userId}`,
        role,
        principalType: 'USER_ID',
        principalValue: userId,
        userId,
        email: undefined,
        displayName: undefined,
        note: 'Bootstrap admin from backend env',
        source: 'ENV',
        enabled: true,
        editable: false,
        grantedBy: 'env',
        updatedBy: 'env',
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const email of this.parseCsv(config.auth.ADMIN_USER_EMAILS).map(
      normalizeAdminEmail,
    )) {
      envEntries.push({
        id: `email:${email}`,
        role,
        principalType: 'EMAIL',
        principalValue: email,
        userId: undefined,
        email,
        displayName: undefined,
        note: 'Bootstrap admin from backend env',
        source: 'ENV',
        enabled: true,
        editable: false,
        grantedBy: 'env',
        updatedBy: 'env',
        createdAt: now,
        updatedAt: now,
      });
    }

    return envEntries;
  }

  private isEnvManagedRecord(role: RoleAccessRole, recordId: string): boolean {
    return this.listEnvEntries(role).some((item) => item.id === recordId);
  }

  private async listRoleRecords(
    role: RoleAccessRole,
  ): Promise<RoleAccessRecord[]> {
    const records = new Map<string, RoleAccessRecord>();

    for (const record of await this.listLegacyRoleRecords(role)) {
      records.set(record.id, record);
    }

    for (const record of await this.listNewRoleRecords(role)) {
      records.set(record.id, record);
    }

    return [...records.values()].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
  }

  private async listNewRoleRecords(
    role: RoleAccessRole,
  ): Promise<RoleAccessRecord[]> {
    const result = await this.travelDB.getWithPrefix<unknown>(
      `${this.buildRoleAccessKey(role, '')}`,
    );

    return Object.values(result)
      .map((value) => this.normalizeStoredRoleAccessRecord(value, role))
      .filter((value): value is RoleAccessRecord => !!value);
  }

  private async listLegacyRoleRecords(
    role: RoleAccessRole,
  ): Promise<RoleAccessRecord[]> {
    const prefix = role === 'ADMIN' ? 'admin_access:' : 'support_agent:';
    const result = await this.travelDB.getWithPrefix<unknown>(prefix);

    return Object.values(result)
      .map((value) =>
        role === 'ADMIN'
          ? this.normalizeLegacyAdminAccessRecord(value)
          : this.normalizeLegacySupportAgentRecord(value),
      )
      .filter((value): value is RoleAccessRecord => !!value);
  }

  private async getRoleRecord(
    role: RoleAccessRole,
    recordId: string,
  ): Promise<RoleAccessRecord | null> {
    const current = await this.travelDB.get<unknown>(
      this.buildRoleAccessKey(role, recordId),
    );
    const currentRecord = this.normalizeRoleAccessRecord(current, role);
    if (currentRecord) {
      return currentRecord;
    }

    if (role === 'ADMIN') {
      const legacy = await this.travelDB.get<unknown>(
        `admin_access:${recordId}`,
      );
      return this.normalizeLegacyAdminAccessRecord(legacy);
    }

    if (!recordId.startsWith('user:')) {
      return null;
    }

    const legacy = await this.travelDB.get<unknown>(
      `support_agent:${recordId.slice(5)}`,
    );
    return this.normalizeLegacySupportAgentRecord(legacy);
  }

  private buildRoleAccessKey(role: RoleAccessRole, recordId: string): string {
    return `role_access:${role}:${recordId}`;
  }

  private toRoleAccessEntry(record: RoleAccessRecord): RoleAccessEntry {
    return {
      id: record.id,
      role: record.role,
      principalType: record.principalType,
      principalValue: record.principalValue,
      userId: record.userId,
      email: record.email,
      displayName: record.displayName,
      note: record.note,
      source: 'DB',
      enabled: record.enabled,
      editable: true,
      grantedBy: record.grantedBy,
      updatedBy: record.updatedBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private normalizeStoredRoleAccessRecord(
    value: unknown,
    role: RoleAccessRole,
  ): RoleAccessRecord | null {
    return this.normalizeRoleAccessRecord(this.unwrapStoredValue(value), role);
  }

  private unwrapStoredValue(value: unknown): unknown {
    if (!value || typeof value !== 'object' || !('value' in value)) {
      return value;
    }

    return (value as StoredRow).value;
  }

  private normalizeRoleAccessRecord(
    value: unknown,
    role: RoleAccessRole,
  ): RoleAccessRecord | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const candidate = value as Partial<RoleAccessRecord>;
    if (candidate.entityType !== 'ROLE_ACCESS' || candidate.role !== role) {
      return null;
    }

    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.principalType !== 'string' ||
      typeof candidate.principalValue !== 'string' ||
      typeof candidate.enabled !== 'boolean' ||
      typeof candidate.createdAt !== 'string' ||
      typeof candidate.updatedAt !== 'string'
    ) {
      return null;
    }

    return candidate as RoleAccessRecord;
  }

  private normalizeLegacyAdminAccessRecord(
    value: unknown,
  ): RoleAccessRecord | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const candidate = value as Partial<LegacyAdminAccessRecord>;
    if (candidate.entityType !== 'ADMIN_ACCESS') {
      return null;
    }

    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.principalType !== 'string' ||
      typeof candidate.principalValue !== 'string' ||
      typeof candidate.enabled !== 'boolean' ||
      typeof candidate.createdAt !== 'string' ||
      typeof candidate.updatedAt !== 'string'
    ) {
      return null;
    }

    return {
      entityType: 'ROLE_ACCESS',
      role: 'ADMIN',
      id: candidate.id,
      principalType: candidate.principalType,
      principalValue: candidate.principalValue,
      userId: candidate.userId,
      email: candidate.email,
      displayName: candidate.displayName,
      note: candidate.note,
      enabled: candidate.enabled,
      grantedBy: candidate.grantedBy,
      updatedBy: candidate.updatedBy,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
    };
  }

  private normalizeLegacySupportAgentRecord(
    value: unknown,
  ): RoleAccessRecord | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const candidate = value as Partial<LegacySupportAgentRecord>;
    if (candidate.entityType !== 'SUPPORT_AGENT') {
      return null;
    }

    if (
      typeof candidate.userId !== 'string' ||
      typeof candidate.enabled !== 'boolean' ||
      typeof candidate.createdAt !== 'string' ||
      typeof candidate.updatedAt !== 'string'
    ) {
      return null;
    }

    return {
      entityType: 'ROLE_ACCESS',
      role: 'SUPPORT_AGENT',
      id: `user:${candidate.userId}`,
      principalType: 'USER_ID',
      principalValue: candidate.userId,
      userId: candidate.userId,
      email: candidate.email,
      displayName: candidate.displayName,
      note: candidate.note,
      enabled: candidate.enabled,
      grantedBy: candidate.grantedBy,
      updatedBy: candidate.updatedBy,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
    };
  }

  private parseCsv(value: string | undefined): string[] {
    return (value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private normalizeOptionalText(value?: string): string | undefined {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }

  private normalizeOptionalEmail(value?: string): string | undefined {
    const normalized = this.normalizeOptionalText(value);
    return normalized ? normalizeAdminEmail(normalized) : undefined;
  }
}
