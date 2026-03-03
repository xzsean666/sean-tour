import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import DemoPage from '../pages/DemoPage.vue';
import LoginPage from '../pages/auth/LoginPage.vue';
import RegisterPage from '../pages/auth/RegisterPage.vue';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage.vue';
import ResetPasswordPage from '../pages/auth/ResetPasswordPage.vue';
import AuthCallbackPage from '../pages/auth/AuthCallbackPage.vue';
import { initAuthStore, useAuthStore } from '../stores/auth.store';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'demo-home',
    component: DemoPage,
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
  const { user } = useAuthStore();

  if (to.meta.guestOnly && user.value) {
    return { path: '/' };
  }

  return true;
});

export default router;
