export default function PricingSection() {
  return (
    <section id="packages" className="bg-white text-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-500">Choose the Right Solution for Your Restaurant</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Choose the right solution for your restaurant</h2>
          <p className="mt-4 text-base leading-8 text-slate-600">Start with our ready-to-use solution or build a system around your unique requirements.</p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-emerald-300/30 bg-slate-950 p-8 text-white shadow-2xl shadow-emerald-500/10">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-emerald-300">Standard Package</p>
                <h3 className="mt-4 text-3xl font-semibold">Ready-to-Use Restaurant Solution</h3>
              </div>
              <span className="rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-200">Recommended</span>
            </div>
            <div className="mt-8 space-y-6">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-slate-300">Installation</p>
                <p className="mt-2 text-4xl font-semibold text-white">LKR 30,000</p>
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-slate-300">Monthly</p>
                <p className="mt-2 text-3xl font-semibold text-white">LKR 5,000 / month</p>
              </div>
            </div>
            <ul className="mt-10 space-y-3 text-sm leading-7 text-slate-200">
              {['QR Digital Menu', 'QR Customer Ordering', 'Cashier POS System', 'Android Waiter App', 'Kitchen Order Printing', 'Table Management', 'Order Splitting', 'Cash & Card Payment Management', 'Cloud Dashboard', 'Menu Management', 'Basic Analytics & Sales Reports', 'Automatic Cloud Backup', 'Software Updates', 'Technical Support'].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <a href="#contact" className="mt-10 inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400">
              Book Free Demo
            </a>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-8 shadow-sm">
            <p className="text-sm uppercase tracking-[0.28em] text-emerald-600">Custom Package</p>
            <h3 className="mt-4 text-3xl font-semibold text-slate-950">Customized Restaurant Solution</h3>
            <div className="mt-8 space-y-6 text-slate-700">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Installation</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">LKR 30,000 – 60,000</p>
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Monthly</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">LKR 8,000 / month</p>
              </div>
              <p className="text-sm leading-7 text-slate-600">Everything in the Standard Package plus custom features and modifications based on your restaurant’s specific requirements.</p>
            </div>
            <ul className="mt-8 space-y-3 text-sm leading-7 text-slate-700">
              {['Custom workflows', 'Additional reports', 'Special integrations', 'Custom operational requirements'].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <a href="#contact" className="mt-10 inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:border-slate-400 hover:bg-slate-100">
              Discuss Your Requirements
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
