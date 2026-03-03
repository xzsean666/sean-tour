import { Injectable, NotFoundException } from '@nestjs/common';
import { ServiceListInput } from './dto/service-list.input';
import { ServicePage } from './dto/service-page.dto';
import { ServiceType } from './dto/service-type.enum';
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
export class CatalogService {
  private readonly services: CatalogServiceRecord[] = CATALOG_SEED;

  listServices(input?: ServiceListInput): ServicePage {
    const limit = Math.min(Math.max(input?.page?.limit ?? 10, 1), 50);
    const offset = Math.max(input?.page?.offset ?? 0, 0);
    const city = input?.city?.trim().toLowerCase();
    const language = input?.language?.trim().toLowerCase();

    const filtered = this.services.filter((service) => {
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

  getServiceDetail(id: string): ServiceDetailRecord {
    const service = this.getServiceOrThrow(id);
    return service.detail;
  }

  getServiceOrThrow(id: string): CatalogServiceRecord {
    const service = this.services.find((item) => item.id === id);

    if (!service) {
      throw new NotFoundException(`Service ${id} not found`);
    }

    return service;
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
}
