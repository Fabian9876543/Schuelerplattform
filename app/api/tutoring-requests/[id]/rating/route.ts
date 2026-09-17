import { z } from "zod";

import { fail, fromZodError, ok, withUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { LIMITS } from "@/lib/limits";
import { loadThread } from "@/lib/messages-db";
import { canRate, STAR_MAX, STAR_MIN } from "@/lib/ratings";

const schema = z.object({
  stars: z
    .number()
    .int("Bitte waehle eine ganze Zahl von Sternen.")
    .min(STAR_MIN, "Bitte gib mindestens einen Stern.")
    .max(STAR_MAX, `Mehr als ${STAR_MAX} Sterne gibt es nicht.`),
  comment: z
    .string()
    .trim()
    .max(LIMITS.commentLength, "Der Kommentar ist zu lang.")
    .nullable()
    .optional(),
});

/**
 * Bewertung abgeben oder aendern.
 *
 * PUT statt POST: Es gibt genau eine Bewertung je Anfrage. Wer seine Meinung
 * aendert, ueberschreibt sie - es entsteht keine zweite Stimme fuer dieselbe
 * Nachhilfe.
 */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return withUser(async (user) => {
    const { id } = await context.params;

    // Dieselbe Zugangspruefung wie beim Verlauf: Unbeteiligte erfahren nicht
    // einmal, dass es diese Anfrage gibt.
    const thread = await loadThread(id, user.id);
    if (!thread) return fail("Diese Anfrage gibt es nicht.", 404);

    const istAnfragender = thread.role === "requester";
    if (!canRate(thread.request.status, istAnfragender)) {
      return fail(
        istAnfragender
          ? "Bewerten kannst du erst, wenn deine Anfrage angenommen ist."
          : "Bewerten kann nur, wer die Nachhilfe bekommen hat.",
        403,
      );
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fromZodError(parsed.error);

    const comment = parsed.data.comment?.trim() ? parsed.data.comment.trim() : null;

    const saved = await prisma.rating.upsert({
      where: { requestId: id },
      create: {
        requestId: id,
        tutorOfferId: thread.request.tutorOfferId,
        raterId: user.id,
        stars: parsed.data.stars,
        comment,
      },
      update: { stars: parsed.data.stars, comment },
    });

    return ok({ stars: saved.stars, comment: saved.comment });
  });
}
