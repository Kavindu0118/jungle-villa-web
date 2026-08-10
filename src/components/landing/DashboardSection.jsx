export default function DashboardSection() {
  return (
    <section className="bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-400">Know what’s happening in your restaurant — anytime.</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Know what’s happening in your restaurant — anytime.</h2>
            <p className="mt-4 text-base leading-8 text-slate-300">Access centralized restaurant information with sales overview, order details, analytics, reports and secure cloud backup.</p>
            <ul className="mt-10 space-y-4 text-sm leading-7 text-slate-300">
              {['Sales overview', 'Order information', 'Restaurant performance', 'Analytics', 'Reports', 'Cloud backup', 'Centralized management'].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900 p-6 shadow-2xl shadow-slate-950/50">
            <div className="space-y-5">
              <div className="rounded-3xl bg-slate-800/90 p-6">
                <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Cloud dashboard</p>
                <p className="mt-4 text-2xl font-semibold text-white">Sales & restaurant insights in one place</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl bg-slate-950/90 p-5">
                  <p className="text-sm text-slate-400">Monthly revenue</p>
                  <p className="mt-4 text-3xl font-semibold text-emerald-400">LKR 245K</p>
                </div>
                <div className="rounded-3xl bg-slate-950/90 p-5">
                  <p className="text-sm text-slate-400">Orders completed</p>
                  <p className="mt-4 text-3xl font-semibold text-emerald-400">1,078</p>
                </div>
              </div>
              <div className="rounded-3xl bg-slate-900/80 p-5">
                <p className="text-sm text-slate-400">Order status</p>
                <div className="mt-4 flex items-center justify-between rounded-3xl bg-slate-950/90 p-4">
                  <span className="text-sm text-slate-200">Preparing</span>
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm text-emerald-300">Real-time</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
