import { z } from "zod";

import { fail, fromZodError, ok, withUser } from "@/lib/api";
import {
  MAX_GRADE_LEVEL,
  MIN_GRADE_LEVEL,
  normalizeTopic,
  subjectSchema,
} from "@/lib/constants";
import { prisma } from "@/lib/db";
import { LIMITS } from "@/lib/limits";

const schema = z.object({
  subject: subjectSchema,
  maxGradeLevel: z.coerce.number().int().min(MIN_GRADE_LEVEL).max(MAX_GRADE_LEVEL),
  description: z
    .string()
    .trim()
    .min(10, "Beschreibe kurz, wobei du helfen kannst.")
    .max(LIMITS.descriptionLength, "Die Beschreibung ist zu lang."),
  topics: z.string().trim().min(1, "Bitte gib mindestens ein Thema an."),
  active: z.boolean().optional(),
});

export async function GET() {
  return withUser(async (user) => {
    const offers = await prisma.tutorOffer.findMany({
      where: { userId: user.id },
      include: { topics: true },
      orderBy: { subject: "asc" },
    });
    return ok({ offers });
  });
}

/** Legt ein Nachhilfe-Angebot an. Pro Fach gibt es hoechstens eines. */
export async function POST(request: Request) {
  return withUser(async (user) => {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fromZodError(parsed.error);

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

    if (topics.length === 0) return fail("Bitte gib mindestens ein Thema an.");

    const existing = await prisma.tutorOffer.findFirst({
      where: { userId: user.id, subject: parsed.data.subject },
    });

    const data = {
      subject: parsed.data.subject,
      maxGradeLevel: parsed.data.maxGradeLevel,
      description: parsed.data.description,
      active: parsed.data.active ?? true,
    };

    if (existing) {
      // Themen werden ersetzt, nicht ergaenzt - sonst sammelt sich Altes an.
      const offer = await prisma.tutorOffer.update({
        where: { id: existing.id },
        data: {
          ...data,
          topics: {
            deleteMany: {},
            create: topics.map((name) => ({ name, normalized: normalizeTopic(name) })),
          },
        },
      });
      return ok({ id: offer.id, updated: true });
    }

    const offer = await prisma.tutorOffer.create({
      data: {
        ...data,
        userId: user.id,
        topics: { create: topics.map((name) => ({ name, normalized: normalizeTopic(name) })) },
      },
    });

    return ok({ id: offer.id }, 201);
  });
}
