import path from "node:path";
import { defineConfig, env } from "prisma/config";

// Ab Prisma 7 liegt die Verbindungs-URL nicht mehr im Schema, sondern hier.
// Prisma laedt .env nicht mehr von selbst; Node 22 bringt das mit.
try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // Keine .env vorhanden - dann muss DATABASE_URL aus der Umgebung kommen.
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
