"use client";

import { useState } from "react";

const TIERS = [
  {
    name: "Reporter",
    price: "$49",
    period: "/mo",
    tier: "reporter",
    features: ["10 dossier reports/mo", "5 watchlists", "Daily email digests", "Owner network views"],
  },
  {
    name: "Pro",
    price: "$149",
    period: "/mo",
    tier: "pro",
    popular: true,
    features: ["Unlimited dossier reports", "Unlimited watchlists", "API access", "Priority support", "Owner network downloads"],
  },
  {
    name: "Newsroom",
    price: "$499",
    period: "/mo",
    tier: "newsroom",
    features: ["Team access (5 seats)", "White-label reports", "Webhook alerts", "Dedicated support", "Custom data exports"],
  },
];

export default function PricingPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  async function handleCheckout(tier: string) {
    if (!email.trim()) return;
    setLoading(tier);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier, email }),
    });
    const data = await res.json();
    setLoading(null);
    if (data.url) window.location.href = data.url;
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div className="mb-10 text-center">
        <h1 className="mb-3 text-4xl font-bold">Fraudit Pro</h1>
        <p className="text-zinc-400">Unlock the full investigative toolkit.</p>
      </div>

      <div className="mb-8 flex justify-center">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="w-80 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-accent"
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        {TIERS.map((t) => (
          <div
            key={t.tier}
            className={`rounded-xl border p-6 ${
              t.popular ? "border-accent/40 bg-accent/5 ring-1 ring-accent/20" : "border-white/10 bg-white/5"
            }`}
          >
            {t.popular && (
              <span className="mb-3 inline-block rounded-full bg-accent/20 px-3 py-1 text-xs font-medium text-accent">
                Most Popular
              </span>
            )}
            <h2 className="text-xl font-bold">{t.name}</h2>
            <div className="mt-2 mb-6">
              <span className="text-4xl font-bold text-accent">{t.price}</span>
              <span className="text-zinc-500">{t.period}</span>
            </div>
            <ul className="mb-6 space-y-3">
              {t.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-zinc-300">
                  <span className="text-green-400">✓</span> {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleCheckout(t.tier)}
              disabled={!email.trim() || loading === t.tier}
              className={`w-full rounded-lg px-4 py-3 text-sm font-medium transition disabled:opacity-50 ${
                t.popular
                  ? "bg-accent text-white hover:bg-red-600"
                  : "border border-white/10 text-zinc-300 hover:bg-white/5"
              }`}
            >
              {loading === t.tier ? "Loading..." : "Get Started"}
            </button>
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-zinc-600">
        All plans include a 7-day free trial. Cancel anytime.
      </p>
    </div>
  );
}
