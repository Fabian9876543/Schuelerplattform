import { z } from "zod";

import { fail, fromZodError, ok, withUser } from "@/lib/api";
import { normalizeTopic, subjectSchema } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { LIMITS } from "@/lib/limits";
import { goalsOfUser } from "@/lib/limits-db";
import { atNoon } from "@/lib/planning";
import { studentOrDeny } from "@/lib/school-api";

const schema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Bitte gib der Klausur einen Titel.")
    .max(LIMITS.titleLength, "Der Titel ist zu lang."),
  subject: subjectSchema,
  examDate: z.string().min(1, "Bitte gib das Datum der Klausur an."),
  topics: z
    .string()
    .trim()
    .min(1, "Bitte trage mindestens ein Thema ein."),
});

export async function POST(request: Request) {
  return withUser(async (user) => {
    const { deny } = studentOrDeny(user);
    if (deny) return deny;

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fromZodError(parsed.error);

    // Deckelt die Zahl der Lernvorhaben - und damit indirekt die Zahl der
    // kostenpflichtigen Selbsttests, die sich daraus starten lassen.
    if ((await goalsOfUser(user.id)) >= LIMITS.goalsPerUser) {
      return fail(
        `Du hast schon ${LIMITS.goalsPerUser} Klausuren eingetragen. Loesche eine alte, bevor du eine neue anlegst.`,
        429,
      );
    }

    const examDate = atNoon(new Date(parsed.data.examDate));
    if (Number.isNaN(examDate.getTime())) return fail("Das Datum konnte nicht gelesen werden.");

    // Ein Thema pro Zeile; Leerzeilen und Doppelungen werden still entfernt.
    const seen = new Set<string>();
    const topics = parsed.data.topics
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((name) => {
        const key = normalizeTopic(name);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    if (topics.length === 0) return fail("Bitte trage mindestens ein Thema ein.");
    if (topics.length > 12) return fail("Mehr als 12 Themen werden schnell unuebersichtlich.");
    if (topics.some((name) => name.length > LIMITS.topicLength)) {
      return fail(`Ein Thema darf hoechstens ${LIMITS.topicLength} Zeichen lang sein.`);
    }

    const goal = await prisma.learningGoal.create({
      data: {
        userId: user.id,
        title: parsed.data.title,
        subject: parsed.data.subject,
        examDate,
        topics: {
          create: topics.map((name, position) => ({
            name,
            normalized: normalizeTopic(name),
            position,
          })),
        },
      },
    });

    return ok({ id: goal.id }, 201);
  });
}

export async function GET() {
  return withUser(async (user) => {
    const goals = await prisma.learningGoal.findMany({
      where: { userId: user.id },
      orderBy: { examDate: "asc" },
      include: { topics: true },
    });
    return ok({ goals });
  });
}
