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

  try {
    // Single query — fetch all providers at once, aggregate in JS
    // Avoids 51 parallel Supabase calls that cause timeouts
    const { data, error } = await supabase
      .from("Provider")
      .select("state, programs, anomalies, riskScore")
      .limit(50000);

    if (error) {
      console.error("[map-stats] Supabase error:", error.message);
      return NextResponse.json([], { status: 200 });
    }

    const providers = (data || []).filter((p) =>
      category === "all" ? true : matchesCategory(p, category)
    );

    // Aggregate by state
    const byState: Record<string, { totalProviders: number; highRisk: number; totalFlagged: number }> = {};

    for (const p of providers) {
      const st = p.state;
      if (!st || !ALL_STATES.includes(st)) continue;
      if (!byState[st]) {
        byState[st] = { totalProviders: 0, highRisk: 0, totalFlagged: 0 };
      }
      byState[st].totalProviders++;
      if (p.riskScore >= 60) {
        byState[st].highRisk++;
      }
      if (p.riskScore >= 30) {
        byState[st].totalFlagged++;
      }
    }

    const results = Object.entries(byState)
      .filter(([, s]) => s.totalProviders > 0)
      .map(([state, stats]) => ({ state, ...stats }));

    return NextResponse.json(results);
  } catch (err) {
    console.error("[map-stats] Unexpected error:", err);
    return NextResponse.json([], { status: 200 });
  }
}
