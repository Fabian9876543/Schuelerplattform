import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getCurrentUser, type SessionUser } from "@/lib/auth";

/** Einheitliche Fehlerantwort - das Frontend liest immer `error`. */
export function fail(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/**
 * Zods eigene Meldungen sind englisch und nennen den technischen Typ. Sie
 * duerfen nie in der Oberflaeche landen - eigene Meldungen dagegen schon.
 */
const ZOD_STANDARD = /^(Invalid input|Invalid option|Invalid key|Invalid value|Too small|Too big|Unrecognized key|Expected)/;

function istZodStandardmeldung(message: string): boolean {
  return ZOD_STANDARD.test(message);
}

/**
 * Wandelt Zod-Fehler in eine lesbare deutsche Meldung.
 *
 * Ohne den technischen Feldpfad: "answers.0.answerText: Deine Antwort ist zu
 * lang" sagt einer Schuelerin nichts. Die Meldungen sind so formuliert, dass
 * sie fuer sich stehen; der Pfad landet stattdessen im Server-Log.
 */
export function fromZodError(error: ZodError): NextResponse {
  const first = error.issues[0];
  if (first?.path.length) {
    console.warn("[api] ungueltige Eingabe bei", first.path.join("."), "-", first.message);
  }
  if (!first) return fail("Ungueltige Eingabe.");

  // Eigene Meldungen gehen unveraendert hinaus - sie sind fuer den Fall
  // geschrieben, der hier gerade eingetreten ist.
  if (!istZodStandardmeldung(first.message)) return fail(first.message);

  // Bleibt die Standardmeldung, ist sie englisch und technisch ("expected
  // number, received undefined"). Die wird hier uebersetzt. Erkennbar ist der
  // fehlende Wert nur an ihr: Zod 4 fuellt `issue.input` nicht, ein Vergleich
  // darauf wuerde jeden Typfehler als fehlende Angabe ausgeben.
  const feld = first.path.at(-1);
  const benennung = typeof feld === "string" ? `: ${feld}` : "";

  if (first.message.endsWith("received undefined")) {
    return fail(`Es fehlt eine Angabe${benennung}.`);
  }
  return fail(`Diese Angabe passt nicht${benennung}.`);
}

/**
 * Kapselt Anmeldepruefung und Fehlerbehandlung fuer Route Handler.
 * Unerwartete Fehler werden geloggt, nach aussen geht eine neutrale Meldung.
 */
export async function withUser(
  handler: (user: SessionUser) => Promise<NextResponse>,
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return fail("Bitte melde dich an.", 401);

  try {
    return await handler(user);
  } catch (error) {
    if (error instanceof ZodError) return fromZodError(error);
    console.error("[api]", error);
    return fail("Da ist etwas schiefgegangen. Bitte versuche es noch einmal.", 500);
  }
}
