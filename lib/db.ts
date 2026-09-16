import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

// Ab Prisma 7 bekommt der Client seine Verbindung ueber einen Treiber-Adapter.
// Im Entwicklungsmodus laedt Next.js Module neu - ohne das Zwischenspeichern am
// globalThis entstuenden bei jedem Reload neue Verbindungen.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL fehlt. Trag die Verbindung zu deiner Postgres-Datenbank in die .env ein.",
    );
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
