import { orderChannels } from './landingData'

export default function OrderingChannels() {
  return (
    <section id="features" className="bg-white text-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-500">Three Ways to Take Orders. One Smart System.</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Three ways to take orders. One smart system.</h2>
          <p className="mt-4 text-base leading-7 text-slate-600">Customers, waiters and cashiers each use the channel that fits their role, while Smart POS keeps all operations connected.</p>
        </div>

        <div className="relative mt-14 grid gap-6 lg:grid-cols-3">
          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-slate-200 lg:inset-y-0 lg:left-1/2 lg:h-full lg:w-px" />
          {orderChannels.map((channel, index) => (
            <div key={channel.title} className="group relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-slate-50 p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <div className="mb-6 h-14 w-14 rounded-3xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-xl font-bold">
                {index + 1}
              </div>
              <h3 className="text-xl font-semibold text-slate-950">{channel.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{channel.description}</p>
              <div className="mt-6 space-y-3">
                {channel.benefits.map((benefit) => (
                  <div key={benefit} className="flex items-start gap-3 text-sm text-slate-700">
                    <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">✓</span>
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
