import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const body = await req.json();
  const { name, email, title, description, source_url } = body;

  if (!title || !description) {
    return NextResponse.json(
      { error: "Title and description are required" },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("ImprovementIdea").insert({
    name: name || null,
    email: email || null,
    title,
    description,
    source_url: source_url || null,
    status: "pending",
  });

  if (error) {
    console.error("ImprovementIdea insert error:", error);
    return NextResponse.json({ error: "Failed to submit" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
