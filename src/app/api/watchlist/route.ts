import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, name, filters } = body;

  if (!email || !filters) {
    return NextResponse.json({ error: "Missing email or filters" }, { status: 400 });
  }

  // Check existing watchlist count for free tier gating
  const { count } = await supabase
    .from("Watchlist")
    .select("id", { count: "exact" })
    .eq("email", email)
    .limit(1);

  const { data: proUser } = await supabase
    .from("ProUser")
    .select("id, tier")
    .eq("email", email)
    .eq("active", true)
    .single();

  if ((count ?? 0) >= 1 && !proUser) {
    return NextResponse.json(
      { error: "Free tier limited to 1 watchlist. Upgrade to Pro for unlimited.", upgradeUrl: "/pricing" },
      { status: 403 }
    );
  }

  const { data, error } = await supabase
    .from("Watchlist")
    .insert({ email, name: name || null, filters, active: true, tier: proUser?.tier || "free" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create watchlist" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "Missing email parameter" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("Watchlist")
    .select("*")
    .eq("email", email)
    .order("createdAt", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch watchlists" }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
