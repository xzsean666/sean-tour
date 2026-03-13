import 'vue-router';

declare module 'vue-router' {
  interface RouteMeta {
    guestOnly?: boolean;
    requiresAuth?: boolean;
    serviceType?: 'PACKAGE' | 'GUIDE' | 'CAR' | 'ASSISTANT';
    pageTitle?: string;
  }
}
