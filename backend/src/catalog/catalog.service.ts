import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DBService, PGKVDatabase } from '../common/db.service';
import { DeleteServiceInput } from './dto/delete-service.input';
import { ServiceAuditAction } from './dto/service-audit-action.enum';
import { ServiceAuditListInput } from './dto/service-audit-list.input';
import { ServiceAuditLog } from './dto/service-audit-log.dto';
import { ServiceAuditPage } from './dto/service-audit-page.dto';
import { ServiceCapacity } from './dto/service-capacity.dto';
import { ServiceContact } from './dto/service-contact.dto';
import { ServiceResource } from './dto/service-resource.dto';
import { SetServiceStatusInput } from './dto/set-service-status.input';
import { ServiceListInput } from './dto/service-list.input';
import { ServicePage } from './dto/service-page.dto';
import { ServiceType } from './dto/service-type.enum';
import { UpsertServiceInput } from './dto/upsert-service.input';
import {
  AssistantServiceDetail,
  CarServiceDetail,
  GuideServiceDetail,
  PackageServiceDetail,
} from './dto/service-detail.dto';
import { ServiceItem } from './dto/service-item.dto';

type ServiceDetailRecord =
  | (PackageServiceDetail & { __typename: 'PackageServiceDetail' })
  | (GuideServiceDetail & { __typename: 'GuideServiceDetail' })
  | (CarServiceDetail & { __typename: 'CarServiceDetail' })
  | (AssistantServiceDetail & { __typename: 'AssistantServiceDetail' });

type CatalogServiceRecord = {
  entityType: 'SERVICE';
  id: string;
  type: ServiceType;
  title: string;
  city: string;
  description: string;
  images: string[];
  languages: string[];
  basePrice: {
    amount: number;
    currency: string;
  };
  cancellationPolicy?: string;
  availableTimeSlots?: string[];
  capacity?: ServiceCapacity;
  supportContact?: ServiceContact;
  resources?: ServiceResource[];
  voucherTemplate?: string;
  status: string;
  detail: ServiceDetailRecord;
  updatedAt: string;
};

type ServiceAuditRecord = {
  entityType: 'SERVICE_AUDIT';
  id: string;
  serviceId: string;
  action: ServiceAuditAction;
  beforeStatus?: string;
  afterStatus?: string;
  note?: string;
  actor: string;
  createdAt: string;
};

type SearchJsonRow = {
  key: string;
  value: unknown;
  created_at?: Date;
  updated_at?: Date;
};

