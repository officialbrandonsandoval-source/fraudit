import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // First get the provider to know address/zip
  const { data: provider, error } = await supabase
    .from("Provider")
    .select("address, zip")
    .eq("id", id)
    .single();

  if (error || !provider) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  // Find related providers by same address or same zip with riskScore >= 40
  const { data: related } = await supabase
    .from("Provider")
    .select("id, name, city, state, riskScore")
    .or(`address.eq.${provider.address},zip.eq.${provider.zip}`)
    .neq("id", id)
    .gte("riskScore", 40)
    .order("riskScore", { ascending: false })
    .limit(5);

  return NextResponse.json(related ?? []);
}
