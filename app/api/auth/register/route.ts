import { z } from "zod";

import { fail, fromZodError, ok } from "@/lib/api";
import { createSession, hashPassword } from "@/lib/auth";
import { MAX_GRADE_LEVEL, MIN_GRADE_LEVEL } from "@/lib/constants";
import { prisma } from "@/lib/db";

const schema = z.object({
  name: z.string().trim().min(2, "Bitte gib deinen Namen an."),
  email: z.string().trim().toLowerCase().email("Bitte gib eine gueltige E-Mail-Adresse an."),
  password: z.string().min(8, "Das Passwort braucht mindestens 8 Zeichen."),
  gradeLevel: z.coerce
    .number()
    .int()
    .min(MIN_GRADE_LEVEL, `Klassenstufe ab ${MIN_GRADE_LEVEL}.`)
    .max(MAX_GRADE_LEVEL, `Klassenstufe bis ${MAX_GRADE_LEVEL}.`),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return fromZodError(parsed.error);

  const { name, email, password, gradeLevel } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return fail("Mit dieser E-Mail-Adresse gibt es schon ein Konto.", 409);

  const user = await prisma.user.create({
    data: { name, email, gradeLevel, passwordHash: await hashPassword(password) },
  });

  await createSession(user.id);
  return ok({ id: user.id });
}
