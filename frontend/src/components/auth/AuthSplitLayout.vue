<script setup lang="ts">
import Card from 'primevue/card';

defineProps({
  badge: {
    type: String,
    default: 'Sean Tour',
  },
  heroTitle: {
    type: String,
    required: true,
  },
  heroDescription: {
    type: String,
    default: '',
  },
  heroPoints: {
    type: Array,
    default: () => [],
  },
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
  <section class="mx-auto grid w-full max-w-6xl gap-6 px-1 py-1 lg:grid-cols-[1.1fr_0.9fr]">
    <aside
      class="relative overflow-hidden rounded-3xl border border-emerald-300/40 bg-gradient-to-br from-emerald-400 via-green-500 to-teal-700 p-8 text-white shadow-[0_28px_80px_-45px_rgba(6,95,70,0.95)]"
    >
      <p
        class="inline-flex items-center rounded-full border border-white/45 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
      >
        {{ badge }}
      </p>

      <h1 class="mt-5 text-3xl font-semibold leading-tight lg:text-[2rem]">{{ heroTitle }}</h1>

      <p v-if="heroDescription" class="mt-4 max-w-md text-sm leading-6 text-emerald-50/95">
        {{ heroDescription }}
      </p>

      <ul v-if="heroPoints.length" class="mt-8 space-y-3 text-sm text-emerald-50">
        <li v-for="point in heroPoints" :key="point" class="flex items-start gap-3">
          <i class="pi pi-check-circle mt-[2px]" />
          <span>{{ point }}</span>
        </li>
      </ul>
    </aside>

    <Card
      class="rounded-3xl border border-slate-200/85 bg-white/95 shadow-[0_26px_80px_-54px_rgba(15,23,42,0.65)]"
    >
      <template #title>
        <h2 class="text-2xl font-semibold text-slate-900">{{ title }}</h2>
      </template>

      <template #subtitle>
        <p v-if="subtitle" class="text-sm text-slate-500">{{ subtitle }}</p>
      </template>

      <template #content>
        <slot />
        <slot name="footer" />
      </template>
    </Card>
  </section>
</template>
