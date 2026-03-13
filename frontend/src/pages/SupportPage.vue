<template>
  <section
    class="relative overflow-hidden rounded-3xl border border-[#0c6d64]/20 bg-gradient-to-br from-[#092b35] via-[#0f4f57] to-[#113746] px-6 py-8 text-white shadow-[0_26px_90px_-55px_rgba(7,41,46,0.95)]"
  >
    <div class="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[#f8b03c]/20 blur-3xl" />
    <div class="absolute -left-16 -bottom-24 h-52 w-52 rounded-full bg-[#2ad0a1]/15 blur-3xl" />
    <p class="relative text-xs font-semibold uppercase tracking-[0.16em] text-teal-100/90">Support</p>
    <h1 class="relative mt-2 text-3xl font-semibold leading-tight">Need Help?</h1>
    <p class="relative mt-3 text-sm text-teal-50/90">
      Use the right channel depending on whether you need booking help, payment troubleshooting, or
      a live assistant handoff.
    </p>
  </section>

  <section class="mt-6 grid gap-4 md:grid-cols-3">
    <div class="rounded-3xl border border-slate-200 bg-white/95 px-5 py-5 shadow-sm">
      <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Booking Ops</p>
      <h2 class="mt-2 text-lg font-semibold text-slate-900">Service Coordination</h2>
      <p class="mt-3 text-sm leading-6 text-slate-700">
        Review your order detail first. Every paid order includes contact information and voucher
        instructions for the service team.
      </p>
    </div>

    <div class="rounded-3xl border border-slate-200 bg-white/95 px-5 py-5 shadow-sm">
      <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Payment</p>
      <h2 class="mt-2 text-lg font-semibold text-slate-900">USDT Checkout Help</h2>
      <p class="mt-3 text-sm leading-6 text-slate-700">
        If the payment status is delayed, open your order detail to review the payment timeline and
        recent callback events before contacting support.
      </p>
    </div>

    <div class="rounded-3xl border border-slate-200 bg-white/95 px-5 py-5 shadow-sm">
      <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Live Help</p>
      <h2 class="mt-2 text-lg font-semibold text-slate-900">Remote Assistant</h2>
      <p class="mt-3 text-sm leading-6 text-slate-700">
        Need real-time local help? Purchase the assistant service and submit a staffed request in
        the assistant workspace.
      </p>
      <RouterLink
        to="/assistant"
        class="mt-4 inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        Open Assistant Intro
      </RouterLink>
    </div>
  </section>
</template>
