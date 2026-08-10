export default function CTASection() {
  return (
    <section className="bg-emerald-500 text-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-100/80">Ready to make your restaurant smarter?</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Ready to make your restaurant smarter?</h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-emerald-100/90">Book a FREE live demonstration and discover how Smart POS can simplify your restaurant operations.</p>
          </div>

          <div className="space-y-4 rounded-[1.75rem] border border-white/20 bg-emerald-600/10 p-8 shadow-lg shadow-emerald-500/20">
            <a href="#contact" className="inline-flex w-full items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-slate-50">
              Book a Free Demo
            </a>
            <a href="tel:+94764549169" className="inline-flex w-full items-center justify-center rounded-full border border-white/20 bg-emerald-500/95 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400">
              Call +94 76 454 9169
            </a>
            <p className="mt-4 text-sm text-emerald-100/90">
              Also available: <a href="tel:+94785522049" className="font-semibold text-white underline">+94 78 552 2049</a>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
