"use client";

import { useState } from "react";
import Link from "next/link";

interface WatchlistItem {
  id: string;
  name: string | null;
  email: string;
  filters: {
    category?: string;
    state?: string;
    minRiskScore?: number;
  };
  active: boolean;
  createdAt: string;
}

export default function WatchlistPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [state, setState] = useState("");
  const [minRisk, setMinRisk] = useState(50);
  const [watchlists, setWatchlists] = useState<WatchlistItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [upgradeNeeded, setUpgradeNeeded] = useState(false);

  async function loadWatchlists() {
    if (!email.trim()) return;
    const res = await fetch(`/api/watchlist?email=${encodeURIComponent(email)}`);
    const data = await res.json();
    if (Array.isArray(data)) {
      setWatchlists(data);
      setLoaded(true);
    }
  }

  async function createWatchlist() {
    if (!email.trim()) return;
    setCreating(true);
    setError("");
    setUpgradeNeeded(false);

    const filters: Record<string, unknown> = {};
    if (category) filters.category = category;
    if (state) filters.state = state;
    filters.minRiskScore = minRisk;

    const res = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name: name || null, filters }),
    });

    if (res.status === 403) {
      setUpgradeNeeded(true);
      setCreating(false);
      return;
    }

    if (!res.ok) {
      setError("Failed to create watchlist");
      setCreating(false);
      return;
    }

    setName("");
    setCategory("");
    setState("");
    setMinRisk(50);
    setCreating(false);
    loadWatchlists();
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-2 text-3xl font-bold">Watchlists</h1>
      <p className="mb-8 text-zinc-400 text-sm">
        Create watchlists to monitor providers matching your criteria. Get notified when new providers appear or risk scores change.
      </p>

      {/* Email input + load */}
      <div className="mb-8">
        <label className="mb-2 block text-sm text-zinc-400">Your email</label>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-accent"
          />
          <button
            onClick={loadWatchlists}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm transition hover:bg-white/5"
          >
            Load My Watchlists
          </button>
        </div>
      </div>

      {/* Create form */}
      <div className="mb-8 rounded-xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-lg font-semibold">Create New Watchlist</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Watchlist Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. California Hospices"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-2 text-sm text-white outline-none focus:border-accent"
            >
              <option value="">All Categories</option>
              <option value="healthcare">Healthcare</option>
              <option value="va">VA Contractors</option>
              <option value="childcare">Child Care</option>
              <option value="ghost">Ghost Operations</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">State</label>
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="e.g. CA, TX, NY"
              maxLength={2}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Minimum Risk Score: {minRisk}</label>
            <input
              type="range"
              min={0}
              max={100}
              value={minRisk}
              onChange={(e) => setMinRisk(Number(e.target.value))}
              className="mt-2 w-full accent-red-500"
            />
          </div>
        </div>
        <button
          onClick={createWatchlist}
          disabled={creating || !email.trim()}
          className="mt-4 rounded-lg bg-accent px-6 py-2 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
        >
          {creating ? "Creating..." : "Create Watchlist"}
        </button>

        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        {upgradeNeeded && (
          <div className="mt-3 rounded-lg border border-accent/30 bg-accent/10 p-3">
            <p className="text-sm text-zinc-300">
              Free tier is limited to <span className="font-medium text-white">1 watchlist</span>.{" "}
              <Link href="/pricing" className="text-accent hover:underline font-medium">Upgrade to Pro</Link> for unlimited watchlists.
            </p>
          </div>
        )}
      </div>

      {/* Free tier note */}
      <p className="mb-6 text-xs text-zinc-600">
        1 watchlist included free. Pro: unlimited watchlists + daily email digests.
      </p>

      {/* Existing watchlists */}
      {loaded && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Your Watchlists</h2>
          {watchlists.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-zinc-500 text-sm">
              No watchlists yet. Create one above.
            </div>
          ) : (
            <div className="space-y-3">
              {watchlists.map((w) => (
                <div key={w.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-zinc-100">{w.name || "Unnamed Watchlist"}</p>
                      <p className="text-xs text-zinc-500">
                        {w.filters.state ? `State: ${w.filters.state}` : "All states"}
                        {" · "}
                        {w.filters.category || "All categories"}
                        {" · "}
                        Min risk: {w.filters.minRiskScore ?? 0}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${w.active ? "bg-green-500/20 text-green-400" : "bg-zinc-500/20 text-zinc-400"}`}>
                      {w.active ? "Active" : "Paused"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
