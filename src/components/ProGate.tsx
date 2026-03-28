"use client";

import { useState } from "react";

const TIERS = [
  {
    name: "Reporter",
    price: "$49/mo",
    tier: "reporter",
    features: ["10 dossiers/mo", "5 watchlists", "Daily digest emails"],
  },
  {
    name: "Pro",
    price: "$149/mo",
    tier: "pro",
    features: ["Unlimited dossiers", "Unlimited watchlists", "API access", "Priority support"],
    popular: true,
  },
  {
    name: "Newsroom",
    price: "$499/mo",
    tier: "newsroom",
    features: ["Team access (5 seats)", "White-label reports", "Webhook alerts", "Dedicated support"],
  },
];

export default function ProGate({
  children,
  message,
}: {
  children: React.ReactNode;
  message?: string;
}) {
  const [showModal, setShowModal] = useState(false);
  const [checkoutEmail, setCheckoutEmail] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  async function handleCheckout(tier: string) {
    if (!checkoutEmail.trim()) return;
    setCheckoutLoading(tier);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier, email: checkoutEmail }),
    });
    const data = await res.json();
    setCheckoutLoading(null);
    if (data.url) {
      window.location.href = data.url;
    }
  }

  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-40 blur-[1px]">
        {children}
      </div>
      <div
        className="absolute inset-0 flex cursor-pointer items-center justify-center"
        onClick={() => setShowModal(true)}
      >
        <div className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/90 px-6 py-4 backdrop-blur">
          <svg className="h-6 w-6 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span className="text-sm text-zinc-300">{message || "Pro feature — click to upgrade"}</span>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-3xl rounded-xl border border-white/10 bg-zinc-900 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-2 text-2xl font-bold text-center">Upgrade to Fraudit Pro</h2>
            <p className="mb-6 text-center text-sm text-zinc-400">Unlock the full investigative toolkit.</p>

            <div className="mb-6 flex justify-center">
              <input
                type="email"
                value={checkoutEmail}
                onChange={(e) => setCheckoutEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-72 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-accent"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {TIERS.map((t) => (
                <div
                  key={t.tier}
                  className={`rounded-xl border p-5 ${
                    t.popular
                      ? "border-accent/40 bg-accent/5"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  {t.popular && (
                    <span className="mb-2 inline-block rounded-full bg-accent/20 px-2 py-0.5 text-xs text-accent">Most Popular</span>
                  )}
                  <h3 className="text-lg font-bold">{t.name}</h3>
                  <p className="mb-4 text-2xl font-bold text-accent">{t.price}</p>
                  <ul className="mb-4 space-y-2">
                    {t.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-zinc-300">
                        <span className="text-green-400">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleCheckout(t.tier)}
                    disabled={!checkoutEmail.trim() || checkoutLoading === t.tier}
                    className={`w-full rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
                      t.popular
                        ? "bg-accent text-white hover:bg-red-600"
                        : "border border-white/10 text-zinc-300 hover:bg-white/5"
                    }`}
                  >
                    {checkoutLoading === t.tier ? "Loading..." : "Get Started"}
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowModal(false)}
              className="mt-4 block w-full text-center text-sm text-zinc-500 hover:text-zinc-300"
            >
              Maybe later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
