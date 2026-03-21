import Link from "next/link";

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
}

function RiskBadge({ score }: { score: number }) {
  const color =
    score >= 60
      ? "bg-red-500/20 text-red-400 border-red-500/30"
      : score >= 30
        ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
        : "bg-green-500/20 text-green-400 border-green-500/30";

  return (
    <span className={`rounded-full border px-3 py-1 text-sm font-bold ${color}`}>
      {score}
    </span>
  );
}

async function searchProviders(query: string): Promise<Provider[]> {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${base}/api/search?q=${encodeURIComponent(query)}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q || "";
  const providers = await searchProviders(query);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h2 className="mb-1 text-2xl font-bold">
        Results for &ldquo;{query}&rdquo;
      </h2>
      <p className="mb-8 text-sm text-zinc-500">
        {providers.length} provider{providers.length !== 1 && "s"} found
      </p>

      {providers.length === 0 ? (
        <p className="text-zinc-400">
          No providers matched your search. Try a different name, address, or
          zip code.
        </p>
      ) : (
        <div className="space-y-4">
          {providers.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-white/10 bg-white/5 p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-3">
                    <h3 className="text-lg font-semibold">{p.name}</h3>
                    <RiskBadge score={p.riskScore} />
                  </div>
                  <p className="text-sm text-zinc-400">
                    {p.address}, {p.city}, {p.state} {p.zip}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.programs.map((prog) => (
                      <span
                        key={prog}
                        className="rounded bg-white/10 px-2 py-0.5 text-xs text-zinc-300"
                      >
                        {prog}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-sm text-zinc-400">
                    Total received:{" "}
                    <span className="font-medium text-zinc-200">
                      ${p.totalPaid.toLocaleString()}
                    </span>
                  </p>
                  {p.anomalies.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {p.anomalies.map((a, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-red-400"
                        >
                          <span className="mt-0.5 text-red-500">&#9888;</span>
                          {a}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <Link
                  href={`/provider/${p.id}`}
                  className="shrink-0 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium transition hover:bg-white/5"
                >
                  View Full Report
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
