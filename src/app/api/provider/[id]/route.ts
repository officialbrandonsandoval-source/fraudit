export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const provider = await prisma.provider.findUnique({
    where: { id },
  });

  if (!provider) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(provider);
}