const CATALOG_SEED: CatalogServiceRecord[] = [
  {
    entityType: 'SERVICE',
    id: 'svc_pkg_beijing_001',
    type: ServiceType.PACKAGE,
    title: 'Beijing 3-Day Culture Explorer',
    city: 'Beijing',
    description:
      'Private city highlights tour covering the Forbidden City, hutongs, and modern art spaces.',
    images: ['https://images.unsplash.com/photo-1547981609-4b6bf67db38a'],
    languages: ['English', 'Chinese'],
    basePrice: { amount: 399, currency: 'USDT' },
    cancellationPolicy: 'Free cancellation up to 72 hours before departure.',
    availableTimeSlots: [
      '2026-04-18 09:00 Beijing',
      '2026-04-25 09:00 Beijing',
      '2026-05-02 09:00 Beijing',
    ],
    capacity: {
      min: 1,
      max: 6,
      remaining: 4,
    },
    supportContact: {
      name: 'Beijing Guest Desk',
      channel: 'WeChat',
      value: 'sean-tour-beijing',
    },
    voucherTemplate:
      'Show booking {bookingId} to the Beijing Guest Desk before departure.',
    status: 'ACTIVE',
    detail: {
      __typename: 'PackageServiceDetail',
      durationDays: 3,
      itinerary: [
        'Day 1: Imperial Beijing',
        'Day 2: Great Wall',
        'Day 3: Art + Food Walk',
      ],
    },
    updatedAt: '2026-03-03T08:00:00.000Z',
  },
  {
    entityType: 'SERVICE',
    id: 'svc_guide_shanghai_001',
    type: ServiceType.GUIDE,
    title: 'Shanghai Local Guide (Full Day)',
    city: 'Shanghai',
    description:
      'Fluent local guide for museums, business meetings, and neighborhood walks.',
    images: ['https://images.unsplash.com/photo-1538428494232-9c0f6f6a438d'],
    languages: ['English', 'Spanish', 'Chinese'],
    basePrice: { amount: 149, currency: 'USDT' },
    cancellationPolicy: 'Free cancellation up to 48 hours before guide start.',
    availableTimeSlots: [
      '2026-04-19 10:00 Shanghai',
      '2026-04-20 14:00 Shanghai',
      '2026-04-22 09:00 Shanghai',
    ],
    capacity: {
      min: 1,
      max: 5,
      remaining: 3,
    },
    supportContact: {
      name: 'Shanghai Guide Ops',
      channel: 'WhatsApp',
      value: '+86-138-0000-1001',
    },
    resources: [
      {
        id: 'guide_sh_amy',
        label: 'Amy Zhang',
        status: 'ACTIVE',
        languages: ['English', 'Chinese'],
        availableTimeSlots: [
          '2026-04-19 10:00 Shanghai',
          '2026-04-22 09:00 Shanghai',
        ],
      },
      {
        id: 'guide_sh_carlos',
        label: 'Carlos Li',
        status: 'ACTIVE',
        languages: ['Spanish', 'English', 'Chinese'],
        availableTimeSlots: ['2026-04-20 14:00 Shanghai'],
      },
    ],
    voucherTemplate:
      'Your guide will verify booking {bookingId} at the first meetup point.',
    status: 'ACTIVE',
    detail: {
      __typename: 'GuideServiceDetail',
      languages: ['English', 'Spanish', 'Chinese'],
      yearsOfExperience: 6,
      certifications: [
        'National Guide Certificate',
        'Business Interpreter Training',
      ],
    },
    updatedAt: '2026-03-03T08:20:00.000Z',
  },
  {
    entityType: 'SERVICE',
    id: 'svc_car_sz_001',
    type: ServiceType.CAR,
    title: 'Shenzhen 7-Seater Chauffeur Service',
    city: 'Shenzhen',
    description:
      'Airport pickup, point-to-point city ride, and full-day custom charter.',
    images: ['https://images.unsplash.com/photo-1503376780353-7e6692767b70'],
    languages: ['English', 'Chinese'],
    basePrice: { amount: 259, currency: 'USDT' },
    cancellationPolicy: 'Free cancellation up to 24 hours before pickup.',
    availableTimeSlots: [
      '2026-04-18 08:00 Shenzhen Airport',
      '2026-04-18 13:00 Shenzhen City',
      '2026-04-19 09:00 Shenzhen Full Day',
    ],
    capacity: {
      min: 1,
      max: 7,
      remaining: 2,
    },
    supportContact: {
      name: 'Shenzhen Transport Ops',
      channel: 'Phone',
      value: '+86-138-0000-1002',
    },
    resources: [
      {
        id: 'car_sz_van_01',
        label: '粤B-A1001 Mercedes V-Class',
        status: 'ACTIVE',
        languages: ['English', 'Chinese'],
        seats: 7,
        availableTimeSlots: [
          '2026-04-18 08:00 Shenzhen Airport',
          '2026-04-19 09:00 Shenzhen Full Day',
        ],
      },
      {
        id: 'car_sz_van_02',
        label: '粤B-A1002 Buick GL8',
        status: 'ACTIVE',
        languages: ['Chinese'],
        seats: 7,
        availableTimeSlots: ['2026-04-18 13:00 Shenzhen City'],
      },
    ],
    voucherTemplate:
      'Driver dispatch uses booking {bookingId}. Keep this code ready at pickup.',
    status: 'ACTIVE',
    detail: {
      __typename: 'CarServiceDetail',
      seats: 7,
      carType: 'Business Van',
      luggageCapacity: '4 large suitcases',
    },
    updatedAt: '2026-03-03T08:35:00.000Z',
  },
  {
    entityType: 'SERVICE',
    id: 'svc_assistant_remote_001',
    type: ServiceType.ASSISTANT,
    title: 'Remote China Assistant (8 Hours)',
    city: 'Remote',
    description:
      'Real human assistant for ticketing, translation, and emergency coordination.',
    images: ['https://images.unsplash.com/photo-1552664730-d307ca884978'],
    languages: ['English', 'Chinese', 'French'],
    basePrice: { amount: 99, currency: 'USDT' },
    cancellationPolicy:
      'Unused assistant hours can be rescheduled within 7 days.',
    availableTimeSlots: [
      '08:00-12:00 China Time',
      '12:00-18:00 China Time',
      '18:00-22:00 China Time',
    ],
    capacity: {
      min: 1,
      max: 4,
      remaining: 3,
    },
    supportContact: {
      name: 'Remote Assistant Desk',
      channel: 'Email',
      value: 'assistant@sean-tour.local',
    },
    resources: [
      {
        id: 'assistant_cn_iris',
        label: 'Iris Chen',
        status: 'ACTIVE',
        languages: ['English', 'Chinese'],
        availableTimeSlots: [
          '08:00-12:00 China Time',
          '12:00-18:00 China Time',
        ],
      },
      {
        id: 'assistant_cn_luc',
        label: 'Luc Martin',
        status: 'ACTIVE',
        languages: ['English', 'French', 'Chinese'],
        availableTimeSlots: ['18:00-22:00 China Time'],
      },
    ],
    voucherTemplate:
      'Assistant activation code for booking {bookingId} will be used in chat handoff.',
    status: 'ACTIVE',
    detail: {
      __typename: 'AssistantServiceDetail',
      supportChannels: ['WeChat', 'WhatsApp', 'Email'],
      serviceHours: '08:00-22:00 China Time',
    },
    updatedAt: '2026-03-03T08:45:00.000Z',
  },
];

