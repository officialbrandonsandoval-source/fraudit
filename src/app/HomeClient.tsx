"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";

interface Provider {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  programs: string[];
  totalPaid: number;
  riskScore: number;
  anomalies: string[];
}

interface Stats {
  totalProviders: number;
  totalAllPaid: number;
  totalFlagged: number;
  totalTips: number;
}

const STATE_ABBR: Record<string, string> = {
  "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
  "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
  "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID",
  "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS",
  "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
  "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS",
  "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK",
  "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT",
  "vermont": "VT", "virginia": "VA", "washington": "WA", "west virginia": "WV",
  "wisconsin": "WI", "wyoming": "WY", "district of columbia": "DC",
};

function buildSearchQuery(raw: string): string {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  if (STATE_ABBR[lower]) return STATE_ABBR[lower];
  const cityStateMatch = trimmed.match(/^(.+?)[,\s]+([A-Za-z]{2})$/);
  if (cityStateMatch) {
    return cityStateMatch[1].trim() + " " + cityStateMatch[2].toUpperCase();
  }
  for (const [fullName, abbr] of Object.entries(STATE_ABBR)) {
    const pattern = new RegExp(`^(.+?)[,\\s]+${fullName}$`, "i");
    const m = trimmed.match(pattern);
    if (m) return m[1].trim() + " " + abbr;
  }
  return trimmed;
}

function formatDollars(amount: number): string {
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${Math.round(amount)}`;
}

function RiskBadge({ score }: { score: number }) {
  const color =
    score >= 60
      ? "bg-red-500/20 text-red-400 border-red-500/30"
      : score >= 30
        ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
        : "bg-green-500/20 text-green-400 border-green-500/30";
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${color}`}>
      {score}
    </span>
  );
}

