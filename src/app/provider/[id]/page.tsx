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
      ? "bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_12px_rgba(220,38,38,0.1)]"
      : score >= 30
        ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  const label = score >= 60 ? "High Risk" : score >= 30 ? "Medium Risk" : "Low Risk";

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[13px] font-bold ${color}`}>
      <span className="text-2xl">{score}</span>
      <span className="text-[11px] font-medium opacity-70 tracking-wide uppercase">{label}</span>
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
      <div className="glass-card p-7">
        <h3 className="mb-4 text-lg font-semibold">Annual Medicare Billing</h3>
        <p className="text-[13px] text-zinc-600">
          Billing history not available for this provider.
        </p>
      </div>
    );
  }

  const sorted = [...history].sort((a, b) => a.year - b.year);
  const max = Math.max(...sorted.map((e) => e.amount));

  return (
    <div className="glass-card p-7">
      <h3 className="mb-5 text-lg font-semibold">Annual Medicare Billing</h3>
      <div className="flex items-end gap-3" style={{ height: 180 }}>
        {sorted.map((entry) => (
          <div key={entry.year} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="text-[11px] font-medium text-zinc-400 font-mono">
              {formatDollar(entry.amount)}
            </span>
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-red-700 to-red-400 transition-all duration-300 hover:from-red-600 hover:to-red-300"
              style={{ height: `${(entry.amount / max) * 140}px`, minHeight: 4 }}
            />
            <span className="text-[11px] text-zinc-600">{entry.year}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] text-zinc-700">
        Source: CMS Medicare Public Use File
      </p>
    </div>
  );
}

function OwnerNetwork({ ownerId, currentProviderId }: { ownerId: string; currentProviderId: string }) {
  const [siblings, setSiblings] = useState<{ id: string; name: string; city: string; state: string; riskScore: number; totalPaid: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/owner/${ownerId}/providers`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSiblings(data.filter((p: { id: string }) => p.id !== currentProviderId));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [ownerId, currentProviderId]);

  if (loading) {
    return (
      <div className="mb-8 rounded-xl border border-white/10 bg-white/5 p-6">
        <h3 className="mb-2 text-lg font-semibold">Owner Network</h3>
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    );
  }

  if (siblings.length === 0) return null;

  return (
    <div className="mb-8 rounded-xl border border-purple-500/20 bg-purple-500/5 p-6">
      <h3 className="mb-1 text-lg font-semibold text-purple-400">Owner Network</h3>
      <p className="mb-4 text-sm text-zinc-400">
        This owner operates <span className="font-medium text-white">{siblings.length} other {siblings.length === 1 ? "entity" : "entities"}</span>
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {siblings.slice(0, 6).map((s) => (
          <Link
            key={s.id}
            href={`/provider/${s.id}`}
            className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3 transition hover:bg-white/10"
          >
            <div>
              <p className="text-sm font-medium text-zinc-100">{s.name}</p>
              <p className="text-xs text-zinc-500">{s.city}, {s.state}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">{formatDollar(s.totalPaid)}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                s.riskScore >= 60 ? "bg-red-500/20 text-red-400" : s.riskScore >= 30 ? "bg-yellow-500/20 text-yellow-400" : "bg-green-500/20 text-green-400"
              }`}>{s.riskScore}</span>
            </div>
          </Link>
        ))}
      </div>
      {siblings.length > 6 && (
        <p className="mt-2 text-xs text-zinc-500">{siblings.length - 6} more entities not shown</p>
      )}
      <Link
        href={`/owner/${ownerId}`}
        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-sm text-purple-400 transition hover:bg-purple-500/20"
      >
        View Owner Network →
      </Link>
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
      <div className="glass-card p-7">
        <h3 className="mb-2 text-lg font-semibold">Related Entities</h3>
        <p className="text-[13px] text-zinc-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-7">
      <h3 className="mb-4 text-lg font-semibold">Related Entities</h3>
      {related.length === 0 ? (
        <p className="text-[13px] text-zinc-600">No related entities found.</p>
      ) : (
        <ul className="space-y-3">
          {related.map((r) => (
            <li key={r.id} className="flex items-center justify-between text-[13px]">
              <Link
                href={`/provider/${r.id}`}
                className="text-accent hover:underline transition-colors duration-200"
              >
                {r.name}
              </Link>
              <span className="text-zinc-600">
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
  const [dossierOpen, setDossierOpen] = useState(false);
  const [dossierEmail, setDossierEmail] = useState("");
  const [dossierStatus, setDossierStatus] = useState<"idle" | "loading" | "done" | "upgrade">("idle");

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
      <div className="flex items-center justify-center py-24 text-zinc-600 text-[13px]">
        Loading...
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="flex items-center justify-center py-24 text-zinc-600 text-[13px]">
        Provider not found.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      {/* Header */}
      <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{provider.name}</h1>
          <p className="mt-1.5 text-[13px] text-zinc-500">
            {provider.address}, {provider.city}, {provider.state} {provider.zip}
          </p>
          {provider.npi && (
            <p className="mt-0.5 text-[11px] text-zinc-700 font-mono">NPI: {provider.npi}</p>
          )}
          <div className="mt-4 flex items-center gap-3">
            <RiskBadge score={provider.riskScore} />
            {provider.anomalies.some((a) => a.toLowerCase().includes("ghost operation")) && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[13px] font-bold text-red-400 shadow-[0_0_12px_rgba(220,38,38,0.1)]">
                Ghost Operation Risk
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
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.06] px-3 py-2 text-[13px] text-zinc-500 transition-all duration-200 hover:bg-white/[0.06] hover:text-zinc-200 hover:border-white/[0.12]"
            title="Share on X"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            Post
          </button>
          <button
            onClick={copyUrl}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.06] px-3 py-2 text-[13px] text-zinc-500 transition-all duration-200 hover:bg-white/[0.06] hover:text-zinc-200 hover:border-white/[0.12]"
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
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.06] px-3 py-2 text-[13px] text-zinc-500 transition-all duration-200 hover:bg-white/[0.06] hover:text-zinc-200 hover:border-white/[0.12]"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              Share
            </button>
          )}
          <button
            onClick={() => setTipOpen(true)}
            className="rounded-xl bg-gradient-to-b from-red-500 to-red-700 px-4 py-2 text-[13px] font-medium text-white shadow-lg shadow-red-500/20 transition-all duration-200 hover:shadow-red-500/30 hover:brightness-110 active:scale-[0.98]"
          >
            Submit a Tip
          </button>
          <button
            onClick={() => setDossierOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-sm transition hover:bg-white/5"
            title="Pro feature — unlock for $49/mo"
          >
            <svg className="h-4 w-4 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Dossier Report
          </button>
        </div>
      </div>

      {/* Info grid */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="glass-card p-6">
          <p className="text-[11px] text-zinc-600 uppercase tracking-wider font-medium">Total Received</p>
          <p className="mt-2 text-2xl font-bold font-mono">
            ${provider.totalPaid.toLocaleString()}
          </p>
        </div>
        <div className="glass-card p-6">
          <p className="text-[11px] text-zinc-600 uppercase tracking-wider font-medium">Programs</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {provider.programs.map((p) => (
              <span
                key={p}
                className="rounded-md bg-white/[0.05] px-2 py-0.5 text-[11px] text-zinc-400 font-medium"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
        <div className="glass-card p-6">
          <p className="text-[11px] text-zinc-600 uppercase tracking-wider font-medium">License Date</p>
          <p className="mt-2 text-lg font-medium">
            {provider.licenseDate
              ? new Date(provider.licenseDate).toLocaleDateString()
              : "Unknown"}
          </p>
        </div>
      </div>

      {/* Anomaly breakdown */}
      {provider.anomalies.length > 0 && (
        <div className="mb-8 rounded-2xl border border-red-500/10 bg-red-500/[0.03] p-7 backdrop-blur-xl">
          <h3 className="mb-4 text-lg font-semibold text-red-400">
            Anomaly Flags
          </h3>
          <ul className="space-y-2.5">
            {provider.anomalies.map((a, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[13px]">
                <span className="mt-0.5 text-red-500/60">&#9888;</span>
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

      {/* Owner Network */}
      {provider.ownerId && (
        <OwnerNetwork ownerId={provider.ownerId} currentProviderId={provider.id} />
      )}

      {/* Related entities */}
      <div className="mb-8">
        <RelatedEntities providerId={provider.id} />
      </div>

      {/* Alert subscription */}
      <div className="mb-8 glass-card p-7">
        <h3 className="mb-2 text-lg font-semibold">Get Alerts for This Provider</h3>
        <p className="mb-5 text-[13px] text-zinc-500">
          Enter your email to receive notifications when this provider&apos;s risk score changes.
        </p>
        {alertStatus === "done" ? (
          <p className="text-[13px] text-emerald-400">Subscribed! You&apos;ll be notified of changes.</p>
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
              className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-[13px] text-white placeholder-zinc-700 outline-none transition-all duration-300 backdrop-blur-xl focus:border-red-500/40"
            />
            <button
              type="submit"
              disabled={alertStatus === "saving"}
              className="rounded-xl bg-gradient-to-b from-red-500 to-red-700 px-4 py-2.5 text-[13px] font-medium text-white shadow-lg shadow-red-500/20 transition-all duration-200 hover:shadow-red-500/30 hover:brightness-110 disabled:opacity-50"
            >
              {alertStatus === "saving" ? "..." : "Subscribe"}
            </button>
          </form>
        )}
        {alertStatus === "error" && (
          <p className="mt-2 text-[11px] text-red-400/80">Something went wrong. Try again.</p>
        )}
      </div>

      {/* Dossier modal */}
      {dossierOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-zinc-900 p-6">
            <h3 className="mb-4 text-lg font-semibold">Generate Dossier Report</h3>
            {dossierStatus === "done" ? (
              <div>
                <p className="mb-4 text-green-400">Dossier PDF is downloading.</p>
                <button onClick={() => { setDossierOpen(false); setDossierStatus("idle"); }} className="rounded-lg border border-white/10 px-4 py-2 text-sm transition hover:bg-white/5">Close</button>
              </div>
            ) : dossierStatus === "upgrade" ? (
              <div>
                <p className="mb-4 text-zinc-300">Dossier reports are a <span className="text-accent font-medium">Pro feature</span>.</p>
                <div className="flex gap-2">
                  <button onClick={() => { setDossierOpen(false); setDossierStatus("idle"); }} className="rounded-lg border border-white/10 px-4 py-2 text-sm transition hover:bg-white/5">Cancel</button>
                  <Link href="/pricing" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600">Unlock for $49/mo</Link>
                </div>
              </div>
            ) : (
              <>
                <p className="mb-4 text-sm text-zinc-400">Enter your email to generate a full PDF dossier for this provider.</p>
                <input
                  type="email"
                  value={dossierEmail}
                  onChange={(e) => setDossierEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="mb-4 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-accent"
                />
                <div className="flex gap-2">
                  <button onClick={() => setDossierOpen(false)} className="rounded-lg border border-white/10 px-4 py-2 text-sm transition hover:bg-white/5">Cancel</button>
                  <button
                    disabled={dossierStatus === "loading" || !dossierEmail.trim()}
                    onClick={async () => {
                      setDossierStatus("loading");
                      const res = await fetch("/api/dossier", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ providerId: params.id, email: dossierEmail }),
                      });
                      if (res.status === 403) {
                        setDossierStatus("upgrade");
                        return;
                      }
                      if (res.ok) {
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `fraudit-dossier-${provider?.name?.replace(/\s+/g, "-").toLowerCase() || "provider"}.pdf`;
                        a.click();
                        URL.revokeObjectURL(url);
                        setDossierStatus("done");
                      } else {
                        setDossierStatus("idle");
                      }
                    }}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
                  >
                    {dossierStatus === "loading" ? "Generating..." : "Generate PDF"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tip modal */}
      {tipOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-zinc-950/95 p-7 shadow-2xl backdrop-blur-xl">
            <h3 className="mb-5 text-lg font-semibold">Submit a Tip</h3>
            {tipSent ? (
              <div>
                <p className="mb-4 text-emerald-400 text-[13px]">
                  Thank you! Your tip has been recorded.
                </p>
                <button
                  onClick={() => {
                    setTipOpen(false);
                    setTipSent(false);
                  }}
                  className="rounded-xl border border-white/[0.06] px-4 py-2 text-[13px] text-zinc-400 transition-all duration-200 hover:bg-white/[0.06] hover:text-zinc-200"
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
                  className="mb-5 h-32 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-[13px] text-white placeholder-zinc-700 outline-none transition-all duration-300 focus:border-red-500/40"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setTipOpen(false)}
                    className="rounded-xl border border-white/[0.06] px-4 py-2.5 text-[13px] text-zinc-400 transition-all duration-200 hover:bg-white/[0.06] hover:text-zinc-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitTip}
                    className="rounded-xl bg-gradient-to-b from-red-500 to-red-700 px-4 py-2.5 text-[13px] font-medium text-white shadow-lg shadow-red-500/20 transition-all duration-200 hover:shadow-red-500/30 hover:brightness-110"
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
