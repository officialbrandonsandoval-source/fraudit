import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

function createClient() {
  // Use transaction pooler URL for serverless (port 6543)
  const url = process.env.DATABASE_URL_POOLER || process.env.DATABASE_URL!;
  const adapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({ adapter });
}

const prisma = global.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") global.prisma = prisma;

export { prisma };
