import type { NextConfig } from "next";

/**
 * Damit die App im Entwicklungsmodus vom Handy im selben WLAN nutzbar ist.
 *
 * Next.js blockiert sonst Anfragen von anderen Adressen als localhost. Die
 * Seite wird dann zwar ausgeliefert, aber nicht hydriert - Formulare fallen
 * auf natives Browserverhalten zurueck und funktionieren nicht mehr richtig.
 *
 * Abgedeckt sind die ueblichen Heimnetz-Bereiche. Hat dein Router einen
 * anderen (die Adresse steht beim Start hinter "Network:"), setze
 * DEV_ORIGIN in der .env, zum Beispiel DEV_ORIGIN="172.20.10.5".
 */
const devOrigins = process.env.DEV_ORIGIN
  ? [process.env.DEV_ORIGIN]
  : ["192.168.*.*", "10.*.*.*", "172.16.*.*"];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  allowedDevOrigins: devOrigins,
};

export default nextConfig;
