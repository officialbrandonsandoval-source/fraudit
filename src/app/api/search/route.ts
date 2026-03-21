import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() || "";

  if (!q) {
    return NextResponse.json([]);
  }

  const providers = await prisma.provider.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { address: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
        { zip: { contains: q } },
        { state: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { riskScore: "desc" },
    take: 50,
  });

  return NextResponse.json(providers);
}
