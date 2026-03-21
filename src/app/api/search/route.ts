import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() || "";

  if (!q) return NextResponse.json([]);

  const { data, error } = await supabase
    .from("Provider")
    .select("*")
    .or(`name.ilike.%${q}%,address.ilike.%${q}%,city.ilike.%${q}%,zip.ilike.%${q}%,state.ilike.%${q}%`)
    .order("riskScore", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
