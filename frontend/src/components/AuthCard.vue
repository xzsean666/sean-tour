<script setup lang="ts">
defineProps({
  title: {
    type: String,
    required: true,
  },
  subtitle: {
    type: String,
    default: '',
  },
});
</script>

<template>
  <section class="panel auth-card">
    <h1>{{ title }}</h1>
    <p v-if="subtitle" class="muted auth-subtitle">{{ subtitle }}</p>
    <slot />
  </section>
</template>
