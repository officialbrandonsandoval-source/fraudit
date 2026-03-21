import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin",
  WY: "Wyoming",
};

interface StateStats {
  state: string;
  totalProviders: number;
  totalFlagged: number;
  highRisk: number;
  totalPaid: number;
}

async function getStats(): Promise<StateStats[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data } = await supabase
    .from("Provider")
    .select("state, riskScore, totalPaid");

  const byState: Record<string, StateStats> = {};
  for (const row of data || []) {
    const st = row.state;
    if (!byState[st]) {
      byState[st] = { state: st, totalProviders: 0, totalFlagged: 0, highRisk: 0, totalPaid: 0 };
    }
    byState[st].totalProviders++;
    if (row.riskScore >= 60) {
      byState[st].highRisk++;
      byState[st].totalPaid += row.totalPaid || 0;
    }
    if (row.riskScore >= 30) byState[st].totalFlagged++;
  }

  return Object.values(byState).sort((a, b) => b.highRisk - a.highRisk);
}

function formatDollars(amount: number): string {
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${Math.round(amount)}`;
}

export default async function StatesPage() {
  const stats = await getStats();
  const maxHighRisk = Math.max(...stats.map((s) => s.highRisk), 1);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="mb-2 text-3xl font-bold">
        <span className="text-accent">Browse by State</span>
      </h1>
      <p className="mb-8 text-sm text-zinc-500">
        {stats.length} states with scored providers. Sorted by high-risk count.
      </p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <Link
            key={s.state}
            href={`/search?q=${s.state}`}
            className="group rounded-xl border border-white/10 bg-white/5 p-4 transition hover:border-accent/40 hover:bg-accent/5"
          >
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-lg font-bold text-zinc-100 group-hover:text-accent transition">
                {s.state}
              </span>
              <span className="text-[11px] text-zinc-600">
                {STATE_NAMES[s.state] || s.state}
              </span>
            </div>

            <div className="mb-2 space-y-0.5 text-xs text-zinc-400">
              <div>{s.totalProviders.toLocaleString()} providers</div>
              <div>{formatDollars(s.totalPaid)} flagged</div>
              <div className="text-red-400 font-medium">{s.highRisk} high-risk</div>
            </div>

            {/* Heat bar */}
            <div className="h-1.5 w-full rounded-full bg-white/10">
              <div
                className="h-1.5 rounded-full bg-red-500 transition-all"
                style={{ width: `${(s.highRisk / maxHighRisk) * 100}%` }}
              />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
