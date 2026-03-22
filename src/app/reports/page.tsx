import Link from "next/link";

const reports = [
  {
    title: "CA Ghost Hospices",
    description:
      "Providers enrolled with Medicare but reporting $0 in billing — possible ghost operations staying off the radar.",
    href: "/reports/ca-ghost-hospices",
    state: "California",
    badge: "Hospice Fraud",
  },
];

export default function ReportsPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-2 text-3xl font-bold">
        <span className="text-accent">Reports</span>
      </h1>
      <p className="mb-8 text-sm text-zinc-400">
        In-depth fraud analysis reports built on public CMS data.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {reports.map((report) => (
          <Link
            key={report.href}
            href={report.href}
            className="group rounded-xl border border-white/10 bg-white/5 p-6 transition hover:border-white/20 hover:bg-white/10"
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">
                {report.badge}
              </span>
              <span className="text-xs text-zinc-500">{report.state}</span>
            </div>
            <h2 className="mb-2 text-lg font-semibold text-white group-hover:text-accent transition">
              {report.title}
            </h2>
            <p className="text-sm text-zinc-400">{report.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
