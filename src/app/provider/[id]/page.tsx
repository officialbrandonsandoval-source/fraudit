"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

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
  licenseDate: string | null;
  ownerId: string | null;
  createdAt: string;
}

function RiskBadge({ score }: { score: number }) {
  const color =
    score >= 60
      ? "bg-red-500/20 text-red-400 border-red-500/30"
      : score >= 30
        ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
        : "bg-green-500/20 text-green-400 border-green-500/30";
  const label = score >= 60 ? "High Risk" : score >= 30 ? "Medium Risk" : "Low Risk";

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-bold ${color}`}>
      <span className="text-2xl">{score}</span>
      <span className="text-xs font-normal opacity-80">{label}</span>
    </div>
  );
}

// Placeholder billing chart using simple bars
function BillingChart() {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const values = [42, 48, 45, 67, 89, 134, 187, 245, 312, 389, 456, 523];
  const max = Math.max(...values);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6">
      <h3 className="mb-4 text-lg font-semibold">Monthly Billing Trend</h3>
      <div className="flex items-end gap-2" style={{ height: 160 }}>
        {months.map((m, i) => (
          <div key={m} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-accent/70 transition-all"
              style={{ height: `${(values[i] / max) * 140}px` }}
            />
            <span className="text-[10px] text-zinc-500">{m}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        Mock data — real billing trends will come from CMS payment records
      </p>
    </div>
  );
}

export default function ProviderPage() {
  const params = useParams();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);
  const [tipOpen, setTipOpen] = useState(false);
  const [tipContent, setTipContent] = useState("");
  const [tipSent, setTipSent] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/provider/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        setProvider(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.id]);

  async function submitTip() {
    if (!tipContent.trim()) return;
    await fetch("/api/tip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerId: params.id, content: tipContent }),
    });
    setTipSent(true);
    setTipContent("");
  }

  function copyUrl() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-zinc-500">
        Loading...
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="flex items-center justify-center py-24 text-zinc-500">
        Provider not found.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{provider.name}</h1>
          <p className="mt-1 text-zinc-400">
            {provider.address}, {provider.city}, {provider.state} {provider.zip}
          </p>
          <div className="mt-3">
            <RiskBadge score={provider.riskScore} />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={copyUrl}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm transition hover:bg-white/5"
          >
            {copied ? "Copied!" : "Share"}
          </button>
          <button
            onClick={() => setTipOpen(true)}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600"
          >
            Submit a Tip
          </button>
        </div>
      </div>

      {/* Info grid */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs text-zinc-500">Total Received</p>
          <p className="mt-1 text-2xl font-bold">
            ${provider.totalPaid.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs text-zinc-500">Programs</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {provider.programs.map((p) => (
              <span
                key={p}
                className="rounded bg-white/10 px-2 py-0.5 text-xs"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs text-zinc-500">License Date</p>
          <p className="mt-1 text-lg font-medium">
            {provider.licenseDate
              ? new Date(provider.licenseDate).toLocaleDateString()
              : "Unknown"}
          </p>
        </div>
      </div>

      {/* Anomaly breakdown */}
      {provider.anomalies.length > 0 && (
        <div className="mb-8 rounded-xl border border-red-500/20 bg-red-500/5 p-6">
          <h3 className="mb-3 text-lg font-semibold text-red-400">
            Anomaly Flags
          </h3>
          <ul className="space-y-2">
            {provider.anomalies.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 text-red-500">&#9888;</span>
                <span className="text-zinc-300">{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Billing chart */}
      <div className="mb-8">
        <BillingChart />
      </div>

      {/* Related entities placeholder */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <h3 className="mb-2 text-lg font-semibold">Related Entities</h3>
        <p className="text-sm text-zinc-500">
          Same owner or same address connections will appear here once the data
          pipeline is active.
        </p>
      </div>

      {/* Tip modal */}
      {tipOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-zinc-900 p-6">
            <h3 className="mb-4 text-lg font-semibold">Submit a Tip</h3>
            {tipSent ? (
              <div>
                <p className="mb-4 text-green-400">
                  Thank you! Your tip has been recorded.
                </p>
                <button
                  onClick={() => {
                    setTipOpen(false);
                    setTipSent(false);
                  }}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm transition hover:bg-white/5"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <textarea
                  value={tipContent}
                  onChange={(e) => setTipContent(e.target.value)}
                  placeholder="Describe what you know about this provider..."
                  className="mb-4 h-32 w-full rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-accent"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setTipOpen(false)}
                    className="rounded-lg border border-white/10 px-4 py-2 text-sm transition hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitTip}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600"
                  >
                    Submit
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
