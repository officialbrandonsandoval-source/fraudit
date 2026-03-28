"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface GhostHospice {
  name: string;
  address: string;
  city: string;
  zip: string;
  riskScore: number;
  anomalies: string[];
}

export default function CAGhostHospiceReport() {
  const [data, setData] = useState<GhostHospice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/reports/ca-ghost-hospices.json")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/" className="mb-6 inline-block text-[13px] text-zinc-600 hover:text-zinc-300 transition-colors duration-200">
        ← Back to Fraudit
      </Link>

      <h1 className="mb-2 text-3xl font-semibold tracking-tight">
        <span className="bg-gradient-to-b from-red-400 to-red-600 bg-clip-text text-transparent">California Ghost Hospice Report</span>
      </h1>
      <p className="mb-10 text-[13px] text-zinc-500">
        Providers enrolled with Medicare but reporting $0 in billing — possible ghost
        operations that bill Medicaid instead, staying off the radar.
      </p>

      {loading ? (
        <p className="text-zinc-600 text-[13px]">Loading report...</p>
      ) : data.length === 0 ? (
        <p className="text-zinc-600 text-[13px]">No ghost hospices found in California.</p>
      ) : (
        <>
          <p className="mb-5 text-[13px] text-zinc-600">
            {data.length} provider{data.length !== 1 ? "s" : ""} flagged
          </p>
          <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.03]">
                  <th className="px-4 py-3.5 text-[11px] font-medium text-zinc-600 uppercase tracking-wider">Provider Name</th>
                  <th className="px-4 py-3.5 text-[11px] font-medium text-zinc-600 uppercase tracking-wider">City</th>
                  <th className="px-4 py-3.5 text-[11px] font-medium text-zinc-600 uppercase tracking-wider text-right">Risk Score</th>
                  <th className="px-4 py-3.5 text-[11px] font-medium text-zinc-600 uppercase tracking-wider">Anomalies</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-white/[0.03] transition-all duration-200 hover:bg-white/[0.04]"
                  >
                    <td className="px-4 py-3.5 font-medium text-zinc-200">{row.name}</td>
                    <td className="px-4 py-3.5 text-zinc-500">{row.city}</td>
                    <td className="px-4 py-3.5 text-right">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${
                          row.riskScore >= 60
                            ? "bg-red-500/10 text-red-400 shadow-[0_0_8px_rgba(220,38,38,0.1)]"
                            : row.riskScore >= 30
                              ? "bg-yellow-500/10 text-yellow-400"
                              : "bg-emerald-500/10 text-emerald-400"
                        }`}
                      >
                        {row.riskScore}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        {row.anomalies.map((a, j) => (
                          <span
                            key={j}
                            className="rounded-md bg-red-500/[0.06] px-2 py-0.5 text-[11px] text-red-400/80 border border-red-500/10"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
