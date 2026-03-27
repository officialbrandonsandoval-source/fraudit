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
    <div className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">
        <span className="bg-gradient-to-b from-red-400 to-red-600 bg-clip-text text-transparent">Help Improve Fraudit</span>
      </h1>
      <p className="mb-12 text-[13px] text-zinc-500 leading-relaxed">
        Found a new data source? Know of a fraud pattern we&apos;re missing? Tell us.
        Every suggestion is reviewed — the best ideas get built into the platform.
      </p>

      {submitted ? (
        <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.03] p-8 text-center backdrop-blur-xl">
          <div className="mb-2 text-lg font-semibold text-emerald-400">
            Idea submitted
          </div>
          <p className="text-[13px] text-zinc-500">
            Thank you for helping improve Fraudit. Your suggestion will be reviewed
            and evaluated for implementation.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[11px] text-zinc-600 font-medium uppercase tracking-wider">
              Name (optional)
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Your name"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[13px] text-white placeholder-zinc-700 outline-none transition-all duration-300 backdrop-blur-xl focus:border-red-500/40"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] text-zinc-600 font-medium uppercase tracking-wider">
              Email (optional)
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[13px] text-white placeholder-zinc-700 outline-none transition-all duration-300 backdrop-blur-xl focus:border-red-500/40"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] text-zinc-600 font-medium uppercase tracking-wider">
              Idea Title *
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Track FEMA disaster relief contractor fraud"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[13px] text-white placeholder-zinc-700 outline-none transition-all duration-300 backdrop-blur-xl focus:border-red-500/40"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] text-zinc-600 font-medium uppercase tracking-wider">
              Description *
            </label>
            <textarea
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={5}
              placeholder="Describe the data source, fraud pattern, or improvement idea in detail..."
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[13px] text-white placeholder-zinc-700 outline-none transition-all duration-300 backdrop-blur-xl focus:border-red-500/40"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] text-zinc-600 font-medium uppercase tracking-wider">
              Data Source URL (optional)
            </label>
            <input
              type="url"
              value={form.source_url}
              onChange={(e) => setForm({ ...form, source_url: e.target.value })}
              placeholder="https://data.gov/dataset/..."
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[13px] text-white placeholder-zinc-700 outline-none transition-all duration-300 backdrop-blur-xl focus:border-red-500/40"
            />
          </div>

          {error && <p className="text-[13px] text-red-400/80">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-gradient-to-b from-red-500 to-red-700 px-6 py-3 font-medium text-white shadow-lg shadow-red-500/20 transition-all duration-200 hover:shadow-red-500/30 hover:brightness-110 disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit Idea"}
          </button>
        </form>
      )}
    </div>
  );
}
