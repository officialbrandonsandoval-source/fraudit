import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Fraudit — Follow the Money";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "#0a0a0a",
          padding: "60px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontSize: 48, fontWeight: 700, color: "#ef4444" }}>Fraudit</span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
          }}
        >
          <div style={{ fontSize: 56, fontWeight: 700, color: "#ffffff", textAlign: "center", marginBottom: "16px" }}>
            Follow the Money
          </div>
          <div style={{ fontSize: 24, color: "#a1a1aa", textAlign: "center", maxWidth: "800px" }}>
            Real-time fraud risk scores built on public government data. Search any provider, address, or zip code.
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: "48px", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontSize: 36, fontWeight: 700, color: "#ef4444" }}>$64.7B</span>
            <span style={{ fontSize: 14, color: "#52525b", marginTop: "4px" }}>Payments Tracked</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontSize: 36, fontWeight: 700, color: "#ffffff" }}>50</span>
            <span style={{ fontSize: 14, color: "#52525b", marginTop: "4px" }}>States + DC</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontSize: 36, fontWeight: 700, color: "#22c55e" }}>0–100</span>
            <span style={{ fontSize: 14, color: "#52525b", marginTop: "4px" }}>Risk Score</span>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "24px" }}>
          <span style={{ fontSize: 16, color: "#52525b" }}>usefraudit.com</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
