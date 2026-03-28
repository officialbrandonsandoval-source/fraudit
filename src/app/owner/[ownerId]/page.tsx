"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface OwnerProvider {
  id: string;
  name: string;
  city: string;
  state: string;
  riskScore: number;
  totalPaid: number;
}

function formatDollar(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

export default function OwnerNetworkPage() {
  const params = useParams();
  const ownerId = params.ownerId as string;
  const [providers, setProviders] = useState<OwnerProvider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/owner/${ownerId}/providers`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setProviders(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [ownerId]);

  const combinedPaid = providers.reduce((sum, p) => sum + p.totalPaid, 0);
  const highestRisk = providers.length > 0 ? Math.max(...providers.map((p) => p.riskScore)) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-zinc-500">Loading...</div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <Link href="/" className="text-sm text-zinc-500 hover:text-accent transition">← Back</Link>
        <h1 className="mt-2 text-3xl font-bold">
          <span className="text-purple-400">Owner Network</span> — {ownerId}
        </h1>
        <div className="mt-4 flex flex-wrap gap-4">
          <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-3">
            <p className="text-xs text-zinc-500">Entities</p>
            <p className="text-2xl font-bold">{providers.length}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-3">
            <p className="text-xs text-zinc-500">Combined Payments</p>
            <p className="text-2xl font-bold">{formatDollar(combinedPaid)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-3">
            <p className="text-xs text-zinc-500">Highest Risk</p>
            <p className={`text-2xl font-bold ${highestRisk >= 60 ? "text-red-400" : highestRisk >= 30 ? "text-yellow-400" : "text-green-400"}`}>
              {highestRisk}
            </p>
          </div>
        </div>
      </div>

      {providers.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-zinc-500">
          No providers found for this owner.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((p) => (
            <Link
              key={p.id}
              href={`/provider/${p.id}`}
              className="rounded-xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-zinc-100">{p.name}</p>
                  <p className="text-xs text-zinc-500">{p.city}, {p.state}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  p.riskScore >= 60 ? "bg-red-500/20 text-red-400" : p.riskScore >= 30 ? "bg-yellow-500/20 text-yellow-400" : "bg-green-500/20 text-green-400"
                }`}>{p.riskScore}</span>
              </div>
              <p className="mt-2 text-sm text-zinc-400">{formatDollar(p.totalPaid)}</p>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-8">
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-400 transition hover:bg-white/10"
          onClick={() => alert("Pro feature — upgrade at /pricing to download network reports.")}
        >
          <svg className="h-4 w-4 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Download Network Report
        </button>
        <span className="ml-2 text-xs text-zinc-600">Pro feature</span>
      </div>
    </div>
  );
}
