"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface BillingEntry {
  year: number;
  amount: number;
}

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
  npi: string | null;
  billingHistory: BillingEntry[] | null;
}

interface RelatedProvider {
  id: string;
  name: string;
  city: string;
  state: string;
  riskScore: number;
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

function formatDollar(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

function BillingChart({ history }: { history: BillingEntry[] | null }) {
  if (!history || history.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <h3 className="mb-4 text-lg font-semibold">Annual Medicare Billing</h3>
        <p className="text-sm text-zinc-500">
          Billing history not available for this provider.
        </p>
      </div>
    );
  }

  const sorted = [...history].sort((a, b) => a.year - b.year);
  const max = Math.max(...sorted.map((e) => e.amount));

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6">
      <h3 className="mb-4 text-lg font-semibold">Annual Medicare Billing</h3>
      <div className="flex items-end gap-3" style={{ height: 180 }}>
        {sorted.map((entry) => (
          <div key={entry.year} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-xs font-medium text-zinc-300">
              {formatDollar(entry.amount)}
            </span>
            <div
              className="w-full rounded-t bg-accent/70 transition-all hover:bg-accent"
              style={{ height: `${(entry.amount / max) * 140}px`, minHeight: 4 }}
            />
            <span className="text-xs text-zinc-500">{entry.year}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        Source: CMS Medicare Public Use File
      </p>
    </div>
  );
}

function RelatedEntities({ providerId }: { providerId: string }) {
  const [related, setRelated] = useState<RelatedProvider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/provider/${providerId}/related`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setRelated(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [providerId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <h3 className="mb-2 text-lg font-semibold">Related Entities</h3>
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6">
      <h3 className="mb-3 text-lg font-semibold">Related Entities</h3>
      {related.length === 0 ? (
        <p className="text-sm text-zinc-500">No related entities found.</p>
      ) : (
        <ul className="space-y-2">
          {related.map((r) => (
            <li key={r.id} className="flex items-center justify-between text-sm">
              <Link
                href={`/provider/${r.id}`}
                className="text-accent hover:underline"
              >
                {r.name}
              </Link>
              <span className="text-zinc-500">
                {r.city}, {r.state} — Risk: {r.riskScore}
              </span>
            </li>
          ))}
        </ul>
      )}
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
  const [canShare, setCanShare] = useState(false);
  const [alertEmail, setAlertEmail] = useState("");
  const [alertStatus, setAlertStatus] = useState<"idle" | "saving" | "done" | "error">("idle");

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

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
          {provider.npi && (
            <p className="mt-0.5 text-xs text-zinc-500">NPI: {provider.npi}</p>
          )}
          <div className="mt-3 flex items-center gap-3">
            <RiskBadge score={provider.riskScore} />
            {provider.anomalies.some((a) => a.toLowerCase().includes("ghost operation")) && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/20 px-3 py-1.5 text-sm font-bold text-red-400">
                ⚠️ Ghost Operation Risk
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              const url = window.location.href;
              const text = `${provider.name} — Risk Score ${provider.riskScore}/100 on Fraudit`;
              window.open(
                `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
                "_blank",
                "noopener,noreferrer,width=550,height=420"
              );
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-sm transition hover:bg-white/5"
            title="Share on X"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            Post
          </button>
          <button
            onClick={copyUrl}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-sm transition hover:bg-white/5"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            {copied ? "Copied!" : "Copy Link"}
          </button>
          {canShare && (
            <button
              onClick={() => {
                navigator.share({
                  title: `${provider.name} — Fraudit Risk Report`,
                  text: `Risk Score ${provider.riskScore}/100. ${provider.anomalies[0] || "View full report."}`,
                  url: window.location.href,
                });
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-sm transition hover:bg-white/5"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              Share
            </button>
          )}
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
        <BillingChart history={provider.billingHistory} />
      </div>

      {/* Related entities */}
      <div className="mb-8">
        <RelatedEntities providerId={provider.id} />
      </div>

      {/* Alert subscription */}
      <div className="mb-8 rounded-xl border border-white/10 bg-white/5 p-6">
        <h3 className="mb-2 text-lg font-semibold">Get Alerts for This Provider</h3>
        <p className="mb-4 text-sm text-zinc-400">
          Enter your email to receive notifications when this provider&apos;s risk score changes.
        </p>
        {alertStatus === "done" ? (
          <p className="text-sm text-green-400">Subscribed! You&apos;ll be notified of changes.</p>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!alertEmail.trim()) return;
              setAlertStatus("saving");
              try {
                const res = await fetch("/api/alert", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email: alertEmail, providerId: params.id }),
                });
                if (res.ok) {
                  setAlertStatus("done");
                } else {
                  setAlertStatus("error");
                }
              } catch {
                setAlertStatus("error");
              }
            }}
            className="flex gap-2"
          >
            <input
              type="email"
              value={alertEmail}
              onChange={(e) => { setAlertEmail(e.target.value); setAlertStatus("idle"); }}
              placeholder="your@email.com"
              required
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={alertStatus === "saving"}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
            >
              {alertStatus === "saving" ? "..." : "Subscribe"}
            </button>
          </form>
        )}
        {alertStatus === "error" && (
          <p className="mt-2 text-xs text-red-400">Something went wrong. Try again.</p>
        )}
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
