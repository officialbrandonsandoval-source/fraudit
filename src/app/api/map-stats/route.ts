import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { type CategoryKey, matchesCategory } from "@/lib/categories";

export const revalidate = 300;

const ALL_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"
];

export async function GET(request: NextRequest) {
  const category = (request.nextUrl.searchParams.get("category") || "all") as CategoryKey;

  if (category !== "all") {
    // Fetch all providers and filter by category in JS
    const { data } = await supabase
      .from("Provider")
      .select("state, programs, anomalies, riskScore")
      .limit(10000);

    const providers = (data || []).filter((p) => matchesCategory(p, category));

    // Aggregate by state
    const byState: Record<string, { totalProviders: number; highRisk: number; totalFlagged: number }> = {};
    for (const p of providers) {
      if (!byState[p.state]) {
        byState[p.state] = { totalProviders: 0, highRisk: 0, totalFlagged: 0 };
      }
      byState[p.state].totalProviders++;
      if (p.riskScore >= 60) {
        byState[p.state].highRisk++;
      }
    }

    const results = Object.entries(byState).map(([state, stats]) => ({
      state,
      ...stats,
    }));

    return NextResponse.json(results);
  }

  // Default: efficient count queries per state
  const results = await Promise.all(
    ALL_STATES.map(async (state) => {
      const [totalRes, highRes] = await Promise.all([
        supabase
          .from("Provider")
          .select("id", { count: "exact", head: true })
          .eq("state", state),
        supabase
          .from("Provider")
          .select("id", { count: "exact", head: true })
          .eq("state", state)
          .gte("riskScore", 60),
      ]);

      return {
        state,
        totalProviders: totalRes.count || 0,
        highRisk: highRes.count || 0,
        totalFlagged: 0,
      };
    })
  );

  const active = results.filter((r) => r.totalProviders > 0);

  return NextResponse.json(active);
}
