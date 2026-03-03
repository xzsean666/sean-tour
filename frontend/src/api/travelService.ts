export type ServiceType = 'PACKAGE' | 'GUIDE' | 'CAR' | 'ASSISTANT';
export type BookingStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'CONFIRMED'
  | 'IN_SERVICE'
  | 'COMPLETED'
  | 'CANCELED';

export interface ServiceItem {
  id: string;
  type: ServiceType;
  title: string;
  city: string;
  description: string;
  languages: string[];
  priceAmount: number;
  currency: 'USDT';
}

export interface ServicePage {
  items: ServiceItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface CheckoutPreview {
  bookingId: string;
  serviceTitle: string;
  travelerCount: number;
  travelDateRange: string;
  expectedAmount: string;
  currency: 'USDT';
  network: 'BSC';
  tokenStandard: 'ERC20';
  payAddress: string;
  paymentStatus: 'PENDING' | 'PAID' | 'EXPIRED';
  expiresInMinutes: number;
}

export interface OrderItem {
  id: string;
  bookingId: string;
  serviceTitle: string;
  city: string;
  bookingStatus: BookingStatus;
  paymentStatus: 'PENDING' | 'PAID' | 'EXPIRED';
  expectedAmount: string;
  createdAt: string;
}

const SERVICE_MOCKS: ServiceItem[] = [
  {
    id: 'svc_pkg_beijing_001',
    type: 'PACKAGE',
    title: 'Beijing 3-Day Culture Explorer',
    city: 'Beijing',
    description: 'Imperial city route with local food and private transfer.',
    languages: ['English', 'Chinese'],
    priceAmount: 399,
    currency: 'USDT',
  },
  {
    id: 'svc_guide_shanghai_001',
    type: 'GUIDE',
    title: 'Shanghai Guide (Full Day)',
    city: 'Shanghai',
    description: 'Business + city highlights with multilingual local guidance.',
    languages: ['English', 'Spanish', 'Chinese'],
    priceAmount: 149,
    currency: 'USDT',
  },
  {
    id: 'svc_car_sz_001',
    type: 'CAR',
    title: 'Shenzhen Chauffeur 7-Seater',
    city: 'Shenzhen',
    description: 'Airport pickup and city charter with professional driver.',
    languages: ['English', 'Chinese'],
    priceAmount: 259,
    currency: 'USDT',
  },
  {
    id: 'svc_assistant_remote_001',
    type: 'ASSISTANT',
    title: 'Remote China Assistant (8h)',
    city: 'Remote',
    description: 'Live support for translation, booking, and emergency help.',
    languages: ['English', 'Chinese', 'French'],
    priceAmount: 99,
    currency: 'USDT',
  },
];

const ORDER_MOCKS: OrderItem[] = [
  {
    id: 'ord_1001',
    bookingId: 'bk_demo_1001',
    serviceTitle: 'Beijing 3-Day Culture Explorer',
    city: 'Beijing',
    bookingStatus: 'PENDING_PAYMENT',
    paymentStatus: 'PENDING',
    expectedAmount: '798.00',
    createdAt: '2026-03-03T09:30:00.000Z',
  },
  {
    id: 'ord_1002',
    bookingId: 'bk_demo_1002',
    serviceTitle: 'Shanghai Guide (Full Day)',
    city: 'Shanghai',
    bookingStatus: 'PAID',
    paymentStatus: 'PAID',
    expectedAmount: '149.00',
    createdAt: '2026-03-02T17:20:00.000Z',
  },
];

function delay(ms = 120): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export const travelService = {
  async getServiceList(params?: {
    type?: ServiceType;
    city?: string;
    language?: string;
    limit?: number;
    offset?: number;
  }): Promise<ServicePage> {
    await delay();

    const limit = Math.min(Math.max(params?.limit ?? 12, 1), 50);
    const offset = Math.max(params?.offset ?? 0, 0);
    const cityKeyword = params?.city?.trim().toLowerCase();
    const languageKeyword = params?.language?.trim().toLowerCase();

    const filtered = SERVICE_MOCKS.filter((service) => {
      if (params?.type && service.type !== params.type) {
        return false;
      }

      if (cityKeyword && !service.city.toLowerCase().includes(cityKeyword)) {
        return false;
      }

      if (
        languageKeyword &&
        !service.languages.some((item) =>
          item.toLowerCase().includes(languageKeyword),
        )
      ) {
        return false;
      }

      return true;
    });

    const items = filtered.slice(offset, offset + limit);

    return {
      items,
      total: filtered.length,
      limit,
      offset,
      hasMore: offset + items.length < filtered.length,
    };
  },

  async getCheckoutPreview(bookingId: string): Promise<CheckoutPreview> {
    await delay();

    const order =
      ORDER_MOCKS.find((item) => item.bookingId === bookingId) || ORDER_MOCKS[0];

    return {
      bookingId,
      serviceTitle: order.serviceTitle,
      travelerCount: 2,
      travelDateRange: '2026-04-18 to 2026-04-20',
      expectedAmount: order.expectedAmount,
      currency: 'USDT',
      network: 'BSC',
      tokenStandard: 'ERC20',
      payAddress: '0x0000000000000000000000000000000000BEEF',
      paymentStatus: order.paymentStatus,
      expiresInMinutes: 30,
    };
  },

  async getMyOrders(): Promise<OrderItem[]> {
    await delay();
    return [...ORDER_MOCKS].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getOrderDetail(orderId: string): Promise<OrderItem | null> {
    await delay();
    return ORDER_MOCKS.find((item) => item.id === orderId) ?? null;
  },
};
