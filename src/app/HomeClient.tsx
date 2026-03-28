"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  CATEGORIES,
  type CategoryKey,
  matchesCategory,
  primaryCategory,
  getCategoryConfig,
} from "@/lib/categories";

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
      ? "bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_8px_rgba(220,38,38,0.1)]"
      : score >= 30
        ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${color}`}>
      {score}
    </span>
  );
}

function RiskBar({ score }: { score: number }) {
  const pct = Math.min(score, 100);
  const color = score >= 60 ? "bg-gradient-to-r from-red-600 to-red-400" : score >= 30 ? "bg-gradient-to-r from-yellow-600 to-yellow-400" : "bg-gradient-to-r from-emerald-600 to-emerald-400";
  return (
    <div className="h-[3px] w-12 rounded-full bg-white/[0.06]">
      <div className={`h-[3px] rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function SmallCategoryBadge({ category }: { category: CategoryKey }) {
  const config = getCategoryConfig(category);
  if (category === "all") return null;
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium tracking-wide ${config.bgColor} ${config.color} ${config.borderColor}`}
    >
      <span className="mr-0.5">{config.icon}</span>
      {config.label}
    </span>
  );
}

const SIGNAL_ICONS: Record<string, string> = {
  "billing_spike": "📈",
  "ghost": "👻",
  "debarred": "🚫",
  "network": "🔗",
  "default": "📡",
};

function StoryFeedSection() {
  const [stories, setStories] = useState<{ id: string; type: string; headline: string; detail: string; delta: number | null; detectedAt: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/story-feed")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setStories(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="mb-10">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-lg">📡</span>
        <h2 className="text-lg font-bold">Latest Signals — Last 24 Hours</h2>
      </div>
      {loading ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-zinc-500">Loading signals...</div>
      ) : stories.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-zinc-500">
          Signal detection initializing — check back soon
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {stories.map((s) => (
            <div key={s.id} className="rounded-xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10">
              <div className="mb-2 text-2xl">{SIGNAL_ICONS[s.type] || SIGNAL_ICONS["default"]}</div>
              <p className="text-sm font-medium text-zinc-100">{s.headline}</p>
              {s.delta !== null && (
                <p className={`mt-1 text-xs font-bold ${s.delta > 0 ? "text-red-400" : "text-green-400"}`}>
                  {s.delta > 0 ? "+" : ""}{s.delta.toFixed(1)}%
                </p>
              )}
              <p className="mt-1 text-xs text-zinc-500 line-clamp-2">{s.detail}</p>
            </div>
          ))}
        </div>
      )}
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
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>("all");
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

  // Filter top 50 by selected category
  const filteredTop50 =
    selectedCategory === "all"
      ? initialTop50
      : initialTop50.filter((p) => matchesCategory(p, selectedCategory));

  // Compute category counts
  const categoryCounts: Record<string, number> = {};
  for (const cat of CATEGORIES) {
    categoryCounts[cat.key] =
      cat.key === "all"
        ? initialTop50.length
        : initialTop50.filter((p) => matchesCategory(p, cat.key)).length;
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-20">

      {/* ── Hero ── */}
      <div className="relative mb-14 text-center">
        {/* Subtle radial glow behind hero */}
        <div className="pointer-events-none absolute inset-0 -top-20 mx-auto h-[300px] w-[600px] rounded-full bg-red-500/[0.04] blur-[100px]" />
        <h1 className="relative mb-4 text-5xl font-bold tracking-tight sm:text-6xl">
          <span className="bg-gradient-to-b from-red-400 to-red-600 bg-clip-text text-transparent">Fraudit</span>
        </h1>
        <p className="relative mb-8 text-lg font-medium text-zinc-500">Follow the money.</p>

        {/* MASSIVE LIVE TOTAL */}
        <div className="relative mb-2">
          <div className="inline-block">
            <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-zinc-600 font-medium">Total Medicare Payments Tracked</p>
            <div className="text-6xl font-black tabular-nums tracking-tight text-white sm:text-7xl md:text-8xl">
              {displayStats.allPaid > 0 ? formatDollars(displayStats.allPaid) : (
                <span className="text-zinc-800">$—</span>
              )}
            </div>
            <p className="mt-3 text-[13px] text-zinc-600">
              across{" "}
              <span className="text-zinc-400 font-medium">
                {displayStats.providers > 0 ? displayStats.providers.toLocaleString() : "—"} providers
              </span>
              {" · "}
              <span className="text-red-400/90 font-medium">
                {displayStats.flagged > 0 ? formatDollars(displayStats.flagged) : "—"} flagged high-risk
              </span>
              {" · "}
              <span className="text-zinc-600">
                {displayStats.tips > 0 ? displayStats.tips.toLocaleString() : "0"} tips submitted
              </span>
            </p>
          </div>
        </div>

        <p className="relative mx-auto mt-8 max-w-xl text-[13px] leading-relaxed text-zinc-600">
          Real-time fraud risk scores built on public government data —
          search any provider, address, city, state, or zip code.
        </p>
      </div>

      {/* ── Search Bar ── */}
      <form onSubmit={handleSearch} className="mb-6 w-full">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Los Angeles CA · Phoenix, Arizona · 90210 · provider name · address..."
            className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-6 py-4 text-lg text-white placeholder-zinc-700 outline-none transition-all duration-300 backdrop-blur-xl focus:border-red-500/40 focus:bg-white/[0.05]"
          />
          <button
            type="submit"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-xl bg-gradient-to-b from-red-500 to-red-700 px-5 py-2 font-medium text-white shadow-lg shadow-red-500/20 transition-all duration-200 hover:shadow-red-500/30 hover:brightness-110 active:scale-[0.98]"
          >
            Search
          </button>
        </div>
        <p className="mt-3 text-center text-[11px] tracking-wide text-zinc-700">
          Try: &quot;California&quot; · &quot;Los Angeles CA&quot; · &quot;San Diego, California&quot; · &quot;90210&quot; · &quot;Provider Name&quot; · any street address
        </p>
      </form>

      {/* ── Latest Signals ── */}
      <StoryFeedSection />

      {/* ── Top 50 Highest Flagged ── */}
      <div className="mb-24">
        <div className="mb-5 flex items-center gap-3">
          <span className="text-accent text-lg">⚑</span>
          <h2 className="text-lg font-semibold tracking-tight">Top 50 Highest-Flagged Providers</h2>
          <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-[11px] font-medium text-red-400 border border-red-500/15 shadow-[0_0_8px_rgba(220,38,38,0.08)]">
            Live Rankings
          </span>
        </div>

        {/* Category tabs */}
        <div className="mb-5 flex flex-wrap gap-2">
          {CATEGORIES.filter((cat) => !cat.hideIfEmpty || (categoryCounts[cat.key] ?? 0) > 0).map((cat) => {
            const count = categoryCounts[cat.key] ?? 0;
            const isActive = selectedCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={`rounded-lg px-3 py-1.5 text-[13px] border transition-all duration-200 ${
                  isActive
                    ? `${cat.bgColor} ${cat.color} ${cat.borderColor} font-medium`
                    : "border-white/[0.06] text-zinc-600 hover:text-zinc-300 hover:border-white/[0.12] hover:bg-white/[0.03]"
                }`}
              >
                {cat.icon && <span className="mr-1">{cat.icon}</span>}
                {cat.label}
                <span className={`ml-1.5 text-[11px] ${isActive ? "opacity-80" : "opacity-40"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {filteredTop50.length === 0 ? (
          <div className="glass-card px-6 py-10 text-center text-zinc-600 text-[13px]">
            {initialTop50.length === 0
              ? "Rankings will appear as data is ingested."
              : "No providers match this category filter."}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.03] text-left text-[11px] uppercase tracking-wider text-zinc-600">
                  <th className="px-4 py-3.5 w-8 font-medium">#</th>
                  <th className="px-4 py-3.5 font-medium">Provider</th>
                  <th className="px-4 py-3.5 hidden sm:table-cell font-medium">Location</th>
                  <th className="px-4 py-3.5 hidden md:table-cell font-medium">Total Received</th>
                  <th className="px-4 py-3.5 font-medium">Risk</th>
                  <th className="px-4 py-3.5 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {filteredTop50.map((p, i) => (
                  <tr
                    key={p.id}
                    className="border-b border-white/[0.03] transition-all duration-200 hover:bg-white/[0.04] last:border-0"
                  >
                    <td className="px-4 py-3.5 text-zinc-700 font-mono text-[11px]">{i + 1}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-zinc-200 truncate max-w-[160px] sm:max-w-xs">
                          {p.name}
                        </span>
                        <SmallCategoryBadge category={primaryCategory(p)} />
                      </div>
                      {p.anomalies.length > 0 && (
                        <div className="text-[11px] text-red-400/60 mt-0.5 truncate max-w-[200px] sm:max-w-xs">
                          {p.anomalies[0]}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-500 hidden sm:table-cell whitespace-nowrap">
                      {p.city}, {p.state}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-400 hidden md:table-cell whitespace-nowrap font-mono text-[12px]">
                      ${p.totalPaid.toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-1.5">
                        <RiskBadge score={p.riskScore} />
                        <RiskBar score={p.riskScore} />
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/provider/${p.id}`}
                        className="rounded-lg border border-white/[0.06] px-3 py-1.5 text-[11px] font-medium text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200 hover:border-white/[0.12] transition-all duration-200 whitespace-nowrap"
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
      <div className="border-t border-white/[0.04] pt-20">

        {/* Origin story */}
        <div className="mb-16">
          <h2 className="mb-8 text-2xl font-semibold tracking-tight">
            Why This Exists
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="glass-card p-7">
              <p className="text-zinc-300 leading-relaxed text-[13px]">
                In early 2026, independent journalist{" "}
                <a
                  href="https://www.youtube.com/@nickshirley"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline font-medium transition-colors duration-200"
                >
                  Nick Shirley
                </a>{" "}
                published a 40-minute video documenting over{" "}
                <strong className="text-white">$170 million in suspected Medicaid fraud</strong>{" "}
                in California — ghost daycares, phantom hospice patients, and addresses billing millions
                with no building in sight. He did it the hard way: driving to addresses with a camera.
              </p>
              <p className="mt-4 text-zinc-500 leading-relaxed text-[13px]">
                His work was so compelling he was called to testify before Congress. But the tool he needed
                to do that investigation in <em>seconds</em> instead of months didn&apos;t exist. So we built it.
              </p>
              <a
                href="https://www.youtube.com/@nickshirley"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.07] px-4 py-2.5 text-[13px] font-medium text-red-400 hover:bg-red-500/[0.12] hover:border-red-500/30 transition-all duration-200"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                </svg>
                Watch Nick Shirley&apos;s Investigation
              </a>
            </div>

            <div className="glass-card p-7">
              <h3 className="mb-4 font-semibold text-zinc-200">What Fraudit Does</h3>
              <ul className="space-y-4 text-[13px] text-zinc-500">
                <li className="flex gap-3">
                  <span className="text-red-400/80 mt-0.5 shrink-0">▸</span>
                  <span>Ingests all public CMS Medicare/Medicaid payment data, USASpending.gov, IRS 990s, state registries, and county assessor records</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-red-400/80 mt-0.5 shrink-0">▸</span>
                  <span>Scores every provider 0–100 based on statistical anomalies — billing outliers, enrollment spikes, cross-owner links, license age vs. volume</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-red-400/80 mt-0.5 shrink-0">▸</span>
                  <span>Generates shareable, journalist-friendly reports with a single URL — so a finding that took Nick months takes 3 seconds</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-red-400/80 mt-0.5 shrink-0">▸</span>
                  <span>Accepts anonymous public tips on any provider — crowdsourced ground truth that improves the model over time</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Journalist tools */}
        <div className="mb-16">
          <h2 className="mb-2 text-2xl font-semibold tracking-tight">Built for Journalists</h2>
          <p className="mb-8 text-zinc-600 text-[13px]">
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
                className="group glass-card p-5 hover:border-red-500/20 transition-all duration-300"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span className="font-semibold text-zinc-200 group-hover:text-accent transition-colors duration-200">{j.name}</span>
                  <span className="text-[10px] text-zinc-700 bg-white/[0.04] rounded-md px-2 py-0.5 shrink-0 mt-0.5 font-medium">{j.tag}</span>
                </div>
                <p className="text-[12px] text-zinc-600 leading-relaxed">{j.description}</p>
                <span className="mt-3 inline-block text-[12px] text-red-400/60 group-hover:text-red-400 transition-colors duration-200">
                  {j.handle} →
                </span>
              </a>
            ))}
          </div>
          <p className="mt-5 text-[12px] text-zinc-700">
            Are you an investigative journalist using public data to expose government fraud?{" "}
            <Link href="/contact" className="text-accent hover:underline transition-colors duration-200">
              We want to support your work.
            </Link>
          </p>
        </div>

        {/* The problem */}
        <div className="mb-16 glass-card p-8">
          <h2 className="mb-6 text-xl font-semibold">The Problem We&apos;re Solving</h2>
          <div className="grid gap-8 md:grid-cols-3 text-[13px]">
            <div>
              <div className="mb-2 text-3xl font-bold bg-gradient-to-b from-red-400 to-red-600 bg-clip-text text-transparent">$100B+</div>
              <p className="text-zinc-500">Estimated annual Medicare and Medicaid fraud in the US, per CMS and HHS OIG estimates</p>
            </div>
            <div>
              <div className="mb-2 text-3xl font-bold text-zinc-300">40 min</div>
              <p className="text-zinc-500">The length of Nick Shirley&apos;s investigation video — representing months of manual driving and cross-referencing</p>
            </div>
            <div>
              <div className="mb-2 text-3xl font-bold text-emerald-400">3 sec</div>
              <p className="text-zinc-500">How long a Fraudit search takes to surface the same anomalies — built entirely on data that was already public</p>
            </div>
          </div>
          <p className="mt-8 text-zinc-600 text-[13px] leading-relaxed">
            Every data source Fraudit uses is publicly available. CMS publishes provider payment data.
            USASpending.gov publishes every federal contract and grant. IRS 990s are public record.
            State business registries are online. County assessor data is open.
            <strong className="text-zinc-400"> The information was always there — it just needed to be assembled.</strong>
          </p>
        </div>

        {/* Disclaimer */}
        <div className="rounded-2xl border border-amber-500/10 bg-amber-500/[0.03] p-6 backdrop-blur-xl">
          <p className="text-[12px] text-amber-400/70 leading-relaxed">
            <strong className="text-amber-400/90">Important:</strong>{" "}
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
