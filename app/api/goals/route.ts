import { z } from "zod";

import { fail, fromZodError, ok, withUser } from "@/lib/api";
import { normalizeTopic, subjectSchema } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { atNoon } from "@/lib/planning";

const schema = z.object({
  title: z.string().trim().min(3, "Bitte gib der Klausur einen Titel."),
  subject: subjectSchema,
  examDate: z.string().min(1, "Bitte gib das Datum der Klausur an."),
  topics: z
    .string()
    .trim()
    .min(1, "Bitte trage mindestens ein Thema ein."),
});

export async function POST(request: Request) {
  return withUser(async (user) => {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fromZodError(parsed.error);

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
