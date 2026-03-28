import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { randomUUID } from "crypto";

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

    // Check if already subscribed — no unique constraint in DB so check manually
    const { data: existing } = await supabase
      .from("ProviderAlert")
      .select("id, active")
      .eq("email", email)
      .eq("providerId", providerId)
      .maybeSingle();

    if (existing) {
      // Re-activate if previously unsubscribed
      if (!existing.active) {
        await supabase
          .from("ProviderAlert")
          .update({ active: true })
          .eq("id", existing.id);
      }
      return NextResponse.json({ ok: true });
    }

    const { error } = await supabase
      .from("ProviderAlert")
      .insert({ id: randomUUID(), email, providerId, active: true });

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
