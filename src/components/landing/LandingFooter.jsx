export default function LandingFooter() {
  return (
    <footer className="border-t border-slate-200/10 bg-slate-950 text-slate-300">
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.3fr_0.9fr_0.9fr]">
          <div>
            <p className="text-xl font-semibold uppercase tracking-[0.24em] text-white">SMART POS</p>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">
              Smart Ordering. Smart Management. Worth Softwares delivers restaurant technology that connects QR ordering, waiter tools, POS, kitchen workflows and cloud reporting.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Product</p>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              <li>
                <a href="https://smartpos.worthsoftwares.com/" target="_blank" rel="noreferrer" className="transition hover:text-white">
                  Smart POS Dashboard
                </a>
              </li>
              <li>
                <a href="https://worthsoftwares.com/" target="_blank" rel="noreferrer" className="transition hover:text-white">
                  Worth Softwares
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Contact</p>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              <li>
                <a href="tel:+94764549169" className="transition hover:text-white">+94 76 454 9169</a>
              </li>
              <li>
                <a href="tel:+94785522049" className="transition hover:text-white">+94 78 552 2049</a>
              </li>
              <li>
                <a href="https://worthsoftwares.com/" target="_blank" rel="noreferrer" className="transition hover:text-white">
                  worthsoftwares.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800/60 pt-6 text-sm text-slate-500">
          © 2026 Worth Softwares. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
