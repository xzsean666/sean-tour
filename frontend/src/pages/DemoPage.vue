<script setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useAuthStore } from '../stores/auth.store';

const { user } = useAuthStore();

const signedInMessage = computed(() => {
  if (!user.value) {
    return '';
  }

  return `Signed in as ${user.value.email || user.value.id}`;
});
</script>

<template>
  <section class="panel hero-panel">
    <h1>Sean Tour Demo</h1>
    <p class="muted">
      This is the minimal demo page. The auth flow is ready for email login,
      email registration, password reset, and Google OAuth.
    </p>

    <div v-if="user" class="status status-success">{{ signedInMessage }}</div>

    <div v-else class="cta-row">
      <RouterLink class="btn btn-primary" to="/auth/login">Sign In</RouterLink>
      <RouterLink class="btn btn-ghost" to="/auth/register">Create Account</RouterLink>
    </div>
  </section>

  <section class="panel">
    <h2>Auth Pages</h2>
    <ul class="plain-list">
      <li>
        <RouterLink to="/auth/login">Login (email + Google OAuth)</RouterLink>
      </li>
      <li>
        <RouterLink to="/auth/register">Register</RouterLink>
      </li>
      <li>
        <RouterLink to="/auth/forgot-password">Forgot password</RouterLink>
      </li>
      <li>
        <RouterLink to="/auth/reset-password">Reset password</RouterLink>
      </li>
    </ul>
  </section>
</template>
