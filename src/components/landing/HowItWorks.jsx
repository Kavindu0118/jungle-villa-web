import { processSteps } from './landingData'

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-400">From Customer Order to Completed Sale.</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">From customer order to completed sale.</h2>
          <p className="mt-4 text-base leading-7 text-slate-300">A simple restaurant workflow that keeps orders moving from QR and waiter ordering to kitchen and POS operations.</p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          {processSteps.map((step, index) => (
            <div key={step.title} className="rounded-[1.5rem] border border-white/10 bg-slate-900/90 p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-emerald-500/15 text-emerald-300 text-lg font-semibold">{index + 1}</div>
                <div>
                  <h3 className="text-xl font-semibold text-white">{step.title}</h3>
                </div>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-300">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
