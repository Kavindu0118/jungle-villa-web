export default function DashboardSection() {
  return (
    <section className="bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-400">Demo walkthrough</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">See the QR menu system in action</h2>
          <p className="mt-4 text-base leading-8 text-slate-300">
            Watch a quick product demonstration to see how restaurants can manage menu updates, orders, and customer experiences from one platform.
          </p>
        </div>

        <div className="mt-10 overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900 p-3 shadow-2xl shadow-slate-950/50 sm:p-4">
          <div className="aspect-video w-full overflow-hidden rounded-[1.5rem]">
            <iframe
              width="560"
              height="315"
              src="https://www.youtube.com/embed/MTlqXh1t52w?si=AlG-gG8V1q_3Llz7"
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
