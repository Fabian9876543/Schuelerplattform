import { z } from "zod";

import { fail, fromZodError, ok } from "@/lib/api";
import { createSession, hashPassword } from "@/lib/auth";
import { MAX_GRADE_LEVEL, MIN_GRADE_LEVEL } from "@/lib/constants";
import { prisma } from "@/lib/db";

const schema = z.object({
  name: z.string().trim().min(2, "Bitte gib deinen Namen an."),
  email: z.string().trim().toLowerCase().email("Bitte gib eine gueltige E-Mail-Adresse an."),
  password: z.string().min(8, "Das Passwort braucht mindestens 8 Zeichen."),
  joinCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "Bitte gib den Beitrittscode deiner Schule ein."),
  gradeLevel: z.coerce
    .number()
    .int()
    .min(MIN_GRADE_LEVEL, `Klassenstufe ab ${MIN_GRADE_LEVEL}.`)
    .max(MAX_GRADE_LEVEL, `Klassenstufe bis ${MAX_GRADE_LEVEL}.`),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return fromZodError(parsed.error);

  const { name, email, password, gradeLevel, joinCode } = parsed.data;

  // Zuerst die Schule: Ohne gueltigen Code entsteht kein Konto.
  const school = await prisma.school.findUnique({ where: { joinCode } });
  if (!school) {
    return fail("Diesen Beitrittscode kennen wir nicht. Frag in deiner Schule nach.", 404);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return fail("Mit dieser E-Mail-Adresse gibt es schon ein Konto.", 409);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      gradeLevel,
      schoolId: school.id,
      passwordHash: await hashPassword(password),
    },
  });

  await createSession(user.id);
  return ok({ id: user.id });
}
