import path from "node:path";
import { defineConfig } from "prisma/config";

// Ab Prisma 7 liegt die Verbindungs-URL nicht mehr im Schema, sondern hier.
// Prisma laedt .env nicht mehr von selbst; Node 22 bringt das mit.
try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // Keine .env vorhanden - dann muss DATABASE_URL aus der Umgebung kommen.
}

/**
 * Migrationen laufen ueber die **ungepoolte** Verbindung, wenn es eine gibt.
 *
 * Gehostete Anbieter wie Neon liefern zwei Zeichenfolgen: DATABASE_URL fuehrt
 * ueber einen Verbindungspooler (PgBouncer im Transaktionsmodus),
 * DATABASE_URL_UNPOOLED direkt auf die Datenbank. Fuer die laufende App ist
 * der Pooler richtig - viele kurze Anfragen, wenige Verbindungen. Migrationen
 * dagegen brauchen eine durchgehende Sitzung und scheitern am Pooler.
 *
 * Lokal gibt es DATABASE_URL_UNPOOLED nicht; dann bleibt alles wie bisher.
 */
const migrationUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!migrationUrl) {
  throw new Error(
    "DATABASE_URL fehlt. Trag die Verbindung zu deiner Postgres-Datenbank in die .env ein.",
  );
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: migrationUrl,
  },
});
