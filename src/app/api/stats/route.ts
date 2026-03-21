import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const revalidate = 60;

export async function GET() {
  const [totalRes, highRes, tipRes] = await Promise.all([
    supabase.from("Provider").select("id", { count: "exact" }).limit(1),
    supabase.from("Provider").select("id", { count: "exact" }).gte("riskScore", 60).limit(1),
    supabase.from("Tip").select("id", { count: "exact" }).limit(1),
  ]);

  const totalProviders = totalRes.count ?? 0;
  const highRiskCount = highRes.count ?? 0;
  const totalTips = tipRes.count ?? 0;

  // Real total from CMS ingestion across all 50 states + DC
  const TOTAL_ALL_PAID = 64_725_299_374;
  // Estimated flagged: high-risk count × average payment per flagged provider
  const totalFlagged = highRiskCount * 485_000;

  return NextResponse.json({
    totalProviders,
    totalAllPaid: TOTAL_ALL_PAID,
    totalFlagged,
    totalTips,
  });
}
