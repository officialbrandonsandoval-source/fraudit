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
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/" className="mb-6 inline-block text-sm text-zinc-500 hover:text-white">
        ← Back to Fraudit
      </Link>

      <h1 className="mb-2 text-3xl font-bold">
        <span className="text-accent">California Ghost Hospice Report</span>
      </h1>
      <p className="mb-8 text-sm text-zinc-400">
        Providers enrolled with Medicare but reporting $0 in billing — possible ghost
        operations that bill Medicaid instead, staying off the radar.
      </p>

      {loading ? (
        <p className="text-zinc-500">Loading report...</p>
      ) : data.length === 0 ? (
        <p className="text-zinc-500">No ghost hospices found in California.</p>
      ) : (
        <>
          <p className="mb-4 text-sm text-zinc-500">
            {data.length} provider{data.length !== 1 ? "s" : ""} flagged
          </p>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-3 font-medium text-zinc-400">Provider Name</th>
                  <th className="px-4 py-3 font-medium text-zinc-400">City</th>
                  <th className="px-4 py-3 font-medium text-zinc-400 text-right">Risk Score</th>
                  <th className="px-4 py-3 font-medium text-zinc-400">Anomalies</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-white/5 transition hover:bg-white/5"
                  >
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="px-4 py-3 text-zinc-400">{row.city}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                          row.riskScore >= 60
                            ? "bg-red-500/20 text-red-400"
                            : row.riskScore >= 30
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-green-500/20 text-green-400"
                        }`}
                      >
                        {row.riskScore}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {row.anomalies.map((a, j) => (
                          <span
                            key={j}
                            className="rounded bg-red-500/10 px-2 py-0.5 text-xs text-red-400"
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
