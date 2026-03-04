import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BookingService } from '../booking/booking.service';
import { BookingStatus } from '../booking/dto/booking-status.enum';
import { DBService, PGKVDatabase } from '../common/db.service';
import { ServiceType } from '../catalog/dto/service-type.enum';
import { AdminAssistantSessionListInput } from './dto/admin-assistant-session-list.input';
import { AdminUpdateAssistantSessionInput } from './dto/admin-update-assistant-session.input';
import { AssistantSessionListInput } from './dto/assistant-session-list.input';
import { AssistantSessionPage } from './dto/assistant-session-page.dto';
import { AssistantSessionStatus } from './dto/assistant-session-status.enum';
import { AssistantSession } from './dto/assistant-session.dto';
import { RequestAssistantSessionInput } from './dto/request-assistant-session.input';

type AssistantSessionRecord = AssistantSession & {
  entityType: 'ASSISTANT_SESSION';
};

type SearchJsonRow = {
  key: string;
  value: unknown;
  created_at?: Date;
  updated_at?: Date;
};

const REQUEST_ALLOWED_BOOKING_STATUS: BookingStatus[] = [
  BookingStatus.PAID,
  BookingStatus.CONFIRMED,
  BookingStatus.IN_SERVICE,
  BookingStatus.COMPLETED,
];

@Injectable()
export class AssistantService {
  private readonly travelDB: PGKVDatabase;

  constructor(
    private readonly bookingService: BookingService,
    private readonly dbService: DBService,
  ) {
    this.travelDB = this.dbService.getDBInstance('travel_kv');
  }

  async requestAssistantSession(
    userId: string,
    input: RequestAssistantSessionInput,
  ): Promise<AssistantSession> {
    const bookingId = this.requireText(input.bookingId, 'bookingId');
    const booking = await this.bookingService.getBookingByIdForUser(
      userId,
      bookingId,
    );

    if (booking.serviceType !== ServiceType.ASSISTANT) {
      throw new BadRequestException(
        'assistant session is only available for ASSISTANT bookings',
      );
    }

    if (!REQUEST_ALLOWED_BOOKING_STATUS.includes(booking.status)) {
      throw new BadRequestException(
        'assistant session can only be requested after payment',
      );
    }

    const existing = await this.findLatestSessionByBooking(userId, bookingId);
    if (existing && existing.status !== AssistantSessionStatus.CANCELED) {
      return this.toAssistantSession(existing);
    }

    const now = new Date().toISOString();
    const record: AssistantSessionRecord = {
      entityType: 'ASSISTANT_SESSION',
      id: this.generateSessionId(),
      bookingId,
      userId,
      serviceId: booking.serviceId,
      serviceTitle: booking.serviceSnapshot.title,
      city: booking.serviceSnapshot.city,
      language: this.resolveLanguage(input.language),
      topic: this.requireText(input.topic, 'topic'),
      preferredContact: this.requireText(
        input.preferredContact,
        'preferredContact',
      ),
      preferredTimeSlots: this.requireStringArray(
        input.preferredTimeSlots,
        'preferredTimeSlots',
      ),
      status: AssistantSessionStatus.REQUESTED,
      assignedAgent: undefined,
      internalNote: undefined,
      createdAt: now,
      updatedAt: now,
    };

    await this.travelDB.put(`assistant_session:${record.id}`, record);
    return this.toAssistantSession(record);
  }

  async listMyAssistantSessions(
    userId: string,
    input?: AssistantSessionListInput,
  ): Promise<AssistantSessionPage> {
    const limit = Math.min(Math.max(input?.page?.limit ?? 10, 1), 50);
    const offset = Math.max(input?.page?.offset ?? 0, 0);

    const contains: Record<string, unknown> = {
      entityType: 'ASSISTANT_SESSION',
      userId,
    };

    if (input?.bookingId?.trim()) {
      contains.bookingId = input.bookingId.trim();
    }

    if (input?.status) {
      contains.status = input.status;
    }

    const result = await this.travelDB.searchJson({
      contains,
      limit,
      offset,
      include_total: true,
      order_by: 'DESC',
      order_by_field: 'created_at',
    });

    const items = (result.data as SearchJsonRow[])
      .map((row) => this.toAssistantSessionRecord(row.value))
      .filter((row): row is AssistantSessionRecord => row !== null)
      .map((row) => this.toAssistantSession(row));

    const total = result.total ?? items.length;

    return {
      items,
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    };
  }

  async getAssistantSessionDetailForUser(
    userId: string,
    sessionId: string,
  ): Promise<AssistantSession> {
    const record = await this.getSessionRecordById(sessionId);

    if (record.userId !== userId) {
      throw new ForbiddenException('Assistant session access denied');
    }

    return this.toAssistantSession(record);
  }

