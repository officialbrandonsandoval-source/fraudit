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
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-2 text-3xl font-bold">
        <span className="text-accent">Work with Fraudit</span>
      </h1>

      <div className="mb-10 space-y-4 text-sm text-zinc-400 leading-relaxed">
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

      {submitted ? (
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-8 text-center">
          <div className="mb-2 text-lg font-semibold text-green-400">Message sent</div>
          <p className="text-sm text-zinc-400">
            Thank you for reaching out. We&apos;ll get back to you shortly.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Name *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Email *</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Affiliation (org/publication)</label>
            <input
              type="text"
              value={form.affiliation}
              onChange={(e) => setForm({ ...form, affiliation: e.target.value })}
              placeholder="e.g. ProPublica, University of Michigan"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Message *</label>
            <textarea
              required
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              rows={5}
              placeholder="Tell us about your investigation or how we can help..."
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-accent"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-accent px-6 py-3 font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send Message"}
          </button>
        </form>
      )}
    </div>
  );
}
