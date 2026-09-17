import { z } from "zod";

import { fail, fromZodError, ok, withUser } from "@/lib/api";
import { reportReasonSchema, reportTargetTypeSchema } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { LIMITS } from "@/lib/limits";
import { reportsToday, resolveTarget } from "@/lib/reports-db";

const schema = z.object({
  targetType: reportTargetTypeSchema,
  targetId: z.string().min(1),
  reason: reportReasonSchema,
  note: z
    .string()
    .trim()
    .max(LIMITS.reportNoteLength, "Deine Beschreibung ist zu lang.")
    .nullable()
    .optional(),
});

/** Einen Inhalt melden. */
export async function POST(request: Request) {
  return withUser(async (user) => {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fromZodError(parsed.error);

    // Bremst das Zuschuetten mit Meldungen, ohne eine einzelne zu behindern.
    if ((await reportsToday(user.id)) >= LIMITS.reportsPerDay) {
      return fail(
        `Du hast heute schon ${LIMITS.reportsPerDay} Meldungen abgeschickt. Melde dich morgen wieder, oder sprich jemanden in deiner Schule an.`,
        429,
      );
    }

    const ziel = await resolveTarget(parsed.data.targetType, parsed.data.targetId, user);
    if (!ziel) return fail("Das gibt es nicht.", 404);

    // Eine Meldung je Person und Inhalt. Die Datenbank haelt das ohnehin
    // fest; hier steht die verstaendliche Meldung dazu.
    const schon = await prisma.report.findUnique({
      where: {
        reporterId_targetType_targetId: {
          reporterId: user.id,
          targetType: parsed.data.targetType,
          targetId: parsed.data.targetId,
        },
      },
    });
    if (schon) return fail("Das hast du schon gemeldet. Die Schule schaut es sich an.", 409);

    const created = await prisma.report.create({
      data: {
        schoolId: user.schoolId,
        reporterId: user.id,
        authorId: ziel.authorId,
        targetType: parsed.data.targetType,
        targetId: parsed.data.targetId,
        snapshot: ziel.snapshot,
        reason: parsed.data.reason,
        note: parsed.data.note?.trim() ? parsed.data.note.trim() : null,
      },
    });

    // Bewusst ohne weitere Auskunft: Was aus der Meldung wird, erfaehrt die
    // meldende Person nicht - alles andere verriete etwas ueber die gemeldete.
    return ok({ id: created.id }, 201);
  });
}
