import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  CATEGORIES,
  RISK_LEVELS,
  type CategoryKey,
  type RiskLevel,
  matchesCategory,
  matchesRisk,
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

// Full state name → abbreviation (mirrored on server for SSR)
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

const ABBR_STATE: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_ABBR).map(([name, abbr]) => [abbr.toLowerCase(), name])
);

interface SearchParts {
  city?: string;
  state?: string;
  general?: string;
}

function parseQuery(raw: string): SearchParts {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  if (STATE_ABBR[lower]) return { state: STATE_ABBR[lower] };
  if (/^[a-z]{2}$/i.test(trimmed) && ABBR_STATE[lower]) return { state: trimmed.toUpperCase() };
  for (const [fullName, abbr] of Object.entries(STATE_ABBR)) {
    const escaped = fullName.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    const pattern = new RegExp(`^(.+?)[,\\s]+${escaped}(?:\\s+\\d{5})?$`, "i");
    const m = trimmed.match(pattern);
    if (m) return { city: m[1].trim(), state: abbr };
  }
  const cityStateZip = trimmed.match(/^(.+?)[,\s]+([A-Za-z]{2})(?:\s+\d{5})?$/);
  if (cityStateZip) {
    const potentialAbbr = cityStateZip[2].toUpperCase();
    if (ABBR_STATE[potentialAbbr.toLowerCase()]) return { city: cityStateZip[1].trim(), state: potentialAbbr };
  }
  if (/^\d{5}(-\d{4})?$/.test(trimmed)) return { general: trimmed };
  return { general: trimmed };
}

function describeQuery(parts: SearchParts, raw: string): string {
  if (parts.city && parts.state) {
    const stateName = ABBR_STATE[parts.state.toLowerCase()];
    return `${parts.city}, ${stateName ? capitalize(stateName) : parts.state}`;
  }
  if (parts.state && !parts.city) {
    const stateName = ABBR_STATE[parts.state.toLowerCase()];
    return stateName ? capitalize(stateName) : parts.state;
  }
  return raw;
}

