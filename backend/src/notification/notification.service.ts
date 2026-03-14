import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DBService, PGKVDatabase } from '../common/db.service';
import { Notification } from './dto/notification.dto';
import { NotificationListInput } from './dto/notification-list.input';
import { NotificationPage } from './dto/notification-page.dto';
import { NotificationType } from './dto/notification-type.enum';

type NotificationRecord = Notification & {
  entityType: 'NOTIFICATION';
};

type SearchJsonRow = {
  key: string;
  value: unknown;
  created_at?: Date;
  updated_at?: Date;
};

const NOTIFICATION_SEARCH_BATCH_SIZE = 200;

@Injectable()
export class NotificationService {
  private readonly travelDB: PGKVDatabase;

  constructor(private readonly dbService: DBService) {
    this.travelDB = this.dbService.getDBInstance('travel_kv');
  }

  async createNotification(params: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    targetPath?: string;
  }): Promise<Notification> {
    const now = new Date().toISOString();
    const record: NotificationRecord = {
      entityType: 'NOTIFICATION',
      id: `ntf_${randomUUID().replace(/-/g, '').slice(0, 14)}`,
      userId: params.userId,
      type: params.type,
      title: params.title.trim(),
      message: params.message.trim(),
      targetPath: params.targetPath?.trim() || undefined,
      readAt: undefined,
      createdAt: now,
      updatedAt: now,
    };

    await this.travelDB.put(`notification:${record.id}`, record);
    return this.toNotification(record);
  }

  async listMyNotifications(
    userId: string,
    input?: NotificationListInput,
  ): Promise<NotificationPage> {
    const limit = Math.min(Math.max(input?.page?.limit ?? 20, 1), 100);
    const offset = Math.max(input?.page?.offset ?? 0, 0);

    const contains: Record<string, unknown> = {
      entityType: 'NOTIFICATION',
      userId,
    };

    if (input?.type) {
      contains.type = input.type;
    }

    if (!input?.unreadOnly) {
      const result = await this.travelDB.searchJson({
        contains,
        limit,
        offset,
        include_total: true,
        order_by: 'DESC',
        order_by_field: 'created_at',
      });

      const items = (result.data as SearchJsonRow[])
        .map((row) => this.toNotificationRecord(row.value))
        .filter((row): row is NotificationRecord => row !== null)
        .map((record) => this.toNotification(record));
      const total = result.total ?? items.length;

      return {
        items,
        total,
        limit,
        offset,
        hasMore: offset + items.length < total,
      };
    }

    const unreadRecords = await this.listUnreadNotificationRecords(contains);
    const pageItems = unreadRecords
      .slice(offset, offset + limit)
      .map((record) => this.toNotification(record));

    return {
      items: pageItems,
      total: unreadRecords.length,
      limit,
      offset,
      hasMore: offset + pageItems.length < unreadRecords.length,
    };
  }

  async markNotificationRead(
    userId: string,
    notificationId: string,
  ): Promise<Notification> {
    const record = await this.getNotificationRecord(notificationId);

    if (record.userId !== userId) {
      throw new NotFoundException(`Notification ${notificationId} not found`);
    }

    if (record.readAt) {
      return this.toNotification(record);
    }

    const updated: NotificationRecord = {
      ...record,
      readAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.travelDB.put(`notification:${updated.id}`, updated);
    return this.toNotification(updated);
  }

  async exportNotificationsByUser(userId: string): Promise<Notification[]> {
    const exported: Notification[] = [];
    let offset = 0;

    while (true) {
      const page = await this.listMyNotifications(userId, {
        page: {
          limit: 100,
          offset,
        },
      });
      exported.push(...page.items);

      if (!page.hasMore) {
        return exported;
      }

      offset += page.items.length;
    }
  }

  async deleteNotificationsByUser(userId: string): Promise<number> {
    const records =
      await this.travelDB.getWithPrefix<NotificationRecord>('notification:');

    const matches = Object.values(records)
      .map((value) => this.toNotificationRecord(value))
      .filter(
        (value): value is NotificationRecord =>
          value !== null && value.userId === userId,
      );

    await Promise.all(
      matches.map((record) =>
        this.travelDB.delete(`notification:${record.id}`),
      ),
    );

    return matches.length;
  }

  private async getNotificationRecord(
    notificationId: string,
  ): Promise<NotificationRecord> {
    const value = await this.travelDB.get<NotificationRecord>(
      `notification:${notificationId}`,
    );
    const record = this.toNotificationRecord(value);

    if (!record) {
      throw new NotFoundException(`Notification ${notificationId} not found`);
    }

    return record;
  }

  private async listUnreadNotificationRecords(
    contains: Record<string, unknown>,
  ): Promise<NotificationRecord[]> {
    const unreadRecords: NotificationRecord[] = [];
    let offset = 0;

    while (true) {
      const result = await this.travelDB.searchJson({
        contains,
        limit: NOTIFICATION_SEARCH_BATCH_SIZE,
        offset,
        order_by: 'DESC',
        order_by_field: 'created_at',
      });
      const batch = (result.data as SearchJsonRow[])
        .map((row) => this.toNotificationRecord(row.value))
        .filter((row): row is NotificationRecord => row !== null);

      unreadRecords.push(...batch.filter((row) => !row.readAt));

      if (batch.length < NOTIFICATION_SEARCH_BATCH_SIZE) {
        return unreadRecords;
      }

      offset += batch.length;
    }
  }

  private toNotificationRecord(value: unknown): NotificationRecord | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const candidate = value as Partial<NotificationRecord>;
    if (candidate.entityType !== 'NOTIFICATION') {
      return null;
    }

    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.userId !== 'string' ||
      typeof candidate.type !== 'string' ||
      typeof candidate.title !== 'string' ||
      typeof candidate.message !== 'string' ||
      typeof candidate.createdAt !== 'string' ||
      typeof candidate.updatedAt !== 'string'
    ) {
      return null;
    }

    return candidate as NotificationRecord;
  }

  private toNotification(record: NotificationRecord): Notification {
    return {
      id: record.id,
      userId: record.userId,
      type: record.type,
      title: record.title,
      message: record.message,
      targetPath: record.targetPath,
      readAt: record.readAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
