import { z } from "zod";

import { fail, fromZodError, ok } from "@/lib/api";
import { createSession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  LIMITS,
  clearLoginAttempts,
  minutesUntilUnlocked,
  recentLoginAttempts,
  recordLoginAttempt,
} from "@/lib/limits";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Bitte gib eine gueltige E-Mail-Adresse an."),
  password: z.string().min(1, "Bitte gib dein Passwort ein."),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return fromZodError(parsed.error);

  const { email, password } = parsed.data;

  // Zuerst sperren, dann erst pruefen. Wuerde die Sperre nur bei falschem
  // Passwort greifen, koennte jemand weiter durchprobieren und beim Treffer
  // trotzdem hereinkommen - die Bremse waere wirkungslos.
  const attempts = await recentLoginAttempts(email);
  if (attempts.length >= LIMITS.loginAttempts) {
    const minuten = minutesUntilUnlocked(attempts[0]);
    return fail(
      `Zu viele Fehlversuche. Bitte warte ${minuten} ${minuten === 1 ? "Minute" : "Minuten"} und versuch es dann noch einmal.`,
      429,
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Bewusst dieselbe Meldung fuer "kein Konto" und "falsches Passwort",
  // damit sich ueber die Anmeldung keine E-Mail-Adressen abfragen lassen.
  const invalid = fail("E-Mail-Adresse oder Passwort stimmt nicht.", 401);

  if (!user) {
    await recordLoginAttempt(email);
    return invalid;
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    await recordLoginAttempt(email);
    return invalid;
  }

  await clearLoginAttempts(email);
  await createSession(user.id);
  return ok({ id: user.id });
}
