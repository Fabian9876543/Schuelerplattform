import { z } from "zod";

import { fail, fromZodError, ok, withUser } from "@/lib/api";
import { canCancel, canConfirm, formatAppointment } from "@/lib/appointments";
import { conflictingAppointment } from "@/lib/appointments-db";
import { prisma } from "@/lib/db";
import { loadThread } from "@/lib/messages-db";

const schema = z.object({
  // "proposed" ist der Ausgangszustand und laesst sich nicht setzen.
  status: z.enum(["confirmed", "cancelled"], { error: "Unbekannte Aktion." }),
});

/** Einen vorgeschlagenen Termin zusagen oder einen Termin absagen. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return withUser(async (user) => {
    const { id } = await context.params;

    const termin = await prisma.appointment.findUnique({ where: { id } });
    // Fuer Unbeteiligte sieht es aus, als gaebe es den Termin nicht - die
    // Pruefung dafuer ist dieselbe wie beim Nachrichtenverlauf.
    if (!termin) return fail("Diesen Termin gibt es nicht.", 404);
    const thread = await loadThread(termin.requestId, user.id);
    if (!thread) return fail("Diesen Termin gibt es nicht.", 404);

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fromZodError(parsed.error);

    if (parsed.data.status === "confirmed") {
      if (!canConfirm(termin, user.id)) {
        return fail(
          termin.status !== "proposed"
            ? "Ueber diesen Termin ist schon entschieden."
            : "Zusagen muss die andere Seite - deinen eigenen Vorschlag kannst du nicht selbst bestaetigen.",
          403,
        );
      }

      // Zwischen Vorschlag und Zusage kann etwas anderes dazugekommen sein.
      const kollision = await conflictingAppointment(user.id, termin, termin.id);
      if (kollision) {
        return fail(`Da hast du schon einen Termin: ${formatAppointment(kollision)}.`, 409);
      }
    } else if (!canCancel(termin)) {
      return fail("Dieser Termin ist bereits abgesagt.", 409);
    }

    await prisma.appointment.update({
      where: { id },
      data: { status: parsed.data.status, respondedAt: new Date() },
    });

    return ok({ id, status: parsed.data.status });
  });
}
