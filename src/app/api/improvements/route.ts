import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("ImprovementIdea")
    .select("*")
    .order("createdAt", { ascending: false });

  if (error) {
    console.error("ImprovementIdea fetch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
