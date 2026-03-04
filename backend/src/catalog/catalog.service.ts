import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DBService, PGKVDatabase } from '../common/db.service';
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
  status: string;
  detail: ServiceDetailRecord;
  updatedAt: string;
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

    const allServices = await this.getAllServiceRecords();

    const filtered = allServices.filter((service) => {
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

  async upsertService(input: UpsertServiceInput): Promise<ServiceItem> {
    await this.ensureSeedData();

    const id = input.id?.trim() || this.generateServiceId(input.type);
    const record: CatalogServiceRecord = {
      entityType: 'SERVICE',
      id,
      type: input.type,
      title: this.requireText(input.title, 'title'),
      city: this.requireText(input.city, 'city'),
      description: this.requireText(input.description, 'description'),
      images: this.normalizeStringArray(input.images),
      languages: this.requireStringArray(input.languages, 'languages'),
      basePrice: {
        amount: this.normalizeAmount(input.basePriceAmount),
        currency: 'USDT',
      },
      status: this.requireText(input.status || 'ACTIVE', 'status'),
      detail: this.buildDetail(input),
      updatedAt: new Date().toISOString(),
    };

    await this.travelDB.put(`service:${record.id}`, record);
    return this.toServiceItem(record);
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

    return candidate as CatalogServiceRecord;
  }

  private toServiceItem(service: CatalogServiceRecord): ServiceItem {
    return {
      id: service.id,
      type: service.type,
      title: service.title,
      city: service.city,
      description: service.description,
      coverImage: service.images[0],
      languages: service.languages,
      basePrice: service.basePrice,
      status: service.status,
      updatedAt: service.updatedAt,
    };
  }

  private buildDetail(input: UpsertServiceInput): ServiceDetailRecord {
    if (input.type === ServiceType.PACKAGE) {
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

  private normalizeAmount(value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
      throw new BadRequestException('basePriceAmount must be greater than 0');
    }

    return Number(value.toFixed(2));
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