function RiskBar({ score }: { score: number }) {
  const pct = Math.min(score, 100);
  const color = score >= 60 ? "bg-red-500" : score >= 30 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div className="h-1 w-12 rounded-full bg-white/10">
      <div className={`h-1 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function HomeClient({
  initialStats,
  initialTop50,
}: {
  initialStats: Stats;
  initialTop50: Provider[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [displayStats, setDisplayStats] = useState({
    providers: initialStats.totalProviders,
    allPaid: initialStats.totalAllPaid,
    flagged: initialStats.totalFlagged,
    tips: initialStats.totalTips,
  });

  // Count-up animation on mount
  useEffect(() => {
    if (!initialStats.totalProviders) return;
    const duration = 1200;
    const steps = duration / 20;
    let step = 0;
    // Reset to 0 to animate
    setDisplayStats({ providers: 0, allPaid: 0, flagged: 0, tips: 0 });
    const interval = setInterval(() => {
      step++;
      const progress = Math.min(step / steps, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplayStats({
        providers: Math.round(initialStats.totalProviders * ease),
        allPaid: Math.round(initialStats.totalAllPaid * ease),
        flagged: Math.round(initialStats.totalFlagged * ease),
        tips: Math.round(initialStats.totalTips * ease),
      });
      if (step >= steps) clearInterval(interval);
    }, 20);
    return () => clearInterval(interval);
  }, [initialStats]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const normalized = buildSearchQuery(query);
    if (normalized) {
      router.push(`/search?q=${encodeURIComponent(normalized)}`);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">

      {/* ── Hero ── */}
      <div className="mb-10 text-center">
        <h1 className="mb-3 text-5xl font-bold tracking-tight sm:text-6xl">
          <span className="text-accent">Fraudit</span>
        </h1>
        <p className="mb-6 text-lg text-zinc-400">Follow the money.</p>

        {/* MASSIVE LIVE TOTAL */}
        <div className="mb-2">
          <div className="inline-block">
            <p className="mb-1 text-xs uppercase tracking-widest text-zinc-600">Total Medicare Payments Tracked</p>
            <div className="text-6xl font-black tabular-nums tracking-tight text-white sm:text-7xl md:text-8xl">
              {displayStats.allPaid > 0 ? formatDollars(displayStats.allPaid) : (
                <span className="text-zinc-700">$—</span>
              )}
            </div>
            <p className="mt-2 text-sm text-zinc-600">
              across{" "}
              <span className="text-zinc-400 font-medium">
                {displayStats.providers > 0 ? displayStats.providers.toLocaleString() : "—"} providers
              </span>
              {" · "}
              <span className="text-red-400 font-medium">
                {displayStats.flagged > 0 ? formatDollars(displayStats.flagged) : "—"} flagged high-risk
              </span>
              {" · "}
              <span className="text-zinc-500">
                {displayStats.tips > 0 ? displayStats.tips.toLocaleString() : "0"} tips submitted
              </span>
            </p>
          </div>
        </div>

        <p className="mx-auto mt-6 max-w-xl text-sm text-zinc-600">
          Real-time fraud risk scores built on public government data —
          search any provider, address, city, state, or zip code.
        </p>
      </div>

      {/* ── Search Bar ── */}
      <form onSubmit={handleSearch} className="mb-4 w-full">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Los Angeles CA · Phoenix, Arizona · 90210 · provider name · address..."
            className="w-full rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-lg text-white placeholder-zinc-600 outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-accent px-5 py-2 font-medium text-white transition hover:bg-red-600"
          >
            Search
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-zinc-600">
          Try: &quot;California&quot; · &quot;Los Angeles CA&quot; · &quot;San Diego, California&quot; · &quot;90210&quot; · &quot;Provider Name&quot; · any street address
        </p>
      </form>

      {/* ── Top 50 Highest Flagged ── */}
      <div className="mb-20">
        <div className="mb-4 flex items-center gap-3">
          <span className="text-accent text-lg">⚑</span>
          <h2 className="text-lg font-bold tracking-wide">Top 50 Highest-Flagged Providers</h2>
          <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-400 border border-red-500/20">
            Live Rankings
          </span>
        </div>

        {initialTop50.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-6 py-8 text-center text-zinc-500 text-sm">
            Rankings will appear as data is ingested.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-left text-xs text-zinc-500">
                  <th className="px-4 py-3 w-8">#</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Location</th>
                  <th className="px-4 py-3 hidden md:table-cell">Total Received</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {initialTop50.map((p, i) => (
                  <tr
                    key={p.id}
                    className="border-b border-white/5 transition hover:bg-white/5 last:border-0"
                  >
                    <td className="px-4 py-3 text-zinc-600 font-mono text-xs">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-100 truncate max-w-[200px] sm:max-w-xs">
                        {p.name}
                      </div>
                      {p.anomalies.length > 0 && (
                        <div className="text-xs text-red-400/70 mt-0.5 truncate max-w-[200px] sm:max-w-xs">
                          {p.anomalies[0]}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-400 hidden sm:table-cell whitespace-nowrap">
                      {p.city}, {p.state}
                    </td>
                    <td className="px-4 py-3 text-zinc-300 hidden md:table-cell whitespace-nowrap">
                      ${p.totalPaid.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <RiskBadge score={p.riskScore} />
                        <RiskBar score={p.riskScore} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/provider/${p.id}`}
                        className="rounded border border-white/10 px-3 py-1 text-xs text-zinc-400 hover:bg-white/5 hover:text-white transition whitespace-nowrap"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Preamble / Mission ── */}
      <div className="border-t border-white/10 pt-16">

        {/* Origin story */}
        <div className="mb-12">
          <h2 className="mb-6 text-2xl font-bold tracking-tight">
            Why This Exists
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <p className="text-zinc-300 leading-relaxed text-sm">
                In early 2026, independent journalist{" "}
                <a
                  href="https://www.youtube.com/@nickshirley"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline font-medium"
                >
                  Nick Shirley
                </a>{" "}
                published a 40-minute video documenting over{" "}
                <strong className="text-white">$170 million in suspected Medicaid fraud</strong>{" "}
                in California — ghost daycares, phantom hospice patients, and addresses billing millions
                with no building in sight. He did it the hard way: driving to addresses with a camera.
              </p>
              <p className="mt-4 text-zinc-400 leading-relaxed text-sm">
                His work was so compelling he was called to testify before Congress. But the tool he needed
                to do that investigation in <em>seconds</em> instead of months didn&apos;t exist. So we built it.
              </p>
              <a
                href="https://www.youtube.com/@nickshirley"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2 text-sm text-accent hover:bg-accent/20 transition"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                </svg>
                Watch Nick Shirley&apos;s Investigation
              </a>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h3 className="mb-3 font-semibold text-zinc-200">What Fraudit Does</h3>
              <ul className="space-y-3 text-sm text-zinc-400">
                <li className="flex gap-3">
                  <span className="text-accent mt-0.5 shrink-0">▸</span>
                  <span>Ingests all public CMS Medicare/Medicaid payment data, USASpending.gov, IRS 990s, state registries, and county assessor records</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-accent mt-0.5 shrink-0">▸</span>
                  <span>Scores every provider 0–100 based on statistical anomalies — billing outliers, enrollment spikes, cross-owner links, license age vs. volume</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-accent mt-0.5 shrink-0">▸</span>
                  <span>Generates shareable, journalist-friendly reports with a single URL — so a finding that took Nick months takes 3 seconds</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-accent mt-0.5 shrink-0">▸</span>
                  <span>Accepts anonymous public tips on any provider — crowdsourced ground truth that improves the model over time</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Journalist tools */}
        <div className="mb-12">
          <h2 className="mb-2 text-2xl font-bold tracking-tight">Built for Journalists</h2>
          <p className="mb-6 text-zinc-500 text-sm">
            We build for the investigators who do the work. These journalists have used public data to expose
            what governments don&apos;t want found — and every confirmed case they publish becomes training data
            that makes Fraudit more accurate.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {[
              {
                name: "Nick Shirley",
                handle: "@nickshirley",
                description: "Exposed $170M+ in CA Medicaid fraud. Testified before Congress. The reason this tool exists.",
                url: "https://www.youtube.com/@nickshirley",
                tag: "YouTube · Medicaid Fraud",
              },
              {
                name: "ProPublica",
                handle: "propublica.org",
                description: "Pioneered the Surgeon Scorecard and Dollars for Docs — the standard for public data journalism.",
                url: "https://www.propublica.org",
                tag: "Investigative · National",
              },
              {
                name: "MuckRock",
                handle: "muckrock.com",
                description: "FOIA request platform that has produced thousands of government document disclosures.",
                url: "https://www.muckrock.com",
                tag: "FOIA · Public Records",
              },
            ].map((j) => (
              <a
                key={j.name}
                href={j.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl border border-white/10 bg-white/5 p-5 hover:border-accent/40 hover:bg-accent/5 transition"
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <span className="font-semibold text-zinc-100 group-hover:text-accent transition">{j.name}</span>
                  <span className="text-[10px] text-zinc-600 bg-white/5 rounded px-2 py-0.5 shrink-0 mt-0.5">{j.tag}</span>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">{j.description}</p>
                <span className="mt-3 inline-block text-xs text-accent/70 group-hover:text-accent transition">
                  {j.handle} →
                </span>
              </a>
            ))}
          </div>
          <p className="mt-4 text-xs text-zinc-600">
            Are you an investigative journalist using public data to expose government fraud?{" "}
            <Link href="/contact" className="text-accent hover:underline">
              We want to support your work.
            </Link>
          </p>
        </div>

        {/* The problem */}
        <div className="mb-12 rounded-xl border border-white/10 bg-white/5 p-8">
          <h2 className="mb-4 text-xl font-bold">The Problem We&apos;re Solving</h2>
          <div className="grid gap-6 md:grid-cols-3 text-sm">
            <div>
              <div className="mb-2 text-3xl font-bold text-accent">$100B+</div>
              <p className="text-zinc-400">Estimated annual Medicare and Medicaid fraud in the US, per CMS and HHS OIG estimates</p>
            </div>
            <div>
              <div className="mb-2 text-3xl font-bold text-zinc-200">40 min</div>
              <p className="text-zinc-400">The length of Nick Shirley&apos;s investigation video — representing months of manual driving and cross-referencing</p>
            </div>
            <div>
              <div className="mb-2 text-3xl font-bold text-green-400">3 sec</div>
              <p className="text-zinc-400">How long a Fraudit search takes to surface the same anomalies — built entirely on data that was already public</p>
            </div>
          </div>
          <p className="mt-6 text-zinc-500 text-sm leading-relaxed">
            Every data source Fraudit uses is publicly available. CMS publishes provider payment data.
            USASpending.gov publishes every federal contract and grant. IRS 990s are public record.
            State business registries are online. County assessor data is open.
            <strong className="text-zinc-300"> The information was always there — it just needed to be assembled.</strong>
          </p>
        </div>

        {/* Disclaimer */}
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5">
          <p className="text-xs text-yellow-400/80 leading-relaxed">
            <strong className="text-yellow-400">Important:</strong>{" "}
            Fraudit surfaces statistical anomalies from public data. A high risk score means a provider&apos;s
            billing patterns deviate significantly from peers — it is <em>not</em> proof of fraud, wrongdoing,
            or illegal activity. All findings should be independently verified before publication or action.
            Fraudit is a research tool, not an enforcement instrument.
          </p>
        </div>

      </div>
    </div>
  );
}
