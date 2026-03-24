import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { handleSessionExpired } from '../api/sessionExpiry';
import { initAuthStore, useAuthStore } from '../stores/auth.store';

const ServicesPage = () => import('../pages/ServicesPage.vue');
const ServiceCatalogPage = () => import('../pages/ServiceCatalogPage.vue');
const ServiceDetailPage = () => import('../pages/ServiceDetailPage.vue');
const CheckoutPage = () => import('../pages/CheckoutPage.vue');
const OrdersPage = () => import('../pages/OrdersPage.vue');
const OrderDetailPage = () => import('../pages/OrderDetailPage.vue');
const ProfilePage = () => import('../pages/ProfilePage.vue');
const FaqPage = () => import('../pages/FaqPage.vue');
const SupportPage = () => import('../pages/SupportPage.vue');
const AdminSupportPage = () => import('../pages/AdminSupportPage.vue');
const AdminAccessPage = () => import('../pages/AdminAccessPage.vue');
const AssistantLandingPage = () => import('../pages/AssistantLandingPage.vue');
const AssistantPage = () => import('../pages/AssistantPage.vue');
const AdminServicesPage = () => import('../pages/AdminServicesPage.vue');
const AdminPaymentsPage = () => import('../pages/AdminPaymentsPage.vue');
const AdminAssistantPage = () => import('../pages/AdminAssistantPage.vue');
const AdminOrdersPage = () => import('../pages/AdminOrdersPage.vue');
const LoginPage = () => import('../pages/auth/LoginPage.vue');
const RegisterPage = () => import('../pages/auth/RegisterPage.vue');
const ForgotPasswordPage = () => import('../pages/auth/ForgotPasswordPage.vue');
const ResetPasswordPage = () => import('../pages/auth/ResetPasswordPage.vue');
const AuthCallbackPage = () => import('../pages/auth/AuthCallbackPage.vue');

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'services-home',
    component: ServicesPage,
  },
  {
    path: '/services',
    redirect: '/',
  },
  {
    path: '/packages',
    name: 'packages',
    component: ServiceCatalogPage,
    meta: {
      serviceType: 'PACKAGE',
      pageTitle: 'China Travel Packages',
    },
  },
  {
    path: '/packages/:id',
    name: 'package-detail',
    component: ServiceDetailPage,
    meta: { serviceType: 'PACKAGE' },
  },
  {
    path: '/guides',
    name: 'guides',
    component: ServiceCatalogPage,
    meta: {
      serviceType: 'GUIDE',
      pageTitle: 'Private Local Guides',
    },
  },
  {
    path: '/guides/:id',
    name: 'guide-detail',
    component: ServiceDetailPage,
    meta: { serviceType: 'GUIDE' },
  },
  {
    path: '/cars',
    name: 'cars',
    component: ServiceCatalogPage,
    meta: {
      serviceType: 'CAR',
      pageTitle: 'Private Chauffeur & Car Service',
    },
  },
  {
    path: '/cars/:id',
    name: 'car-detail',
    component: ServiceDetailPage,
    meta: { serviceType: 'CAR' },
  },
  {
    path: '/assistant',
    name: 'assistant-landing',
    component: AssistantLandingPage,
  },
  {
    path: '/assistant/requests',
    name: 'assistant',
    component: AssistantPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/checkout/:bookingId',
    name: 'checkout',
    component: CheckoutPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/orders',
    name: 'orders',
    component: OrdersPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/orders/:id',
    name: 'order-detail',
    component: OrderDetailPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/profile',
    name: 'profile',
    component: ProfilePage,
    meta: { requiresAuth: true },
  },
  {
    path: '/faq',
    name: 'faq',
    component: FaqPage,
  },
  {
    path: '/support',
    name: 'support',
    component: SupportPage,
    meta: { requiresAuth: true },
  },
  {
    path: '/admin/support',
    name: 'admin-support',
    component: AdminSupportPage,
    meta: { requiresAuth: true, requiresSupportWorkspace: true },
  },
  {
    path: '/admin/access',
    name: 'admin-access',
    component: AdminAccessPage,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/admin/services',
    name: 'admin-services',
    component: AdminServicesPage,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/admin/payments',
    name: 'admin-payments',
    component: AdminPaymentsPage,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/admin/orders',
    name: 'admin-orders',
    component: AdminOrdersPage,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/admin/assistant',
    name: 'admin-assistant',
    component: AdminAssistantPage,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/auth/login',
    name: 'auth-login',
    component: LoginPage,
    meta: { guestOnly: true },
  },
  {
    path: '/auth/register',
    name: 'auth-register',
    component: RegisterPage,
    meta: { guestOnly: true },
  },
  {
    path: '/auth/forgot-password',
    name: 'auth-forgot-password',
    component: ForgotPasswordPage,
  },
  {
    path: '/auth/reset-password',
    name: 'auth-reset-password',
    component: ResetPasswordPage,
  },
  {
    path: '/auth/callback',
    name: 'auth-callback',
    component: AuthCallbackPage,
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  await initAuthStore();
  const { user, backendToken, backendUser, refreshUser } = useAuthStore();

  const requiresBackendRole =
    !!to.meta.requiresAdmin || !!to.meta.requiresSupportWorkspace;

  if (to.meta.requiresAuth && user.value) {
    await refreshUser({
      forceBackendUserRefresh: requiresBackendRole || !backendUser.value,
    });

    if (!backendToken.value || (requiresBackendRole && !backendUser.value)) {
      await handleSessionExpired(to.fullPath);
      return false;
    }
  }

  if (to.meta.requiresAuth && !user.value) {
    return {
      path: '/auth/login',
      query: { redirect: to.fullPath },
    };
  }

  if (to.meta.requiresAdmin && !backendUser.value?.isAdmin) {
    return { path: '/' };
  }

  if (
    to.meta.requiresSupportWorkspace &&
    !backendUser.value?.isAdmin &&
    !backendUser.value?.isSupportAgent
  ) {
    return { path: '/support' };
  }

  if (to.meta.guestOnly && user.value) {
    return { path: '/' };
  }

  return true;
});

export default router;
