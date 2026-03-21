import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { providerId, content } = body;

  if (!providerId || !content?.trim()) {
    return NextResponse.json(
      { error: "providerId and content are required" },
      { status: 400 }
    );
  }

  const tip = await prisma.tip.create({
    data: {
      providerId,
      content: content.trim(),
    },
  });

  return NextResponse.json(tip, { status: 201 });
}
