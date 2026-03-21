import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const revalidate = 300;

const ALL_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"
];

export async function GET() {
  // Aggregate per state using count queries — avoids row-limit on raw selects
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
        totalFlagged: 0, // dollar sum skipped for perf — use count only for map
      };
    })
  );

  // Filter out states with no data
  const active = results.filter((r) => r.totalProviders > 0);

  return NextResponse.json(active);
}
