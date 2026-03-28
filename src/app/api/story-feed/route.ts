import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("StoryFeed")
    .select("*")
    .eq("published", true)
    .order("detectedAt", { ascending: false })
    .limit(5);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch story feed" }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
