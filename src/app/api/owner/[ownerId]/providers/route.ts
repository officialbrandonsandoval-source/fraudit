import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ownerId: string }> }
) {
  const { ownerId } = await params;

  const { data, error } = await supabase
    .from("Provider")
    .select("id, name, city, state, riskScore, totalPaid")
    .eq("ownerId", ownerId)
    .order("riskScore", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
