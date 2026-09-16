import { z } from "zod";

import { fail, fromZodError, ok } from "@/lib/api";
import { createSession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Bitte gib eine gueltige E-Mail-Adresse an."),
  password: z.string().min(1, "Bitte gib dein Passwort ein."),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return fromZodError(parsed.error);

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  // Bewusst dieselbe Meldung fuer "kein Konto" und "falsches Passwort",
  // damit sich ueber die Anmeldung keine E-Mail-Adressen abfragen lassen.
  const invalid = fail("E-Mail-Adresse oder Passwort stimmt nicht.", 401);
  if (!user) return invalid;
  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) return invalid;

  await createSession(user.id);
  return ok({ id: user.id });
}
