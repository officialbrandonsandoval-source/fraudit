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
    <div className="h-1.5 w-16 rounded-full bg-white/10">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
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
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-accent text-xl">⚑</span>
          <h1 className="text-3xl font-bold tracking-tight">Top 50 Highest-Risk Providers</h1>
        </div>
        <p className="text-zinc-400 text-sm max-w-2xl">
          Ranked by statistical fraud risk score. Scores reflect billing anomalies, enrollment patterns,
          and cross-referencing with public records — not proof of wrongdoing.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 px-6 py-12 text-center text-zinc-500 text-sm">
          Rankings will appear as data is ingested.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-left text-xs text-zinc-500">
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3 hidden sm:table-cell">Location</th>
                <th className="px-4 py-3 hidden md:table-cell">Total Received</th>
                <th className="px-4 py-3 hidden lg:table-cell">Top Anomaly</th>
                <th className="px-4 py-3">Risk</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => (
                <tr
                  key={p.id}
                  className="border-b border-white/5 transition hover:bg-white/5 last:border-0"
                >
                  <td className="px-4 py-3 text-zinc-600 font-mono text-xs">{i + 1}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/provider/${p.id}`}
                      className="font-medium text-zinc-100 hover:text-accent transition truncate block max-w-[200px] sm:max-w-xs"
                    >
                      {p.name}
                    </Link>
                    <div className="text-xs text-zinc-500 sm:hidden">
                      {p.city}, {p.state}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 hidden sm:table-cell whitespace-nowrap">
                    {p.city}, {p.state}
                  </td>
                  <td className="px-4 py-3 text-zinc-300 hidden md:table-cell whitespace-nowrap">
                    ${p.totalPaid?.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {p.anomalies?.length > 0 && (
                      <span className="text-xs text-red-400/70 truncate block max-w-[250px]">
                        {p.anomalies[0]}
                      </span>
                    )}
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

      <div className="mt-6 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
        <p className="text-xs text-yellow-400/80 leading-relaxed">
          <strong className="text-yellow-400">Note:</strong>{" "}
          Risk scores are statistical indicators, not accusations. A high score means billing patterns
          deviate from peers — independent verification is always required.
        </p>
      </div>
    </div>
  );
}
