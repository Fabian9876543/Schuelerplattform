import { z } from "zod";

import { fail, fromZodError, ok, withUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { LIMITS } from "@/lib/limits";
import { denyIfNotAdmin } from "@/lib/school-api";

const schema = z.object({
  // "open" ist der Ausgangszustand und laesst sich nicht setzen.
  status: z.enum(["resolved", "rejected"], { error: "Unbekannte Aktion." }),
  resolution: z
    .string()
    .trim()
    .max(LIMITS.reportNoteLength, "Die Notiz ist zu lang.")
    .nullable()
    .optional(),
});

/** Eine Meldung abschliessen: erledigt oder unbegruendet. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return withUser(async (user) => {
    const verboten = denyIfNotAdmin(user);
    if (verboten) return verboten;

    const { id } = await context.params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fromZodError(parsed.error);

    const report = await prisma.report.findUnique({ where: { id } });
    // Meldungen enden an der Schulgrenze wie alles andere.
    if (!report || report.schoolId !== user.schoolId) {
      return fail("Diese Meldung gibt es nicht.", 404);
    }
    if (report.status !== "open") return fail("Diese Meldung ist schon bearbeitet.", 409);

    await prisma.report.update({
      where: { id },
      data: {
        status: parsed.data.status,
        resolution: parsed.data.resolution?.trim() ? parsed.data.resolution.trim() : null,
        handledById: user.id,
        handledAt: new Date(),
      },
    });

    return ok({ id, status: parsed.data.status });
  });
}
