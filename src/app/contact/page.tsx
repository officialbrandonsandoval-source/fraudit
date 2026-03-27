"use client";

import { useState } from "react";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", affiliation: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/contact", {
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
        <span className="bg-gradient-to-b from-red-400 to-red-600 bg-clip-text text-transparent">Work with Fraudit</span>
      </h1>

      <div className="mb-12 space-y-4 text-[13px] text-zinc-500 leading-relaxed">
        <p>
          Fraudit exists to support investigative journalists, researchers, and watchdog
          organizations working to expose government fraud and waste. We build tools that
          turn publicly available data into actionable intelligence — so investigations
          that once took months of manual cross-referencing can happen in seconds.
        </p>
        <p>
          Whether you&apos;re a reporter following a lead, a nonprofit tracking misuse of
          public funds, or a researcher studying systemic fraud patterns — we want to
          hear from you. We offer data access, custom reports, and direct collaboration
          for qualified organizations.
        </p>
      </div>

      <div className="mb-12 glass-card p-6">
        <h3 className="mb-2 text-[13px] font-semibold text-zinc-300">Reports</h3>
        <a
          href="/reports/ca-ghost-hospices"
          className="text-[13px] text-accent hover:underline transition-colors duration-200"
        >
          View CA Ghost Hospice Report →
        </a>
      </div>

      {submitted ? (
        <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.03] p-8 text-center backdrop-blur-xl">
          <div className="mb-2 text-lg font-semibold text-emerald-400">Message sent</div>
          <p className="text-[13px] text-zinc-500">
            Thank you for reaching out. We&apos;ll get back to you shortly.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[11px] text-zinc-600 font-medium uppercase tracking-wider">Name *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[13px] text-white placeholder-zinc-700 outline-none transition-all duration-300 backdrop-blur-xl focus:border-red-500/40"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] text-zinc-600 font-medium uppercase tracking-wider">Email *</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[13px] text-white placeholder-zinc-700 outline-none transition-all duration-300 backdrop-blur-xl focus:border-red-500/40"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] text-zinc-600 font-medium uppercase tracking-wider">Affiliation (org/publication)</label>
            <input
              type="text"
              value={form.affiliation}
              onChange={(e) => setForm({ ...form, affiliation: e.target.value })}
              placeholder="e.g. ProPublica, University of Michigan"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[13px] text-white placeholder-zinc-700 outline-none transition-all duration-300 backdrop-blur-xl focus:border-red-500/40"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] text-zinc-600 font-medium uppercase tracking-wider">Message *</label>
            <textarea
              required
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              rows={5}
              placeholder="Tell us about your investigation or how we can help..."
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[13px] text-white placeholder-zinc-700 outline-none transition-all duration-300 backdrop-blur-xl focus:border-red-500/40"
            />
          </div>

          {error && <p className="text-[13px] text-red-400/80">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-gradient-to-b from-red-500 to-red-700 px-6 py-3 font-medium text-white shadow-lg shadow-red-500/20 transition-all duration-200 hover:shadow-red-500/30 hover:brightness-110 disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send Message"}
          </button>
        </form>
      )}
    </div>
  );
}
