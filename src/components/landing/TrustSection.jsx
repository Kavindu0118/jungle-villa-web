export default function TrustSection() {
  return (
    <section className="bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-xl font-semibold text-slate-900">Everything Your Restaurant Needs. One Connected Platform.</p>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
              Smart POS connects customer ordering, waiter operations, cashier billing, kitchen workflows, payments, and business insights in one cloud-based system.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {['Faster Ordering', 'Better Staff Efficiency', 'Real-Time Management', 'Cloud-Based Access'].map((item) => (
              <div key={item} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
