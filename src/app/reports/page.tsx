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
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">
        <span className="bg-gradient-to-b from-red-400 to-red-600 bg-clip-text text-transparent">Reports</span>
      </h1>
      <p className="mb-10 text-[13px] text-zinc-600">
        In-depth fraud analysis reports built on public CMS data.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {reports.map((report) => (
          <Link
            key={report.href}
            href={report.href}
            className="group glass-card p-6 transition-all duration-300 hover:border-red-500/20"
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-md bg-red-500/10 px-2.5 py-0.5 text-[11px] font-medium text-red-400 border border-red-500/15">
                {report.badge}
              </span>
              <span className="text-[11px] text-zinc-600">{report.state}</span>
            </div>
            <h2 className="mb-2 text-lg font-semibold text-white group-hover:text-accent transition-colors duration-200">
              {report.title}
            </h2>
            <p className="text-[13px] text-zinc-500">{report.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
