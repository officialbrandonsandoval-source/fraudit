"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SuccessContent() {
  const params = useSearchParams();
  const tier = params.get("tier") || "pro";
  const mock = params.get("mock");

  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <div className="mb-6 text-6xl">✓</div>
      <h1 className="mb-4 text-3xl font-bold">You are in.</h1>
      <p className="mb-2 text-lg text-zinc-300">
        Fraudit <span className="font-bold text-accent capitalize">{tier}</span> is active.
      </p>
      {mock && (
        <p className="mb-4 text-xs text-zinc-500">(Mock mode — connect Stripe to process real payments)</p>
      )}
      <p className="mb-8 text-sm text-zinc-400">
        You now have access to dossier reports, unlimited watchlists, and the full investigative toolkit.
      </p>
      <Link
        href="/search"
        className="inline-block rounded-lg bg-accent px-6 py-3 font-medium text-white transition hover:bg-red-600"
      >
        Start Investigating →
      </Link>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24 text-zinc-500">Loading...</div>}>
      <SuccessContent />
    </Suspense>
  );
}
