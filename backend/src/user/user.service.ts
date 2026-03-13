import { Injectable } from '@nestjs/common';
import { DBService, PGKVDatabase } from '../common/db.service';
import { config } from '../config';
import { CryptoHelper } from '../helpers/encodeUtils/cryptoHelper';
import { NotificationType } from '../notification/dto/notification-type.enum';
import { NotificationService } from '../notification/notification.service';
import { UpsertUserProfileInput } from './dto/upsert-user-profile.input';
import { UserDataExport } from './dto/user-data-export.dto';
import { UserProfile } from './dto/user-profile.dto';

type UserProfileRecord = {
  entityType: 'USER_PROFILE';
  userId: string;
  fullName?: string;
  email?: string;
  phoneEncrypted?: string;
  passportNumberEncrypted?: string;
  passportCountry?: string;
  emergencyContactName?: string;
  emergencyContactPhoneEncrypted?: string;
  preferredLanguage?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class UserProfileService {
  private readonly travelDB: PGKVDatabase;
  private readonly encryptionSecret: string;

  constructor(
    private readonly dbService: DBService,
    private readonly notificationService: NotificationService,
  ) {
    this.travelDB = this.dbService.getDBInstance('travel_kv');
    this.encryptionSecret =
      config.privacy.DATA_SECRET.trim() || config.auth.JWT_SECRET;
  }

  async getMyProfile(identity: {
    userId: string;
    email?: string;
  }): Promise<UserProfile> {
    const record = await this.getProfileRecord(identity.userId);

    if (!record) {
      const now = new Date().toISOString();
      return {
        userId: identity.userId,
        fullName: undefined,
        email: identity.email,
        phone: undefined,
        passportNumber: undefined,
        passportNumberMasked: undefined,
        passportCountry: undefined,
        emergencyContactName: undefined,
        emergencyContactPhone: undefined,
        preferredLanguage: undefined,
        notes: undefined,
        createdAt: now,
        updatedAt: now,
      };
    }

    return this.toUserProfile(record, identity.email);
  }

  async upsertMyProfile(
    identity: {
      userId: string;
      email?: string;
    },
    input: UpsertUserProfileInput,
  ): Promise<UserProfile> {
    const existing = await this.getProfileRecord(identity.userId);
    const now = new Date().toISOString();

    const record: UserProfileRecord = {
      entityType: 'USER_PROFILE',
      userId: identity.userId,
      fullName:
        this.normalizeOptionalText(input.fullName) ?? existing?.fullName,
      email:
        this.normalizeOptionalText(input.email) ??
        existing?.email ??
        identity.email,
      phoneEncrypted: this.encryptOptional(
        this.normalizeOptionalText(input.phone),
        existing?.phoneEncrypted,
      ),
      passportNumberEncrypted: this.encryptOptional(
        this.normalizeOptionalText(input.passportNumber),
        existing?.passportNumberEncrypted,
      ),
      passportCountry:
        this.normalizeOptionalText(input.passportCountry) ??
        existing?.passportCountry,
      emergencyContactName:
        this.normalizeOptionalText(input.emergencyContactName) ??
        existing?.emergencyContactName,
      emergencyContactPhoneEncrypted: this.encryptOptional(
        this.normalizeOptionalText(input.emergencyContactPhone),
        existing?.emergencyContactPhoneEncrypted,
      ),
      preferredLanguage:
        this.normalizeOptionalText(input.preferredLanguage) ??
        existing?.preferredLanguage,
      notes: this.normalizeOptionalText(input.notes) ?? existing?.notes,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await this.travelDB.put(`user_profile:${identity.userId}`, record);
    await this.notificationService.createNotification({
      userId: identity.userId,
      type: NotificationType.PROFILE,
      title: 'Profile updated',
      message: 'Your traveler profile has been saved.',
      targetPath: '/profile',
    });

    return this.toUserProfile(record, identity.email);
  }

  async exportMyData(identity: {
    userId: string;
    email?: string;
  }): Promise<UserDataExport> {
    const profile = await this.getMyProfile(identity);
    const notifications =
      await this.notificationService.exportNotificationsByUser(identity.userId);
    const exportedAt = new Date().toISOString();

    return {
      userId: identity.userId,
      exportedAt,
      payloadJson: JSON.stringify(
        {
          profile,
          notifications,
        },
        null,
        2,
      ),
    };
  }

  async deleteMyData(userId: string): Promise<boolean> {
    await this.travelDB.delete(`user_profile:${userId}`);
    await this.notificationService.deleteNotificationsByUser(userId);
    return true;
  }

  private async getProfileRecord(
    userId: string,
  ): Promise<UserProfileRecord | null> {
    const value = await this.travelDB.get<UserProfileRecord>(
      `user_profile:${userId}`,
    );

    if (!value || value.entityType !== 'USER_PROFILE') {
      return null;
    }

    return value;
  }

  private toUserProfile(
    record: UserProfileRecord,
    fallbackEmail?: string,
  ): UserProfile {
    const passportNumber = this.decryptOptional(record.passportNumberEncrypted);

    return {
      userId: record.userId,
      fullName: record.fullName,
      email: record.email || fallbackEmail,
      phone: this.decryptOptional(record.phoneEncrypted),
      passportNumber,
      passportNumberMasked: this.maskPassportNumber(passportNumber),
      passportCountry: record.passportCountry,
      emergencyContactName: record.emergencyContactName,
      emergencyContactPhone: this.decryptOptional(
        record.emergencyContactPhoneEncrypted,
      ),
      preferredLanguage: record.preferredLanguage,
      notes: record.notes,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private encryptOptional(
    nextValue: string | undefined,
    fallbackValue?: string,
  ): string | undefined {
    if (nextValue === undefined) {
      return fallbackValue;
    }

    if (!nextValue) {
      return undefined;
    }

    return CryptoHelper.encryptAES(nextValue, this.encryptionSecret);
  }

  private decryptOptional(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }

    return CryptoHelper.decryptAES(value, this.encryptionSecret);
  }

  private maskPassportNumber(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }

    const suffix = value.slice(-4);
    return `${'*'.repeat(Math.max(value.length - 4, 0))}${suffix}`;
  }

  private normalizeOptionalText(value?: string): string | undefined {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }
}