@Injectable()
export class CatalogService implements OnModuleInit {
  private readonly travelDB: PGKVDatabase;
  private seedPromise: Promise<void> | null = null;
  private seedReady = false;

  constructor(private readonly dbService: DBService) {
    this.travelDB = this.dbService.getDBInstance('travel_kv');
  }

  async onModuleInit(): Promise<void> {
    await this.ensureSeedData();
  }

  async listServices(input?: ServiceListInput): Promise<ServicePage> {
    await this.ensureSeedData();

    const limit = Math.min(Math.max(input?.page?.limit ?? 10, 1), 50);
    const offset = Math.max(input?.page?.offset ?? 0, 0);
    const city = input?.city?.trim().toLowerCase();
    const language = input?.language?.trim().toLowerCase();
    const requestedDate = this.normalizeDateFilter(input?.date);
    const minPriceAmount = this.normalizeOptionalPriceFilter(
      input?.minPriceAmount,
      'minPriceAmount',
    );
    const maxPriceAmount = this.normalizeOptionalPriceFilter(
      input?.maxPriceAmount,
      'maxPriceAmount',
    );
    const status = input?.status?.trim().toUpperCase();

    if (
      minPriceAmount !== undefined &&
      maxPriceAmount !== undefined &&
      minPriceAmount > maxPriceAmount
    ) {
      throw new BadRequestException(
        'minPriceAmount must be less than or equal to maxPriceAmount',
      );
    }

    const allServices = await this.getAllServiceRecords();

    const filtered = allServices.filter((service) => {
      if (status && service.status.toUpperCase() !== status) {
        return false;
      }

      if (input?.type && service.type !== input.type) {
        return false;
      }

      if (city && !service.city.toLowerCase().includes(city)) {
        return false;
      }

      if (
        language &&
        !service.languages.some((item) => item.toLowerCase().includes(language))
      ) {
        return false;
      }

      if (
        requestedDate &&
        !this.matchesRequestedDate(service.availableTimeSlots, requestedDate)
      ) {
        return false;
      }

      if (
        minPriceAmount !== undefined &&
        service.basePrice.amount < minPriceAmount
      ) {
        return false;
      }

      if (
        maxPriceAmount !== undefined &&
        service.basePrice.amount > maxPriceAmount
      ) {
        return false;
      }

      return true;
    });

    const items = filtered.slice(offset, offset + limit).map((service) => {
      return this.toServiceItem(service);
    });

    return {
      items,
      total: filtered.length,
      limit,
      offset,
      hasMore: offset + items.length < filtered.length,
    };
  }

  async getServiceDetail(id: string): Promise<ServiceDetailRecord> {
    const service = await this.getServiceOrThrow(id);
    return service.detail;
  }

  async getServiceItem(id: string): Promise<ServiceItem> {
    const service = await this.getServiceOrThrow(id);
    return this.toServiceItem(service);
  }

  async upsertService(input: UpsertServiceInput): Promise<ServiceItem> {
    await this.ensureSeedData();

    const id = input.id?.trim() || this.generateServiceId(input.type);
    const existing = await this.getServiceRecordIfExists(id);
    const images =
      input.images !== undefined
        ? this.normalizeStringArray(input.images)
        : existing?.images || [];
    const resources = this.buildResources(input, existing);

    const record: CatalogServiceRecord = {
      entityType: 'SERVICE',
      id,
      type: input.type,
      title: this.requireText(input.title, 'title'),
      city: this.requireText(input.city, 'city'),
      description: this.requireText(input.description, 'description'),
      images,
      languages: this.requireStringArray(input.languages, 'languages'),
      basePrice: {
        amount: this.normalizeAmount(input.basePriceAmount),
        currency: 'USDT',
      },
      cancellationPolicy:
        input.cancellationPolicy?.trim() ||
        existing?.cancellationPolicy ||
        this.defaultCancellationPolicy(input.type),
      availableTimeSlots: this.resolveAvailableTimeSlots(
        input.availableTimeSlots !== undefined
          ? this.normalizeStringArray(input.availableTimeSlots)
          : existing?.availableTimeSlots || [],
        resources,
      ),
      capacity: this.buildCapacity(input, existing),
      supportContact: this.buildSupportContact(input, existing),
      resources,
      voucherTemplate:
        input.voucherTemplate?.trim() ||
        existing?.voucherTemplate ||
        this.defaultVoucherTemplate(input.type),
      status: this.requireText(input.status || 'ACTIVE', 'status'),
      detail: this.buildDetail(input, existing),
      updatedAt: new Date().toISOString(),
    };

    await this.travelDB.put(`service:${record.id}`, record);
    await this.logAudit({
      serviceId: record.id,
      action: ServiceAuditAction.UPSERT,
      beforeStatus: existing?.status,
      afterStatus: record.status,
      note: existing ? 'Updated service' : 'Created service',
    });
    return this.toServiceItem(record);
  }

