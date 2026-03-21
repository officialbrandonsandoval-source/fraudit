import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const revalidate = 300;

export async function GET() {
  const { data, error } = await supabase
    .from("Provider")
    .select("state, riskScore, totalPaid");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const byState: Record<string, { totalProviders: number; totalFlagged: number; highRisk: number }> = {};

  for (const row of data || []) {
    const st = row.state;
    if (!byState[st]) {
      byState[st] = { totalProviders: 0, totalFlagged: 0, highRisk: 0 };
    }
    byState[st].totalProviders++;
    if (row.riskScore >= 60) {
      byState[st].totalFlagged += row.totalPaid || 0;
      byState[st].highRisk++;
    }
  }

  const result = Object.entries(byState).map(([state, stats]) => ({
    state,
    ...stats,
  }));

  return NextResponse.json(result);
}
