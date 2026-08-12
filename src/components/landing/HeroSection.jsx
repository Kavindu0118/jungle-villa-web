import heroImage from "../../assets/hero-image.png";

export default function HeroSection() {
  return (
    <section id="home" className="relative overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_45%)]" />
      <div className="mx-auto grid max-w-7xl gap-16 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-24">
        <div className="relative z-10 flex flex-col justify-center gap-8 sm:gap-10">
          
          <div className="max-w-2xl space-y-6">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">SMART ORDERING. SMART MANAGEMENT.</p>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
              The Complete Restaurant Management Solution for Modern Cafés & Restaurants.
            </h1>
            <p className="max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
              Give your customers an easier way to order, empower your staff with smarter tools, and manage your entire restaurant from one connected platform.
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <a href="#contact" className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">
              Book a Free Demo
            </a>
            <a href="https://smartpos.worthsoftwares.com/" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900/90 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:text-white">
              Explore Smart POS
            </a>
          </div>     
        </div>

        <div className="relative flex items-center justify-end">
          <img
            src={heroImage}
            alt="Restaurant ordering dashboard"
            className="w-full max-w-2xl rounded-[1.75rem] object-cover shadow-2xl shadow-slate-950/40"
          />
        </div>
      </div>
    </section>
  )
}