  async setServiceStatus(input: SetServiceStatusInput): Promise<ServiceItem> {
    await this.ensureSeedData();

    const record = await this.getServiceOrThrow(input.id);
    const nextStatus = this.requireText(input.status, 'status');

    if (record.status === nextStatus) {
      return this.toServiceItem(record);
    }

    const updated: CatalogServiceRecord = {
      ...record,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };

    await this.travelDB.put(`service:${record.id}`, updated);
    await this.logAudit({
      serviceId: updated.id,
      action: ServiceAuditAction.STATUS_CHANGE,
      beforeStatus: record.status,
      afterStatus: updated.status,
      note: 'Admin status update',
    });
    return this.toServiceItem(updated);
  }

  async deleteService(input: DeleteServiceInput): Promise<boolean> {
    await this.ensureSeedData();

    const record = await this.getServiceOrThrow(input.id);

    if (input.hardDelete) {
      const deleted = await this.travelDB.delete(`service:${record.id}`);
      if (!deleted) {
        return false;
      }

      await this.logAudit({
        serviceId: record.id,
        action: ServiceAuditAction.DELETE,
        beforeStatus: record.status,
        afterStatus: undefined,
        note: 'Hard delete',
      });
      return true;
    }

    if (record.status === 'DELETED') {
      return true;
    }

    const updated: CatalogServiceRecord = {
      ...record,
      status: 'DELETED',
      updatedAt: new Date().toISOString(),
    };

    await this.travelDB.put(`service:${record.id}`, updated);
    await this.logAudit({
      serviceId: record.id,
      action: ServiceAuditAction.DELETE,
      beforeStatus: record.status,
      afterStatus: updated.status,
      note: 'Soft delete',
    });
    return true;
  }

