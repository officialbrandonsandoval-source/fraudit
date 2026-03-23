import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: provider } = await supabase
    .from("Provider")
    .select("name, riskScore, anomalies")
    .eq("id", id)
    .single();

  if (!provider) {
    return { title: "Provider Not Found — Fraudit" };
  }

  const description = `Risk score ${provider.riskScore}/100. ${provider.anomalies?.[0] || "No anomalies flagged."} View full report on Fraudit.`;

  return {
    title: `${provider.name} — Fraudit Risk Report`,
    description,
    openGraph: {
      title: `${provider.name} — Fraudit Risk Report`,
      description,
      type: "website",
      url: `https://usefraudit.com/provider/${id}`,
      siteName: "Fraudit",
    },
    twitter: {
      card: "summary_large_image",
      title: `${provider.name} — Fraudit Risk Report`,
      description,
    },
  };
}

export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
