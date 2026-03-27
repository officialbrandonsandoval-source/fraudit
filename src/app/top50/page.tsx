import { supabase } from "@/lib/supabase";
import Link from "next/link";
import type { Metadata } from "next";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Top 50 Highest-Risk Providers — Fraudit",
  description:
    "The 50 Medicare/Medicaid providers with the highest statistical fraud risk scores, ranked by anomaly severity.",
};

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
    <div className="h-[3px] w-16 rounded-full bg-white/[0.06]">
      <div className={`h-[3px] rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default async function Top50Page() {
  const { data: providers } = await supabase
    .from("Provider")
    .select("id, name, address, city, state, zip, programs, totalPaid, riskScore, anomalies")
    .order("riskScore", { ascending: false })
    .limit(50);

  const rows = providers ?? [];

  return (
    <div className="mx-auto max-w-5xl px-6 py-14">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-accent text-xl">⚑</span>
          <h1 className="text-3xl font-semibold tracking-tight">Top 50 Highest-Risk Providers</h1>
        </div>
        <p className="text-zinc-600 text-[13px] max-w-2xl">
          Ranked by statistical fraud risk score. Scores reflect billing anomalies, enrollment patterns,
          and cross-referencing with public records — not proof of wrongdoing.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="glass-card px-6 py-14 text-center text-zinc-600 text-[13px]">
          Rankings will appear as data is ingested.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.03] text-left text-[11px] uppercase tracking-wider text-zinc-600">
                <th className="px-4 py-3.5 w-10 font-medium">#</th>
                <th className="px-4 py-3.5 font-medium">Provider</th>
                <th className="px-4 py-3.5 hidden sm:table-cell font-medium">Location</th>
                <th className="px-4 py-3.5 hidden md:table-cell font-medium">Total Received</th>
                <th className="px-4 py-3.5 hidden lg:table-cell font-medium">Top Anomaly</th>
                <th className="px-4 py-3.5 font-medium">Risk</th>
                <th className="px-4 py-3.5 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => (
                <tr
                  key={p.id}
                  className="border-b border-white/[0.03] transition-all duration-200 hover:bg-white/[0.04] last:border-0"
                >
                  <td className="px-4 py-3.5 text-zinc-700 font-mono text-[11px]">{i + 1}</td>
                  <td className="px-4 py-3.5">
                    <Link
                      href={`/provider/${p.id}`}
                      className="font-medium text-zinc-200 hover:text-accent transition-colors duration-200 truncate block max-w-[200px] sm:max-w-xs"
                    >
                      {p.name}
                    </Link>
                    <div className="text-[11px] text-zinc-600 sm:hidden">
                      {p.city}, {p.state}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-zinc-500 hidden sm:table-cell whitespace-nowrap">
                    {p.city}, {p.state}
                  </td>
                  <td className="px-4 py-3.5 text-zinc-400 hidden md:table-cell whitespace-nowrap font-mono text-[12px]">
                    ${p.totalPaid?.toLocaleString()}
                  </td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    {p.anomalies?.length > 0 && (
                      <span className="text-[11px] text-red-400/60 truncate block max-w-[250px]">
                        {p.anomalies[0]}
                      </span>
                    )}
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

      <div className="mt-8 rounded-2xl border border-amber-500/10 bg-amber-500/[0.03] p-5 backdrop-blur-xl">
        <p className="text-[12px] text-amber-400/70 leading-relaxed">
          <strong className="text-amber-400/90">Note:</strong>{" "}
          Risk scores are statistical indicators, not accusations. A high score means billing patterns
          deviate from peers — independent verification is always required.
        </p>
      </div>
    </div>
  );
}
