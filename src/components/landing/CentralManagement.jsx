export default function CentralManagement() {
  return (
    <section className="bg-white text-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-500">Your Restaurant. Connected in One Place.</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Your restaurant. connected in one place.</h2>
          <p className="mt-4 text-base leading-8 text-slate-600">Smart POS brings customer ordering, waiter tools, POS, kitchen printing and cloud management into a unified restaurant system.</p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { title: 'Customers', label: 'QR / Web Ordering' },
            { title: 'Staff', label: 'Waiter App' },
            { title: 'Cashier', label: 'POS' },
            { title: 'Kitchen', label: 'Order Printing' },
            { title: 'Management', label: 'Cloud Dashboard' },
          ].map((item) => (
            <div key={item.title} className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6 text-center shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-500">{item.title}</p>
              <p className="mt-4 text-xl font-semibold text-slate-950">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
