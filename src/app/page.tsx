"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Home() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <h1 className="mb-2 text-5xl font-bold tracking-tight sm:text-6xl">
        <span className="text-accent">Fraudit</span>
      </h1>
      <p className="mb-8 max-w-md text-center text-lg text-zinc-400">
        Real-time fraud risk scores built on public government data
      </p>

      <form onSubmit={handleSearch} className="w-full max-w-xl">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any provider, address, or zip code"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-lg text-white placeholder-zinc-500 outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-accent px-5 py-2 font-medium text-white transition hover:bg-red-600"
          >
            Search
          </button>
        </div>
      </form>

      <p className="mt-6 max-w-sm text-center text-xs text-zinc-600">
        Statistical anomalies only — not proof of fraud or wrongdoing
      </p>
    </div>
  );
}
