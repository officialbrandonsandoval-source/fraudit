import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — Fraudit",
  description:
    "How Fraudit works: public data sources, risk scoring methodology, and the mission behind the platform.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-14">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">About Fraudit</h1>
      <p className="mb-12 text-zinc-600 text-[13px]">
        Follow the money. Built on public data. Open to everyone.
      </p>

      {/* Mission */}
      <section className="mb-12">
        <h2 className="mb-4 text-xl font-semibold">Mission</h2>
        <p className="text-zinc-400 text-[13px] leading-relaxed">
          Fraudit exists to make public healthcare spending data accessible and actionable.
          Every year, an estimated <strong className="bg-gradient-to-r from-red-400 to-red-500 bg-clip-text text-transparent">$100 billion+</strong> in
          Medicare and Medicaid fraud goes undetected. The data to find it has always been
          public — scattered across CMS payment files, state registries, IRS 990s, and
          county assessor records. Fraudit assembles it into a single searchable platform
          with statistical risk scoring.
        </p>
      </section>

      {/* How it works */}
      <section className="mb-12">
        <h2 className="mb-5 text-xl font-semibold">How It Works</h2>
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
            <div key={item.step} className="flex gap-4 glass-card p-5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-[13px] font-bold text-red-400 border border-red-500/20">
                {item.step}
              </div>
              <div>
                <h3 className="font-medium text-zinc-200">{item.title}</h3>
                <p className="mt-1 text-[13px] text-zinc-500 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Data sources */}
      <section className="mb-12">
        <h2 className="mb-4 text-xl font-semibold">Data Sources</h2>
        <ul className="space-y-3 text-[13px] text-zinc-500">
          {[
            "CMS Medicare Provider Utilization & Payment Data (Part B, DMEPOS)",
            "USASpending.gov — federal contracts and grants",
            "IRS Form 990 — tax-exempt organization filings",
            "State business registries (Secretary of State filings)",
            "County assessor / property records",
          ].map((src) => (
            <li key={src} className="flex items-start gap-2.5">
              <span className="text-red-400/80 mt-0.5 shrink-0">▸</span>
              <span>{src}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[11px] text-zinc-700">
          All data is publicly available. Fraudit does not access any non-public or protected health information.
        </p>
      </section>

      {/* Disclaimer */}
      <section className="mb-12 rounded-2xl border border-amber-500/10 bg-amber-500/[0.03] p-6 backdrop-blur-xl">
        <h2 className="mb-2 text-lg font-semibold text-amber-400/90">Important Disclaimer</h2>
        <p className="text-[12px] text-amber-400/70 leading-relaxed">
          Fraudit surfaces statistical anomalies — not proof of fraud, wrongdoing, or illegal
          activity. A high risk score means a provider&apos;s billing patterns deviate significantly
          from peers. All findings should be independently verified before publication or action.
          Fraudit is a research tool, not an enforcement instrument.
        </p>
      </section>

      {/* Contact */}
      <section>
        <h2 className="mb-3 text-xl font-semibold">Get in Touch</h2>
        <p className="text-[13px] text-zinc-500 mb-5">
          Journalists, researchers, and tipsters — we want to hear from you.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/contact"
            className="rounded-xl bg-gradient-to-b from-red-500 to-red-700 px-5 py-2.5 text-[13px] font-medium text-white shadow-lg shadow-red-500/20 transition-all duration-200 hover:shadow-red-500/30 hover:brightness-110"
          >
            Submit a Tip
          </Link>
          <Link
            href="/improve"
            className="rounded-xl border border-white/[0.06] px-5 py-2.5 text-[13px] text-zinc-400 transition-all duration-200 hover:bg-white/[0.06] hover:text-zinc-200 hover:border-white/[0.12]"
          >
            Suggest Improvement
          </Link>
        </div>
      </section>
    </div>
  );
}
