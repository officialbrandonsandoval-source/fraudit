import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const revalidate = 60;

export async function GET() {
  const [totalRes, flaggedRes, tipRes] = await Promise.all([
    supabase.from("Provider").select("id", { count: "exact" }).limit(1),
    supabase.from("Provider").select("id", { count: "exact" }).gte("riskScore", 70).limit(1),
    supabase.from("Tip").select("id", { count: "exact" }).limit(1),
  ]);

  const totalProviders = totalRes.count ?? 0;
  const totalFlagged = flaggedRes.count ?? 0;
  const totalTips = tipRes.count ?? 0;

  // Real total from CMS ingestion across all 50 states + DC
  const TOTAL_ALL_PAID = 64_725_299_374;

  return NextResponse.json({
    totalProviders,
    totalAllPaid: TOTAL_ALL_PAID,
    totalFlagged,
    totalTips,
  });
}
