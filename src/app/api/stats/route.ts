import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const revalidate = 60;

export async function GET() {
  const [providerRes, allPaidRes, flaggedRes, tipRes] = await Promise.all([
    supabase.from("Provider").select("id", { count: "exact", head: true }),
    supabase.from("Provider").select("totalPaid"),
    supabase.from("Provider").select("totalPaid").gte("riskScore", 60),
    supabase.from("Tip").select("id", { count: "exact", head: true }),
  ]);

  const totalProviders = providerRes.count || 0;
  const totalAllPaid = (allPaidRes.data || []).reduce((sum, r) => sum + (r.totalPaid || 0), 0);
  const totalFlagged = (flaggedRes.data || []).reduce((sum, r) => sum + (r.totalPaid || 0), 0);
  const totalTips = tipRes.count || 0;

  return NextResponse.json({ totalProviders, totalAllPaid, totalFlagged, totalTips });
}
