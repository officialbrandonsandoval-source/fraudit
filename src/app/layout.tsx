import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fraudit — Follow the Money",
  description:
    "Real-time fraud risk scores built on public government data. Search any provider, address, or zip code.",
  metadataBase: new URL("https://usefraudit.com"),
  openGraph: {
    title: "Fraudit — Follow the Money",
    description:
      "Real-time fraud risk scores built on public government data. Search any provider, address, or zip code.",
    url: "https://usefraudit.com",
    siteName: "Fraudit",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fraudit — Follow the Money",
    description:
      "Real-time fraud risk scores built on public government data. Search any provider, address, or zip code.",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Fraudit",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <meta name="theme-color" content="#dc2626" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <nav className="glass-nav sticky top-0 z-50 px-4 py-3 sm:px-6 sm:py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <span className="text-xl font-bold tracking-tight text-accent transition-all duration-300 group-hover:drop-shadow-[0_0_8px_rgba(220,38,38,0.4)] sm:text-2xl">Fraudit</span>
              <span className="hidden text-[13px] font-medium text-zinc-600 sm:inline">
                Follow the money
              </span>
            </Link>
            <div className="flex items-center gap-0.5 text-[13px] font-medium">
              <Link href="/map" className="rounded-lg px-2.5 py-1.5 text-zinc-500 transition-all duration-200 hover:bg-white/[0.06] hover:text-zinc-200 sm:px-3">
                Map
              </Link>
              <Link href="/states" className="rounded-lg px-2.5 py-1.5 text-zinc-500 transition-all duration-200 hover:bg-white/[0.06] hover:text-zinc-200 sm:px-3">
                States
              </Link>
              <Link href="/top50" className="rounded-lg px-2.5 py-1.5 text-zinc-500 transition-all duration-200 hover:bg-white/[0.06] hover:text-zinc-200 sm:px-3">
                Top 50
              </Link>
              <Link href="/reports" className="rounded-lg px-2.5 py-1.5 text-zinc-500 transition-all duration-200 hover:bg-white/[0.06] hover:text-zinc-200 sm:px-3">
                Reports
              </Link>
              <Link href="/watchlist" className="rounded-lg px-2.5 py-1.5 text-zinc-500 transition-all duration-200 hover:bg-white/[0.06] hover:text-zinc-200 sm:px-3">
                Watchlists
              </Link>
              <Link href="/pricing" className="rounded-lg px-2.5 py-1.5 text-accent font-medium transition-all duration-200 hover:bg-accent/10 sm:px-3">
                Pro
              </Link>
              <Link href="/contact" className="rounded-lg px-2.5 py-1.5 text-zinc-500 transition-all duration-200 hover:bg-white/[0.06] hover:text-zinc-200 sm:px-3">
                Tip
              </Link>
            </div>
          </div>
        </nav>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-white/[0.04] px-6 py-8 text-center text-xs">
          <div className="mb-3 text-zinc-700">
            Built on public data. Statistical flags only — not proof of
            wrongdoing.
          </div>
          <div className="flex items-center justify-center gap-6">
            <Link href="/about" className="text-zinc-600 transition-all duration-200 hover:text-accent">
              About
            </Link>
            <Link href="/improve" className="text-zinc-600 transition-all duration-200 hover:text-accent">
              Suggest Improvement
            </Link>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
