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

/** Wandelt Zod-Fehler in eine lesbare deutsche Meldung. */
export function fromZodError(error: ZodError): NextResponse {
  const first = error.issues[0];
  const path = first?.path.join(".");
  return fail(path ? `${path}: ${first.message}` : (first?.message ?? "Ungueltige Eingabe."));
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
