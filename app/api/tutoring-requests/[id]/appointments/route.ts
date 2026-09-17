import { z } from "zod";

import { fail, fromZodError, ok, withUser } from "@/lib/api";
import {
  canPropose,
  DURATION_MAX,
  DURATION_MIN,
  formatAppointment,
  isPast,
  parseLocalDateTime,
} from "@/lib/appointments";
import { conflictingAppointment } from "@/lib/appointments-db";
import { prisma } from "@/lib/db";
import { LIMITS } from "@/lib/limits";
import { loadThread } from "@/lib/messages-db";

const schema = z.object({
  /** Wanduhrzeit aus einem datetime-local-Feld, z. B. "2026-09-23T15:00" */
  startsAt: z.string().min(1, "Bitte gib an, wann ihr euch trefft."),
  durationMinutes: z
    .number()
    .int("Die Dauer muss eine ganze Zahl von Minuten sein.")
    .min(DURATION_MIN, `Weniger als ${DURATION_MIN} Minuten sind keine Lerneinheit.`)
    .max(DURATION_MAX, `Mehr als ${DURATION_MAX} Minuten am Stueck sind zu viel.`),
  place: z.string().trim().max(LIMITS.topicLength, "Der Ort ist zu lang.").nullable().optional(),
});

/** Einen Termin vorschlagen. Zusagen muss die andere Seite. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return withUser(async (user) => {
    const { id } = await context.params;

    const thread = await loadThread(id, user.id);
    if (!thread) return fail("Diese Anfrage gibt es nicht.", 404);
    if (!canPropose(thread.request.status)) {
      return fail("Termine koennt ihr erst ausmachen, wenn die Anfrage angenommen ist.", 403);
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fromZodError(parsed.error);

    const startsAt = parseLocalDateTime(parsed.data.startsAt);
    if (!startsAt) return fail("Dieses Datum konnte ich nicht lesen.");
    if (isPast(startsAt)) return fail("Dieser Termin liegt in der Vergangenheit.");

    const neuer = { startsAt, durationMinutes: parsed.data.durationMinutes };

    // Nur gegen die eigenen zugesagten Termine pruefen. Wuerde hier auch der
    // Kalender der anderen Person geprueft, verriete eine Absage, dass sie zu
    // der Zeit schon etwas vorhat - und mit wem, waere schnell erraten. Ob es
    // ihr passt, sagt sie selbst: dafuer gibt es die Zusage.
    const kollision = await conflictingAppointment(user.id, neuer);
    if (kollision) {
      return fail(
        `Da hast du schon einen Termin: ${formatAppointment(kollision)}.`,
        409,
      );
    }

    const created = await prisma.appointment.create({
      data: {
        requestId: id,
        proposedById: user.id,
        startsAt,
        durationMinutes: parsed.data.durationMinutes,
        place: parsed.data.place?.trim() ? parsed.data.place.trim() : null,
      },
    });

    return ok({ id: created.id, startsAt: created.startsAt, status: created.status }, 201);
  });
}
