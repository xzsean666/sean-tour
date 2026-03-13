<template>
  <section
    class="relative overflow-hidden rounded-3xl border border-[#0c6d64]/20 bg-gradient-to-br from-[#0a2f37] via-[#104d55] to-[#203152] px-6 py-8 text-white shadow-[0_26px_90px_-55px_rgba(7,41,46,0.95)]"
  >
    <div class="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[#f8b03c]/22 blur-3xl" />
    <div class="absolute -left-16 -bottom-24 h-52 w-52 rounded-full bg-[#2ad0a1]/15 blur-3xl" />

    <p class="relative text-xs font-semibold uppercase tracking-[0.16em] text-teal-100/90">Assistant</p>
    <h1 class="relative mt-2 text-3xl font-semibold leading-tight">Remote China Assistant</h1>
    <p class="relative mt-3 max-w-3xl text-sm leading-6 text-teal-50/90">
      Human support for translation, booking coordination, and emergency local help. Buy the
      assistant service first, then manage requests in your assistant workspace.
    </p>
  </section>

  <section class="mt-6 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
    <div class="rounded-3xl border border-slate-200 bg-white/95 px-5 py-5 shadow-sm">
      <h2 class="text-xl font-semibold text-slate-900">What You Get</h2>
      <div class="mt-4 grid gap-3 text-sm text-slate-700">
        <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          Real person coordination for hotels, transport, ticketing, and check-in support.
        </div>
        <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          Structured handoff with preferred channel, time slots, and internal assignment tracking.
        </div>
        <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          Status updates and notifications after request, assignment, and completion.
        </div>
      </div>
    </div>

    <div class="rounded-3xl border border-slate-200 bg-white/95 px-5 py-5 shadow-sm">
      <h2 class="text-xl font-semibold text-slate-900">Next Step</h2>
      <p class="mt-4 text-sm leading-6 text-slate-700">
        1. Buy an assistant service package from the marketplace.
        <br />
        2. Complete checkout in USDT on BSC/ERC20.
        <br />
        3. Open your assistant workspace to submit the actual support request.
      </p>

      <div class="mt-5 grid gap-3">
        <RouterLink
          to="/"
          class="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Browse Services
        </RouterLink>
        <RouterLink
          to="/assistant/requests"
          class="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
        >
          Open Assistant Workspace
        </RouterLink>
      </div>
    </div>
  </section>
</template>