  async adminListAssistantSessions(
    input?: AdminAssistantSessionListInput,
  ): Promise<AssistantSessionPage> {
    const limit = Math.min(Math.max(input?.page?.limit ?? 20, 1), 100);
    const offset = Math.max(input?.page?.offset ?? 0, 0);

    const contains: Record<string, unknown> = {
      entityType: 'ASSISTANT_SESSION',
    };

    if (input?.sessionId?.trim()) {
      contains.id = input.sessionId.trim();
    }

    if (input?.bookingId?.trim()) {
      contains.bookingId = input.bookingId.trim();
    }

    if (input?.userId?.trim()) {
      contains.userId = input.userId.trim();
    }

    if (input?.status) {
      contains.status = input.status;
    }

    const result = await this.travelDB.searchJson({
      contains,
      limit,
      offset,
      include_total: true,
      order_by: 'DESC',
      order_by_field: 'created_at',
    });

    const items = (result.data as SearchJsonRow[])
      .map((row) => this.toAssistantSessionRecord(row.value))
      .filter((row): row is AssistantSessionRecord => row !== null)
      .map((row) => this.toAssistantSession(row));

    const total = result.total ?? items.length;

    return {
      items,
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    };
  }

  async adminUpdateAssistantSession(
    input: AdminUpdateAssistantSessionInput,
  ): Promise<AssistantSession> {
    const sessionId = this.requireText(input.sessionId, 'sessionId');
    const record = await this.getSessionRecordById(sessionId);

    const updated: AssistantSessionRecord = {
      ...record,
      status: input.status,
      assignedAgent:
        input.assignedAgent !== undefined
          ? input.assignedAgent.trim() || undefined
          : record.assignedAgent,
      internalNote:
        input.internalNote !== undefined
          ? input.internalNote.trim() || undefined
          : record.internalNote,
      updatedAt: new Date().toISOString(),
    };

    await this.travelDB.put(`assistant_session:${updated.id}`, updated);
    return this.toAssistantSession(updated);
  }

  private async findLatestSessionByBooking(
    userId: string,
    bookingId: string,
  ): Promise<AssistantSessionRecord | null> {
    const result = await this.travelDB.searchJson({
      contains: {
        entityType: 'ASSISTANT_SESSION',
        userId,
        bookingId,
      },
      limit: 1,
      order_by: 'DESC',
      order_by_field: 'created_at',
    });

    const rows = result.data as SearchJsonRow[];
    if (rows.length === 0) {
      return null;
    }

    return this.toAssistantSessionRecord(rows[0].value);
  }

  private async getSessionRecordById(
    sessionId: string,
  ): Promise<AssistantSessionRecord> {
    const normalizedId = this.requireText(sessionId, 'sessionId');
    const value = await this.travelDB.get<AssistantSessionRecord>(
      `assistant_session:${normalizedId}`,
    );
    const record = this.toAssistantSessionRecord(value);

    if (!record) {
      throw new NotFoundException(
        `Assistant session ${normalizedId} not found`,
      );
    }

    return record;
  }

  private toAssistantSessionRecord(
    value: unknown,
  ): AssistantSessionRecord | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const candidate = value as Partial<AssistantSessionRecord>;
    if (candidate.entityType !== 'ASSISTANT_SESSION') {
      return null;
    }

    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.bookingId !== 'string' ||
      typeof candidate.userId !== 'string' ||
      typeof candidate.serviceId !== 'string' ||
      typeof candidate.serviceTitle !== 'string' ||
      typeof candidate.city !== 'string' ||
      typeof candidate.language !== 'string' ||
      typeof candidate.topic !== 'string' ||
      typeof candidate.preferredContact !== 'string' ||
      !Array.isArray(candidate.preferredTimeSlots) ||
      typeof candidate.status !== 'string' ||
      typeof candidate.createdAt !== 'string' ||
      typeof candidate.updatedAt !== 'string'
    ) {
      return null;
    }

    return candidate as AssistantSessionRecord;
  }

  private toAssistantSession(record: AssistantSessionRecord): AssistantSession {
    const { entityType, ...session } = record;
    void entityType;
    return session;
  }

  private requireText(value: string, fieldName: string): string {
    const normalized = value?.trim();
    if (!normalized) {
      throw new BadRequestException(`${fieldName} is required`);
    }

    return normalized;
  }

  private requireStringArray(values: string[], fieldName: string): string[] {
    if (!Array.isArray(values)) {
      throw new BadRequestException(
        `${fieldName} must contain at least 1 item`,
      );
    }

    const normalized = values
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter((value) => !!value);

    const unique = Array.from(new Set(normalized));
    if (unique.length === 0) {
      throw new BadRequestException(
        `${fieldName} must contain at least 1 item`,
      );
    }

    return unique;
  }

  private resolveLanguage(language: string | undefined): string {
    const normalized = language?.trim();
    if (normalized) {
      return normalized;
    }

    return 'English';
  }

  private generateSessionId(): string {
    return `asst_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
  }
}
