import { useState } from "react";

const whatsappNumber = "94764549169";

export default function ContactSection() {
  const [name, setName] = useState("");
  const [business, setBusiness] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();

    const whatsappText = `Hello, my name is ${name || "[No name]"}. ` +
      `Restaurant / Business: ${business || "[No business name]"}. ` +
      `Phone: ${phone || "[No phone]"}. ` +
      `Email: ${email || "[No email]"}. ` +
      `Message: ${message || "[No message]"}.`;

    const encodedText = encodeURIComponent(whatsappText);
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedText}`;

    window.open(whatsappUrl, "_blank");
  };
  return (
    <section id="contact" className="bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-400">Book a Free Demo</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Start with a free live demo.</h2>
            <p className="mt-4 max-w-xl text-base leading-8 text-slate-300">Share your restaurant details and we’ll show you how Smart POS can fit your needs. This is a UI-ready form for future backend integration.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl bg-slate-900/80 p-6">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Contact</p>
                <p className="mt-4 text-lg font-semibold text-white">+94 76 454 9169</p>
                <p className="mt-2 text-sm text-slate-300">+94 78 552 2049</p>
              </div>
              <div className="rounded-3xl bg-slate-900/80 p-6">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Website</p>
                <a href="https://worthsoftwares.com/" target="_blank" rel="noreferrer" className="mt-4 block text-lg font-semibold text-emerald-300 hover:text-white">worthsoftwares.com</a>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="rounded-[1.75rem] border border-white/10 bg-slate-900/90 p-8 shadow-2xl shadow-slate-950/30">
            <div className="grid gap-4">
              <label className="space-y-2 text-sm text-slate-300">
                <span>Name</span>
                <input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-emerald-500"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Restaurant / Business Name</span>
                <input
                  type="text"
                  placeholder="Restaurant name"
                  value={business}
                  onChange={(event) => setBusiness(event.target.value)}
                  className="w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-emerald-500"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Phone Number</span>
                <input
                  type="tel"
                  placeholder="e.g. +94 76 454 9169"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-emerald-500"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Email</span>
                <input
                  type="email"
                  placeholder="email@domain.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-emerald-500"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-300">
                <span>Message</span>
                <textarea
                  rows="4"
                  placeholder="Tell us about your restaurant"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  className="w-full rounded-3xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-emerald-500"
                />
              </label>
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">TODO: connect this form to your demo request backend or email service.</p>
            <button type="submit" className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400">
              Request Demo
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