  async listServiceAuditLogs(
    input?: ServiceAuditListInput,
  ): Promise<ServiceAuditPage> {
    await this.ensureSeedData();

    const limit = Math.min(Math.max(input?.page?.limit ?? 20, 1), 100);
    const offset = Math.max(input?.page?.offset ?? 0, 0);

    const contains: Record<string, unknown> = {
      entityType: 'SERVICE_AUDIT',
    };

    if (input?.serviceId?.trim()) {
      contains.serviceId = input.serviceId.trim();
    }

    if (input?.action) {
      contains.action = input.action;
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
      .map((row) => this.toServiceAuditRecord(row.value))
      .filter((value): value is ServiceAuditRecord => value !== null)
      .map((record) => this.toServiceAuditLog(record));

    const total = result.total ?? items.length;

    return {
      items,
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    };
  }

  async getServiceOrThrow(id: string): Promise<CatalogServiceRecord> {
    await this.ensureSeedData();

    const service = await this.travelDB.get<CatalogServiceRecord>(
      `service:${id}`,
    );
    const normalized = this.toServiceRecord(service);

    if (!normalized) {
      throw new NotFoundException(`Service ${id} not found`);
    }

    return normalized;
  }

  async reserveServiceCapacity(id: string): Promise<ServiceItem> {
    const service = await this.getServiceOrThrow(id);
    const capacity = service.capacity;

    if (!capacity) {
      return this.toServiceItem(service);
    }

    if (capacity.remaining <= 0) {
      throw new BadRequestException(`Service ${id} is sold out`);
    }

    const updated: CatalogServiceRecord = {
      ...service,
      capacity: {
        ...capacity,
        remaining: capacity.remaining - 1,
      },
      updatedAt: new Date().toISOString(),
    };

    await this.travelDB.put(`service:${updated.id}`, updated);
    return this.toServiceItem(updated);
  }

  async reserveServiceAssignment(params: {
    id: string;
    timeSlot: string;
    travelerCount: number;
    resourceId?: string;
  }): Promise<ServiceResource | undefined> {
    const service = await this.getServiceOrThrow(params.id);
    const resources = service.resources || [];

    if (resources.length === 0) {
      return undefined;
    }

    const selectedResource = this.selectAssignableResource(service, params);
    const updatedResources = resources.map((resource) => {
      if (resource.id !== selectedResource.id) {
        return resource;
      }

      return {
        ...resource,
        availableTimeSlots: resource.availableTimeSlots.filter(
          (slot) => slot !== params.timeSlot,
        ),
      };
    });

    const updated: CatalogServiceRecord = {
      ...service,
      resources: updatedResources,
      availableTimeSlots: this.resolveAvailableTimeSlots(
        service.availableTimeSlots,
        updatedResources,
      ),
      updatedAt: new Date().toISOString(),
    };

    await this.travelDB.put(`service:${updated.id}`, updated);
    return selectedResource;
  }

  async releaseServiceCapacity(id: string): Promise<ServiceItem> {
    const service = await this.getServiceOrThrow(id);
    const capacity = service.capacity;

    if (!capacity) {
      return this.toServiceItem(service);
    }

    const updated: CatalogServiceRecord = {
      ...service,
      capacity: {
        ...capacity,
        remaining: Math.min(capacity.max, capacity.remaining + 1),
      },
      updatedAt: new Date().toISOString(),
    };

    await this.travelDB.put(`service:${updated.id}`, updated);
    return this.toServiceItem(updated);
  }

  async releaseServiceAssignment(params: {
    id: string;
    timeSlot?: string;
    resourceId?: string;
  }): Promise<ServiceItem> {
    const service = await this.getServiceOrThrow(params.id);

    if (!params.timeSlot || !params.resourceId || !service.resources?.length) {
      return this.toServiceItem(service);
    }

    const updatedResources = service.resources.map((resource) => {
      if (resource.id !== params.resourceId) {
        return resource;
      }

      if (resource.availableTimeSlots.includes(params.timeSlot!)) {
        return resource;
      }

      return {
        ...resource,
        availableTimeSlots: [...resource.availableTimeSlots, params.timeSlot!],
      };
    });

    const updated: CatalogServiceRecord = {
      ...service,
      resources: updatedResources,
      availableTimeSlots: this.resolveAvailableTimeSlots(
        service.availableTimeSlots,
        updatedResources,
      ),
      updatedAt: new Date().toISOString(),
    };

    await this.travelDB.put(`service:${updated.id}`, updated);
    return this.toServiceItem(updated);
  }

  private async getServiceRecordIfExists(
    id: string,
  ): Promise<CatalogServiceRecord | null> {
    const value = await this.travelDB.get<CatalogServiceRecord>(
      `service:${id}`,
    );
    return this.toServiceRecord(value);
  }

  private async ensureSeedData(): Promise<void> {
    if (this.seedReady) {
      return;
    }

    if (!this.seedPromise) {
      this.seedPromise = this.seedServices();
    }

    await this.seedPromise;
  }

  private async seedServices(): Promise<void> {
    try {
      for (const service of CATALOG_SEED) {
        const key = `service:${service.id}`;
        const existing = await this.travelDB.get<CatalogServiceRecord>(key);

        if (!existing) {
          await this.travelDB.put(key, service);
        }
      }

      this.seedReady = true;
    } finally {
      this.seedPromise = null;
    }
  }

  private async getAllServiceRecords(): Promise<CatalogServiceRecord[]> {
    const records =
      await this.travelDB.getWithPrefix<CatalogServiceRecord>('service:');

    return Object.values(records)
      .map((value) => this.toServiceRecord(value))
      .filter((value): value is CatalogServiceRecord => value !== null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  private toServiceRecord(value: unknown): CatalogServiceRecord | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const candidate = value as Partial<CatalogServiceRecord>;

    if (candidate.entityType !== 'SERVICE') {
      return null;
    }

    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.title !== 'string' ||
      typeof candidate.city !== 'string' ||
      typeof candidate.updatedAt !== 'string' ||
      !candidate.basePrice ||
      typeof candidate.basePrice !== 'object'
    ) {
      return null;
    }

    const normalized = candidate as CatalogServiceRecord;
    const fallbackCapacity = this.defaultCapacityForType(
      normalized.type,
      normalized.detail,
    );
    const resources = this.normalizeResources(normalized.resources);
    const availableTimeSlots = this.resolveAvailableTimeSlots(
      normalized.availableTimeSlots,
      resources,
    );

    return {
      ...normalized,
      images: Array.isArray(normalized.images) ? normalized.images : [],
      languages: Array.isArray(normalized.languages)
        ? normalized.languages
        : [],
      cancellationPolicy:
        normalized.cancellationPolicy ||
        this.defaultCancellationPolicy(normalized.type),
      availableTimeSlots,
      capacity: this.normalizeCapacity(normalized.capacity, fallbackCapacity),
      supportContact: this.normalizeSupportContact(
        normalized.supportContact,
        this.defaultSupportContact(normalized.type),
      ),
      resources,
      voucherTemplate:
        normalized.voucherTemplate ||
        this.defaultVoucherTemplate(normalized.type),
      status: normalized.status || 'ACTIVE',
    };
  }

  private toServiceItem(service: CatalogServiceRecord): ServiceItem {
    return {
      id: service.id,
      type: service.type,
      title: service.title,
      city: service.city,
      description: service.description,
      coverImage: service.images[0],
      images: service.images,
      languages: service.languages,
      basePrice: service.basePrice,
      cancellationPolicy: service.cancellationPolicy,
      availableTimeSlots: service.availableTimeSlots || [],
      capacity: service.capacity,
      supportContact: service.supportContact,
      resources: service.resources || [],
      voucherTemplate: service.voucherTemplate,
      status: service.status,
      updatedAt: service.updatedAt,
    };
  }

  private buildCapacity(
    input: UpsertServiceInput,
    existing: CatalogServiceRecord | null,
  ): ServiceCapacity {
    if (input.capacity) {
      return this.normalizeCapacity(
        input.capacity,
        this.defaultCapacityForType(input.type, existing?.detail),
      );
    }

    if (existing?.capacity) {
      return this.normalizeCapacity(
        existing.capacity,
        this.defaultCapacityForType(input.type, existing.detail),
      );
    }

    return this.defaultCapacityForType(input.type, existing?.detail);
  }

  private buildSupportContact(
    input: UpsertServiceInput,
    existing: CatalogServiceRecord | null,
  ): ServiceContact {
    if (input.supportContact) {
      return this.normalizeSupportContact(
        input.supportContact,
        this.defaultSupportContact(input.type),
      );
    }

    if (existing?.supportContact) {
      return this.normalizeSupportContact(
        existing.supportContact,
        this.defaultSupportContact(input.type),
      );
    }

    return this.defaultSupportContact(input.type);
  }

  private buildResources(
    input: UpsertServiceInput,
    existing: CatalogServiceRecord | null,
  ): ServiceResource[] {
    if (input.resources !== undefined) {
      return this.normalizeResources(input.resources);
    }

    return this.normalizeResources(existing?.resources);
  }

  private toServiceAuditRecord(value: unknown): ServiceAuditRecord | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const candidate = value as Partial<ServiceAuditRecord>;
    if (candidate.entityType !== 'SERVICE_AUDIT') {
      return null;
    }

    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.serviceId !== 'string' ||
      typeof candidate.action !== 'string' ||
      typeof candidate.actor !== 'string' ||
      typeof candidate.createdAt !== 'string'
    ) {
      return null;
    }

