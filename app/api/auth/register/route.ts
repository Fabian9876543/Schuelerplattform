import { z } from "zod";

import { fail, fromZodError, ok } from "@/lib/api";
import { createSession, hashPassword } from "@/lib/auth";
import { MAX_GRADE_LEVEL, MIN_GRADE_LEVEL } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { kindForJoinCode } from "@/lib/school";

const schema = z.object({
  name: z.string().trim().min(2, "Bitte gib deinen Namen an."),
  email: z.string().trim().toLowerCase().email("Bitte gib eine gueltige E-Mail-Adresse an."),
  password: z.string().min(8, "Das Passwort braucht mindestens 8 Zeichen."),
  joinCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "Bitte gib den Beitrittscode deiner Schule ein."),
  // Nur Schuelerkonten brauchen eine Klassenstufe. Ob dieses Konto eine ist,
  // entscheidet der Beitrittscode - deshalb hier erst einmal optional.
  gradeLevel: z.coerce
    .number()
    .int()
    .min(MIN_GRADE_LEVEL, `Klassenstufe ab ${MIN_GRADE_LEVEL}.`)
    .max(MAX_GRADE_LEVEL, `Klassenstufe bis ${MAX_GRADE_LEVEL}.`)
    .nullish(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return fromZodError(parsed.error);

  const { name, email, password, gradeLevel, joinCode } = parsed.data;

  // Zuerst die Schule: Ohne gueltigen Code entsteht kein Konto. Jede Schule
  // hat zwei - einen fuer Schueler, einen fuer Lehrkraefte.
  const school = await prisma.school.findFirst({
    where: { OR: [{ joinCode }, { teacherJoinCode: joinCode }] },
    select: { id: true, joinCode: true, teacherJoinCode: true },
  });
  const kind = school ? kindForJoinCode(school, joinCode) : null;
  if (!school || !kind) {
    return fail("Diesen Beitrittscode kennen wir nicht. Frag in deiner Schule nach.", 404);
  }

  // Die Klassenstufe haengt an der Kontoart, nicht am Formular: Ein
  // Schuelerkonto ohne Klasse und eine Lehrkraft mit Klasse laesst auch die
  // Datenbank nicht zu.
  if (kind === "student" && (gradeLevel === null || gradeLevel === undefined)) {
    return fail("Bitte gib deine Klassenstufe an.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return fail("Mit dieser E-Mail-Adresse gibt es schon ein Konto.", 409);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      gradeLevel: kind === "student" ? gradeLevel : null,
      kind,
      schoolId: school.id,
      passwordHash: await hashPassword(password),
    },
  });

  await createSession(user.id);
  return ok({ id: user.id });
}
