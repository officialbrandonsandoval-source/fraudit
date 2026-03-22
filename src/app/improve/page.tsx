"use client";

import { useState } from "react";

export default function ImprovePage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    title: "",
    description: "",
    source_url: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to submit");
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-2 text-3xl font-bold">
        <span className="text-accent">Help Improve Fraudit</span>
      </h1>
      <p className="mb-10 text-sm text-zinc-400 leading-relaxed">
        Found a new data source? Know of a fraud pattern we&apos;re missing? Tell us.
        Every suggestion is reviewed — the best ideas get built into the platform.
      </p>

      {submitted ? (
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-8 text-center">
          <div className="mb-2 text-lg font-semibold text-green-400">
            Idea submitted
          </div>
          <p className="text-sm text-zinc-400">
            Thank you for helping improve Fraudit. Your suggestion will be reviewed
            and evaluated for implementation.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">
              Name (optional)
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Your name"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">
              Email (optional)
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">
              Idea Title *
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Track FEMA disaster relief contractor fraud"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">
              Description *
            </label>
            <textarea
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={5}
              placeholder="Describe the data source, fraud pattern, or improvement idea in detail..."
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">
              Data Source URL (optional)
            </label>
            <input
              type="url"
              value={form.source_url}
              onChange={(e) => setForm({ ...form, source_url: e.target.value })}
              placeholder="https://data.gov/dataset/..."
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-accent"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-accent px-6 py-3 font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit Idea"}
          </button>
        </form>
      )}
    </div>
  );
}