    return candidate as ServiceAuditRecord;
  }

  private toServiceAuditLog(record: ServiceAuditRecord): ServiceAuditLog {
    return {
      id: record.id,
      serviceId: record.serviceId,
      action: record.action,
      beforeStatus: record.beforeStatus,
      afterStatus: record.afterStatus,
      note: record.note,
      actor: record.actor,
      createdAt: record.createdAt,
    };
  }

  private buildDetail(
    input: UpsertServiceInput,
    existing: CatalogServiceRecord | null,
  ): ServiceDetailRecord {
    if (input.type === ServiceType.PACKAGE) {
      if (
        !input.packageDetail &&
        existing?.type === ServiceType.PACKAGE &&
        existing.detail.__typename === 'PackageServiceDetail'
      ) {
        return existing.detail;
      }

      if (!input.packageDetail) {
        throw new BadRequestException(
          'packageDetail is required for PACKAGE service',
        );
      }

      if (
        !Number.isInteger(input.packageDetail.durationDays) ||
        input.packageDetail.durationDays < 1
      ) {
        throw new BadRequestException(
          'packageDetail.durationDays must be an integer greater than 0',
        );
      }

      return {
        __typename: 'PackageServiceDetail',
        durationDays: input.packageDetail.durationDays,
        itinerary: this.requireStringArray(
          input.packageDetail.itinerary,
          'packageDetail.itinerary',
        ),
      };
    }

    if (input.type === ServiceType.GUIDE) {
      if (
        !input.guideDetail &&
        existing?.type === ServiceType.GUIDE &&
        existing.detail.__typename === 'GuideServiceDetail'
      ) {
        return existing.detail;
      }

      if (!input.guideDetail) {
        throw new BadRequestException(
          'guideDetail is required for GUIDE service',
        );
      }

      if (
        !Number.isInteger(input.guideDetail.yearsOfExperience) ||
        input.guideDetail.yearsOfExperience < 0
      ) {
        throw new BadRequestException(
          'guideDetail.yearsOfExperience must be a non-negative integer',
        );
      }

      return {
        __typename: 'GuideServiceDetail',
        languages: this.requireStringArray(
          input.guideDetail.languages,
          'guideDetail.languages',
        ),
        yearsOfExperience: input.guideDetail.yearsOfExperience,
        certifications: this.requireStringArray(
          input.guideDetail.certifications,
          'guideDetail.certifications',
        ),
      };
    }

    if (input.type === ServiceType.CAR) {
      if (
        !input.carDetail &&
        existing?.type === ServiceType.CAR &&
        existing.detail.__typename === 'CarServiceDetail'
      ) {
        return existing.detail;
      }

      if (!input.carDetail) {
        throw new BadRequestException('carDetail is required for CAR service');
      }

      if (
        !Number.isInteger(input.carDetail.seats) ||
        input.carDetail.seats < 1
      ) {
        throw new BadRequestException(
          'carDetail.seats must be an integer greater than 0',
        );
      }

      return {
        __typename: 'CarServiceDetail',
        seats: input.carDetail.seats,
        carType: this.requireText(input.carDetail.carType, 'carDetail.carType'),
        luggageCapacity: input.carDetail.luggageCapacity?.trim() || undefined,
      };
    }

    if (
      !input.assistantDetail &&
      existing?.type === ServiceType.ASSISTANT &&
      existing.detail.__typename === 'AssistantServiceDetail'
    ) {
      return existing.detail;
    }

    if (!input.assistantDetail) {
      throw new BadRequestException(
        'assistantDetail is required for ASSISTANT service',
      );
    }

    return {
      __typename: 'AssistantServiceDetail',
      supportChannels: this.requireStringArray(
        input.assistantDetail.supportChannels,
        'assistantDetail.supportChannels',
      ),
      serviceHours: this.requireText(
        input.assistantDetail.serviceHours,
        'assistantDetail.serviceHours',
      ),
    };
  }

  private requireText(value: string, fieldName: string): string {
    const normalized = value?.trim();
    if (!normalized) {
      throw new BadRequestException(`${fieldName} is required`);
    }

    return normalized;
  }

  private requireStringArray(values: string[], fieldName: string): string[] {
    const normalized = this.normalizeStringArray(values);
    if (normalized.length === 0) {
      throw new BadRequestException(
        `${fieldName} must contain at least 1 item`,
      );
    }

    return normalized;
  }

  private normalizeStringArray(values?: string[]): string[] {
    if (!Array.isArray(values)) {
      return [];
    }

    const normalized = values
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter((value) => !!value);

    return Array.from(new Set(normalized));
  }

  private normalizeCapacity(
    value: Partial<ServiceCapacity> | undefined,
    fallback: ServiceCapacity,
  ): ServiceCapacity {
    const min = Number.isInteger(value?.min)
      ? Number(value?.min)
      : fallback.min;
    const max = Number.isInteger(value?.max)
      ? Number(value?.max)
      : fallback.max;
    const remaining = Number.isInteger(value?.remaining)
      ? Number(value?.remaining)
      : fallback.remaining;

    if (min < 1) {
      throw new BadRequestException('capacity.min must be greater than 0');
    }

    if (max < min) {
      throw new BadRequestException(
        'capacity.max must be greater than or equal to min',
      );
    }

    if (remaining < 0) {
      throw new BadRequestException('capacity.remaining must be non-negative');
    }

    if (remaining > max) {
      throw new BadRequestException(
        'capacity.remaining must be less than or equal to max',
      );
    }

    return {
      min,
      max,
      remaining,
    };
  }

  private normalizeSupportContact(
    value: Partial<ServiceContact> | undefined,
    fallback: ServiceContact,
  ): ServiceContact {
    const name =
      typeof value?.name === 'string' && value.name.trim()
        ? value.name.trim()
        : fallback.name;
    const channel =
      typeof value?.channel === 'string' && value.channel.trim()
        ? value.channel.trim()
        : fallback.channel;
    const contactValue =
      typeof value?.value === 'string' && value.value.trim()
        ? value.value.trim()
        : fallback.value;

    return {
      name,
      channel,
      value: contactValue,
    };
  }

  private normalizeResources(value: unknown): ServiceResource[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const seenIds = new Set<string>();
    const resources: ServiceResource[] = [];

    for (const item of value) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const candidate = item as Partial<ServiceResource>;
      const id = this.requireText(String(candidate.id || ''), 'resource.id');

      if (seenIds.has(id)) {
        throw new BadRequestException(`duplicate resource id: ${id}`);
      }

      seenIds.add(id);

      const seats =
        candidate.seats !== undefined ? Number(candidate.seats) : undefined;
      if (seats !== undefined && (!Number.isInteger(seats) || seats <= 0)) {
        throw new BadRequestException(
          'resource.seats must be a positive integer',
        );
      }

      resources.push({
        id,
        label: this.requireText(
          String(candidate.label || ''),
          'resource.label',
        ),
        status:
          typeof candidate.status === 'string' && candidate.status.trim()
            ? candidate.status.trim().toUpperCase()
            : 'ACTIVE',
        languages: this.normalizeStringArray(candidate.languages),
        seats,
        availableTimeSlots: this.normalizeStringArray(
          candidate.availableTimeSlots,
        ),
      });
    }

    return resources;
  }

  private resolveAvailableTimeSlots(
    baseSlots: string[] | undefined,
    resources: ServiceResource[],
  ): string[] {
    if (resources.length === 0) {
      return this.normalizeStringArray(baseSlots);
    }

    return this.normalizeStringArray(
      resources.flatMap((resource) => resource.availableTimeSlots),
    );
  }

  private selectAssignableResource(
    service: CatalogServiceRecord,
    params: {
      timeSlot: string;
      travelerCount: number;
      resourceId?: string;
    },
  ): ServiceResource {
    const resources = service.resources || [];
    const requestedResourceId = params.resourceId?.trim();

    const matchingResources = resources.filter((resource) => {
      if (resource.status !== 'ACTIVE') {
        return false;
      }

      if (requestedResourceId && resource.id !== requestedResourceId) {
        return false;
      }

      if (!resource.availableTimeSlots.includes(params.timeSlot)) {
        return false;
      }

      if (
        service.type === ServiceType.CAR &&
        resource.seats !== undefined &&
        params.travelerCount > resource.seats
      ) {
        return false;
      }

      return true;
    });

    if (matchingResources.length === 0) {
      throw new BadRequestException(
        requestedResourceId
          ? `Resource ${requestedResourceId} is not available for ${params.timeSlot}`
          : `No active resource available for ${params.timeSlot}`,
      );
    }

    return matchingResources[0];
  }

  private defaultCancellationPolicy(type: ServiceType): string {
    if (type === ServiceType.CAR) {
      return 'Free cancellation up to 24 hours before pickup.';
    }

    if (type === ServiceType.GUIDE) {
      return 'Free cancellation up to 48 hours before guide start.';
    }

    if (type === ServiceType.ASSISTANT) {
      return 'Unused assistant hours can be rescheduled within 7 days.';
    }

    return 'Free cancellation up to 72 hours before departure.';
  }

  private defaultVoucherTemplate(type: ServiceType): string {
    if (type === ServiceType.CAR) {
      return 'Present booking {bookingId} to the driver at pickup.';
    }

    if (type === ServiceType.GUIDE) {
      return 'Share booking {bookingId} with your guide at meetup.';
    }

    if (type === ServiceType.ASSISTANT) {
      return 'Use booking {bookingId} to activate assistant handoff.';
    }

    return 'Show booking {bookingId} to the service team on arrival.';
  }

  private defaultSupportContact(type: ServiceType): ServiceContact {
    if (type === ServiceType.CAR) {
      return {
        name: 'Transport Ops',
        channel: 'Phone',
        value: '+86-138-0000-0001',
      };
    }

    if (type === ServiceType.GUIDE) {
      return {
        name: 'Guide Ops',
        channel: 'WhatsApp',
        value: '+86-138-0000-0002',
      };
    }

    if (type === ServiceType.ASSISTANT) {
      return {
        name: 'Assistant Desk',
        channel: 'Email',
        value: 'assistant@sean-tour.local',
      };
    }

    return {
      name: 'Guest Desk',
      channel: 'WeChat',
      value: 'sean-tour',
    };
  }

  private defaultCapacityForType(
    type: ServiceType,
    detail?: ServiceDetailRecord,
  ): ServiceCapacity {
    if (type === ServiceType.CAR) {
      const seats =
        detail?.__typename === 'CarServiceDetail' ? detail.seats : 7;
      return {
        min: 1,
        max: seats,
        remaining: 2,
      };
    }

    if (type === ServiceType.GUIDE) {
      return {
        min: 1,
        max: 5,
        remaining: 3,
      };
    }

    if (type === ServiceType.ASSISTANT) {
      return {
        min: 1,
        max: 4,
        remaining: 3,
      };
    }

    return {
      min: 1,
      max: 6,
      remaining: 4,
    };
  }

  private normalizeAmount(value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
      throw new BadRequestException('basePriceAmount must be greater than 0');
    }

    return Number(value.toFixed(2));
  }

  private normalizeDateFilter(value?: string): string | undefined {
    const normalized = value?.trim();

    if (!normalized) {
      return undefined;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      throw new BadRequestException('date must use YYYY-MM-DD format');
    }

    return normalized;
  }

  private normalizeOptionalPriceFilter(
    value: number | undefined,
    fieldName: string,
  ): number | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (!Number.isFinite(value) || value < 0) {
      throw new BadRequestException(
        `${fieldName} must be a non-negative number`,
      );
    }

    return Number(value.toFixed(2));
  }

  private matchesRequestedDate(
    availableTimeSlots: string[] | undefined,
    requestedDate: string,
  ): boolean {
    if (!availableTimeSlots || availableTimeSlots.length === 0) {
      return false;
    }

    return availableTimeSlots.some((slot) => slot.includes(requestedDate));
  }

  private async logAudit(params: {
    serviceId: string;
    action: ServiceAuditAction;
    beforeStatus?: string;
    afterStatus?: string;
    note?: string;
  }): Promise<void> {
    const id = `audit_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
    const auditRecord: ServiceAuditRecord = {
      entityType: 'SERVICE_AUDIT',
      id,
      serviceId: params.serviceId,
      action: params.action,
      beforeStatus: params.beforeStatus,
      afterStatus: params.afterStatus,
      note: params.note,
      actor: 'admin_auth_code',
      createdAt: new Date().toISOString(),
    };

    await this.travelDB.put(`service_audit:${id}`, auditRecord);
  }

  private generateServiceId(type: ServiceType): string {
    const prefixByType: Record<ServiceType, string> = {
      [ServiceType.PACKAGE]: 'pkg',
      [ServiceType.GUIDE]: 'guide',
      [ServiceType.CAR]: 'car',
      [ServiceType.ASSISTANT]: 'assistant',
    };

    return `svc_${prefixByType[type]}_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  }
}
