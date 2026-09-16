import { z } from "zod";

/**
 * Antwortmoeglichkeiten liegen in SQLite als JSON-String. Gelesen wird nur
 * ueber diesen Parser - so kann eine beschaedigte oder alte Zeile die Seite
 * nicht zum Absturz bringen.
 */
const optionsSchema = z.array(z.string());

export function serializeOptions(options: string[] | null): string | null {
  return options && options.length > 0 ? JSON.stringify(options) : null;
}

export function parseOptions(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed = optionsSchema.safeParse(JSON.parse(raw));
    return parsed.success && parsed.data.length > 0 ? parsed.data : null;
  } catch {
    return null;
  }
}
