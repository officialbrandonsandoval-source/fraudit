import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — Fraudit",
  description:
    "How Fraudit works: public data sources, risk scoring methodology, and the mission behind the platform.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold tracking-tight">About Fraudit</h1>
      <p className="mb-10 text-zinc-400 text-sm">
        Follow the money. Built on public data. Open to everyone.
      </p>

      {/* Mission */}
      <section className="mb-10">
        <h2 className="mb-3 text-xl font-semibold">Mission</h2>
        <p className="text-zinc-300 text-sm leading-relaxed">
          Fraudit exists to make public healthcare spending data accessible and actionable.
          Every year, an estimated <strong className="text-accent">$100 billion+</strong> in
          Medicare and Medicaid fraud goes undetected. The data to find it has always been
          public — scattered across CMS payment files, state registries, IRS 990s, and
          county assessor records. Fraudit assembles it into a single searchable platform
          with statistical risk scoring.
        </p>
      </section>

      {/* How it works */}
      <section className="mb-10">
        <h2 className="mb-4 text-xl font-semibold">How It Works</h2>
        <div className="space-y-4">
          {[
            {
              step: "1",
              title: "Data Ingestion",
              desc: "We pull from CMS Medicare Part B/DMEPOS payment files, USASpending.gov, IRS 990 filings, state business registries, and county assessor records across all 50 states + DC.",
            },
            {
              step: "2",
              title: "Risk Scoring",
              desc: "Every provider is scored 0–100 based on statistical anomalies: billing outliers vs. peers, enrollment spikes, cross-owner entity links, license age vs. billing volume, and address verification flags.",
            },
            {
              step: "3",
              title: "Public Access",
              desc: "Anyone can search by provider name, address, city, state, or zip code. Every provider page is shareable with a permanent URL and auto-generated social card.",
            },
            {
              step: "4",
              title: "Community Tips",
              desc: "Anonymous tips on any provider feed back into the system as ground truth, improving scoring accuracy over time.",
            },
          ].map((item) => (
            <div key={item.step} className="flex gap-4 rounded-xl border border-white/10 bg-white/5 p-5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-sm font-bold text-accent">
                {item.step}
              </div>
              <div>
                <h3 className="font-medium text-zinc-100">{item.title}</h3>
                <p className="mt-1 text-sm text-zinc-400 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Data sources */}
      <section className="mb-10">
        <h2 className="mb-3 text-xl font-semibold">Data Sources</h2>
        <ul className="space-y-2 text-sm text-zinc-400">
          {[
            "CMS Medicare Provider Utilization & Payment Data (Part B, DMEPOS)",
            "USASpending.gov — federal contracts and grants",
            "IRS Form 990 — tax-exempt organization filings",
            "State business registries (Secretary of State filings)",
            "County assessor / property records",
          ].map((src) => (
            <li key={src} className="flex items-start gap-2">
              <span className="text-accent mt-0.5 shrink-0">▸</span>
              <span>{src}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-zinc-500">
          All data is publicly available. Fraudit does not access any non-public or protected health information.
        </p>
      </section>

      {/* Disclaimer */}
      <section className="mb-10 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5">
        <h2 className="mb-2 text-lg font-semibold text-yellow-400">Important Disclaimer</h2>
        <p className="text-sm text-yellow-400/80 leading-relaxed">
          Fraudit surfaces statistical anomalies — not proof of fraud, wrongdoing, or illegal
          activity. A high risk score means a provider&apos;s billing patterns deviate significantly
          from peers. All findings should be independently verified before publication or action.
          Fraudit is a research tool, not an enforcement instrument.
        </p>
      </section>

      {/* Contact */}
      <section>
        <h2 className="mb-3 text-xl font-semibold">Get in Touch</h2>
        <p className="text-sm text-zinc-400 mb-4">
          Journalists, researchers, and tipsters — we want to hear from you.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/contact"
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-red-600"
          >
            Submit a Tip
          </Link>
          <Link
            href="/improve"
            className="rounded-lg border border-white/10 px-5 py-2.5 text-sm text-zinc-300 transition hover:bg-white/5"
          >
            Suggest Improvement
          </Link>
        </div>
      </section>
    </div>
  );
}
