import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { email, providerId } = await req.json();

    if (!email || !providerId) {
      return NextResponse.json({ error: "email and providerId required" }, { status: 400 });
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const { error } = await supabase.from("ProviderAlert").upsert(
      { email, providerId, active: true },
      { onConflict: "email,providerId" }
    );

    if (error) {
      console.error("Alert subscribe error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { email, providerId } = await req.json();

    if (!email || !providerId) {
      return NextResponse.json({ error: "email and providerId required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("ProviderAlert")
      .update({ active: false })
      .eq("email", email)
      .eq("providerId", providerId);

    if (error) {
      console.error("Alert unsubscribe error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