function capitalize(s: string) {
  return s.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function RiskBadge({ score }: { score: number }) {
  const color =
    score >= 60
      ? "bg-red-500/20 text-red-400 border-red-500/30"
      : score >= 30
        ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
        : "bg-green-500/20 text-green-400 border-green-500/30";
  return (
    <span className={`rounded-full border px-3 py-1 text-sm font-bold ${color}`}>
      {score}
    </span>
  );
}

function CategoryBadge({ category }: { category: CategoryKey }) {
  const config = getCategoryConfig(category);
  if (category === "all") return null;
  return (
    <span
      className={`rounded border px-2 py-0.5 text-xs font-medium ${config.bgColor} ${config.color} ${config.borderColor}`}
    >
      <span className="mr-1">{config.icon}</span>
      {config.label}
    </span>
  );
}

async function searchProviders(raw: string): Promise<Provider[]> {
  if (!raw) return [];
  const parts = parseQuery(raw);

  let query = supabase
    .from("Provider")
    .select("*")
    .order("riskScore", { ascending: false })
    .limit(200);

  if (parts.city && parts.state) {
    query = query.ilike("city", `%${parts.city}%`).eq("state", parts.state);
  } else if (parts.state) {
    query = query.eq("state", parts.state);
  } else {
    const g = parts.general || raw;
    query = query.or(
      `name.ilike.%${g}%,address.ilike.%${g}%,city.ilike.%${g}%,zip.ilike.%${g}%,state.ilike.%${g}%`
    );
  }

  const { data, error } = await query;
  if (error) { console.error("Search error:", error); return []; }
  return data || [];
}

function buildFilterUrl(q: string, category: string, risk: string): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category && category !== "all") params.set("category", category);
  if (risk && risk !== "all") params.set("risk", risk);
  return `/search?${params.toString()}`;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; risk?: string }>;
}) {
  const { q, category: catParam, risk: riskParam } = await searchParams;
  const query = q || "";
  const selectedCategory = (catParam || "all") as CategoryKey;
  const selectedRisk = (riskParam || "all") as RiskLevel;

  const parts = parseQuery(query);
  const displayLabel = describeQuery(parts, query);
  const allResults = await searchProviders(query);

  // Compute category counts from full results
  const categoryCounts: Record<string, number> = {};
  for (const cat of CATEGORIES) {
    categoryCounts[cat.key] =
      cat.key === "all"
        ? allResults.length
        : allResults.filter((p) => matchesCategory(p, cat.key)).length;
  }

  // Filter by category
  const categoryFiltered =
    selectedCategory === "all"
      ? allResults
      : allResults.filter((p) => matchesCategory(p, selectedCategory));

  // Compute risk counts from category-filtered results
  const riskCounts: Record<string, number> = {};
  for (const level of RISK_LEVELS) {
    riskCounts[level.key] =
      level.key === "all"
        ? categoryFiltered.length
        : categoryFiltered.filter((p) => matchesRisk(p.riskScore, level.key)).length;
  }

  // Apply risk filter
  const providers =
    selectedRisk === "all"
      ? categoryFiltered
      : categoryFiltered.filter((p) => matchesRisk(p.riskScore, selectedRisk));

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      {/* Back + search form inline */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/" className="mb-2 inline-block text-sm text-zinc-500 hover:text-zinc-300 transition">
            ← Back to Fraudit
          </Link>
          <h2 className="text-2xl font-bold">
            {displayLabel}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {providers.length} provider{providers.length !== 1 && "s"} found
            {parts.state && !parts.city && (
              <span className="ml-1 text-zinc-600">· Showing all providers in {parts.state}</span>
            )}
            {parts.city && parts.state && (
              <span className="ml-1 text-zinc-600">· Filtered by city + state</span>
            )}
          </p>
        </div>
      </div>

      {/* Quick re-search */}
      <form action="/search" method="GET" className="mb-6">
        <div className="relative">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search again..."
            className="w-full rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-base text-white placeholder-zinc-600 outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600"
          >
            Search
          </button>
        </div>
      </form>

      {/* Category tabs */}
      <div className="mb-3 flex flex-wrap gap-2">
        {CATEGORIES.filter((cat) => !cat.hideIfEmpty || (categoryCounts[cat.key] ?? 0) > 0).map((cat) => {
          const count = categoryCounts[cat.key] ?? 0;
          const isActive = selectedCategory === cat.key;
          return (
            <Link
              key={cat.key}
              href={buildFilterUrl(query, cat.key, selectedRisk)}
              className={`rounded-lg px-3 py-1.5 text-sm border transition ${
                isActive
                  ? `${cat.bgColor} ${cat.color} ${cat.borderColor} font-medium`
                  : "border-white/10 text-zinc-500 hover:text-zinc-300 hover:border-white/20"
              }`}
            >
              {cat.icon && <span className="mr-1">{cat.icon}</span>}
              {cat.label}
              <span className={`ml-1.5 text-xs ${isActive ? "opacity-80" : "opacity-50"}`}>
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Risk level filters */}
      <div className="mb-8 flex flex-wrap gap-2">
        {RISK_LEVELS.map((level) => {
          const count = riskCounts[level.key] ?? 0;
          const isActive = selectedRisk === level.key;
          return (
            <Link
              key={level.key}
              href={buildFilterUrl(query, selectedCategory, level.key)}
              className={`rounded-full px-3 py-1 text-xs border transition ${
                isActive
                  ? "bg-white/10 text-zinc-200 border-white/20 font-medium"
                  : "border-white/10 text-zinc-600 hover:text-zinc-400 hover:border-white/15"
              }`}
            >
              {level.label}
              <span className={`ml-1 ${isActive ? "opacity-80" : "opacity-50"}`}>
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {providers.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 px-6 py-12 text-center">
          <p className="text-zinc-400 mb-2">No providers matched &ldquo;{query}&rdquo;</p>
          <p className="text-zinc-600 text-sm">
            Try a city name, state abbreviation, zip code, or provider name.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {providers.slice(0, 100).map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-white/10 bg-white/5 p-6 hover:border-white/20 transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-3 flex-wrap">
                    <h3 className="text-lg font-semibold">{p.name}</h3>
                    <RiskBadge score={p.riskScore} />
                    <CategoryBadge category={primaryCategory(p)} />
                  </div>
                  <p className="text-sm text-zinc-400">
                    {p.address}, {p.city}, {p.state} {p.zip}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.programs.map((prog) => (
                      <span
                        key={prog}
                        className="rounded bg-white/10 px-2 py-0.5 text-xs text-zinc-300"
                      >
                        {prog}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-sm text-zinc-400">
                    Total received:{" "}
                    <span className="font-medium text-zinc-200">
                      ${p.totalPaid.toLocaleString()}
                    </span>
                  </p>
                  {p.anomalies.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {p.anomalies.map((a, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-red-400"
                        >
                          <span className="mt-0.5 text-red-500">&#9888;</span>
                          {a}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <Link
                  href={`/provider/${p.id}`}
                  className="shrink-0 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium transition hover:bg-white/5"
                >
                  View Report →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
