<template>
  <section
    class="relative overflow-hidden rounded-3xl border border-[#0c6d64]/20 bg-gradient-to-br from-[#083331] via-[#0f5b54] to-[#113746] px-6 py-8 text-white shadow-[0_26px_90px_-55px_rgba(7,41,46,0.95)]"
  >
    <div class="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[#f8b03c]/20 blur-3xl" />
    <div class="absolute -left-16 -bottom-24 h-52 w-52 rounded-full bg-[#2ad0a1]/15 blur-3xl" />
    <p class="relative text-xs font-semibold uppercase tracking-[0.16em] text-teal-100/90">FAQ</p>
    <h1 class="relative mt-2 text-3xl font-semibold leading-tight">Common Questions</h1>
  </section>

  <section class="mt-6 grid gap-4">
    <div class="rounded-3xl border border-slate-200 bg-white/95 px-5 py-5 shadow-sm">
      <h2 class="text-lg font-semibold text-slate-900">What payment method is supported?</h2>
      <p class="mt-3 text-sm leading-6 text-slate-700">
        MVP checkout supports USDT on BSC/ERC20 only. The checkout page shows the exact amount,
        network, payment address, and expiry window.
      </p>
    </div>

    <div class="rounded-3xl border border-slate-200 bg-white/95 px-5 py-5 shadow-sm">
      <h2 class="text-lg font-semibold text-slate-900">Can I choose a date and time slot?</h2>
      <p class="mt-3 text-sm leading-6 text-slate-700">
        Yes. Every detail page now accepts travel date, traveler count, and, when applicable,
        an available time slot before the booking is created.
      </p>
    </div>

    <div class="rounded-3xl border border-slate-200 bg-white/95 px-5 py-5 shadow-sm">
      <h2 class="text-lg font-semibold text-slate-900">Where do I find contact info and vouchers?</h2>
      <p class="mt-3 text-sm leading-6 text-slate-700">
        Order detail includes service contact info, payment timeline, and voucher instructions once
        the booking is paid or confirmed.
      </p>
    </div>
  </section>
</template>
