import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("Provider")
    .select("id, name, address, city, state, zip, programs, totalPaid, riskScore, anomalies, licenseDate, ownerId, createdAt, npi, billingHistory")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
