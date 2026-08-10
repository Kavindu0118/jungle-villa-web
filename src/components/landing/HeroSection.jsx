export default function HeroSection() {
  return (
    <section id="home" className="relative overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_45%)]" />
      <div className="mx-auto grid max-w-7xl gap-16 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-24">
        <div className="relative z-10 flex flex-col justify-center gap-8 sm:gap-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-white/5 px-4 py-2 text-sm text-emerald-200">
            Cloud-based restaurant management for cafés and restaurants
          </div>
          <div className="max-w-2xl space-y-6">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">SMART ORDERING. SMART MANAGEMENT.</p>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
              The Complete Restaurant Management Solution for Modern Cafés & Restaurants.
            </h1>
            <p className="max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
              Give your customers an easier way to order, empower your staff with smarter tools, and manage your entire restaurant from one connected platform.
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <a href="#contact" className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">
              Book a Free Demo
            </a>
            <a href="https://smartpos.worthsoftwares.com/" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900/90 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:text-white">
              Explore Smart POS
            </a>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Channels</p>
              <p className="mt-3 font-semibold text-white">QR Ordering</p>
              <p className="mt-2 text-sm text-slate-300">Customers order directly from their phone.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Channels</p>
              <p className="mt-3 font-semibold text-white">Waiter Mobile App</p>
              <p className="mt-2 text-sm text-slate-300">Staff take orders and manage tables on the move.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Channels</p>
              <p className="mt-3 font-semibold text-white">Main POS</p>
              <p className="mt-2 text-sm text-slate-300">Handle billing, payments and order operations centrally.</p>
            </div>
          </div>
        </div>

        <div className="relative flex items-center justify-center">
          <div className="relative w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/95 p-6 shadow-2xl shadow-slate-950/50">
            <div className="space-y-4">
              <div className="h-48 rounded-3xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 p-6">
                <div className="flex items-center justify-between text-slate-300">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Smart POS</p>
                    <p className="mt-2 text-2xl font-semibold text-white">Live restaurant overview</p>
                  </div>
                  <span className="inline-flex rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">Cloud</span>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl bg-slate-950/90 p-4">
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500">QR Menu</p>
                  <p className="mt-3 text-base font-semibold text-white">Digital menu with ordering</p>
                </div>
                <div className="rounded-3xl bg-slate-950/90 p-4">
                  <p className="text-sm uppercase tracking-[0.24em] text-slate-500">POS</p>
                  <p className="mt-3 text-base font-semibold text-white">Orders, tables, payments</p>
                </div>
              </div>
              <div className="rounded-3xl bg-slate-900/80 p-5 text-slate-200">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Overview</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-950/80 p-3">
                    <p className="text-sm font-semibold text-white">Orders</p>
                    <p className="mt-3 text-3xl font-semibold text-emerald-400">128</p>
                  </div>
                  <div className="rounded-2xl bg-slate-950/80 p-3">
                    <p className="text-sm font-semibold text-white">Sales</p>
                    <p className="mt-3 text-3xl font-semibold text-emerald-400">LKR 92.4K</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
