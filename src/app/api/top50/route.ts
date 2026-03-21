import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const revalidate = 300; // Cache for 5 minutes

export async function GET() {
  const { data, error } = await supabase
    .from("Provider")
    .select("id, name, address, city, state, zip, programs, totalPaid, riskScore, anomalies")
    .order("riskScore", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Top 50 error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
