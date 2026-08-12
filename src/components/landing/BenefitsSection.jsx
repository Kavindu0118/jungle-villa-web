import { benefits } from './landingData'

export default function BenefitsSection() {
  return (
    <section id="benefits" className="bg-slate-100 text-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-500">Why Restaurants Choose Smart POS</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Why restaurants choose Smart POS</h2>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((item) => (
            <div key={item.title} className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-lg font-semibold text-slate-950">{item.title}</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
