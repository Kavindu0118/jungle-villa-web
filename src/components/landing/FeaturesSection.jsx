import { featureTiles } from './landingData'

export default function FeaturesSection() {
  return (
    <section className="bg-slate-100 text-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-500">Everything You Need to Run Your Restaurant.</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Everything you need to run your restaurant.</h2>
          <p className="mt-4 text-base leading-8 text-slate-600">Smart POS brings core restaurant features together in a single system designed for fast service and easier operations.</p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {featureTiles.map((feature) => (
            <div key={feature.title} className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-600 text-xl font-semibold">✓</div>
              <h3 className="text-lg font-semibold text-slate-950">{feature.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
