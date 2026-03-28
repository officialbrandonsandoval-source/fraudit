import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const alt = "Fraudit Provider Risk Report";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: provider } = await supabase
    .from("Provider")
    .select("name, city, state, totalPaid, riskScore, anomalies")
    .eq("id", id)
    .single();

  if (!provider) {
    return new ImageResponse(
      (
        <div style={{ display: "flex", width: "100%", height: "100%", background: "#050505", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 40 }}>
          Provider not found
        </div>
      ),
      { ...size }
    );
  }

  const score = provider.riskScore;
  const scoreColor = score >= 60 ? "#dc2626" : score >= 30 ? "#eab308" : "#22c55e";
  const riskLabel = score >= 60 ? "HIGH RISK" : score >= 30 ? "MEDIUM RISK" : "LOW RISK";
  const topAnomaly = provider.anomalies?.[0] || "";
  const totalFormatted = provider.totalPaid >= 1_000_000
    ? `$${(provider.totalPaid / 1_000_000).toFixed(1)}M`
    : `$${Math.round(provider.totalPaid).toLocaleString()}`;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "#050505",
          padding: "48px 60px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "auto" }}>
          <span style={{ fontSize: 24, fontWeight: 700, color: "#dc2626" }}>Fraudit</span>
          <span style={{ fontSize: 16, color: "#71717a" }}>Follow the money</span>
        </div>

        {/* Provider name */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "20px" }}>
          <div style={{ fontSize: 44, fontWeight: 700, color: "#ffffff", textAlign: "center", maxWidth: "900px", overflow: "hidden", textOverflow: "ellipsis" }}>
            {provider.name}
          </div>
        </div>

        {/* Score */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "24px" }}>
          <div style={{ fontSize: 120, fontWeight: 700, color: scoreColor, lineHeight: 1 }}>
            {score}
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, color: scoreColor, marginTop: "8px", letterSpacing: "2px" }}>
            {riskLabel}
          </div>
          {topAnomaly && (
            <div style={{ fontSize: 16, color: "#dc2626", marginTop: "12px", opacity: 0.8 }}>
              {topAnomaly}
            </div>
          )}
        </div>

        {/* Bottom info */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "auto" }}>
          <div style={{ fontSize: 18, color: "#a1a1aa" }}>
            {provider.city}, {provider.state} · {totalFormatted} total received
          </div>
          <div style={{ fontSize: 16, color: "#52525b" }}>fraudit.com</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
