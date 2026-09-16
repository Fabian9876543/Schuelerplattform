import { z } from "zod";

import { fail, fromZodError, ok, withUser } from "@/lib/api";
import { prisma } from "@/lib/db";

const schema = z.object({
  // Nicht der volle RequestStatus: "open" ist der Ausgangszustand und laesst
  // sich nicht setzen.
  status: z.enum(["accepted", "declined", "withdrawn"], {
    error: "Unbekannte Aktion.",
  }),
  responseMessage: z.string().trim().max(1000).nullable().optional(),
});

/**
 * Annehmen und Ablehnen darf nur die angefragte Person,
 * Zurueckziehen nur die anfragende.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return withUser(async (user) => {
    const { id } = await context.params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fromZodError(parsed.error);

    const existing = await prisma.tutoringRequest.findUnique({
      where: { id },
      include: { tutorOffer: true },
    });

    if (!existing) return fail("Anfrage nicht gefunden.", 404);
    if (existing.status !== "open") return fail("Diese Anfrage ist bereits beantwortet.", 409);

    const isTutor = existing.tutorOffer.userId === user.id;
    const isRequester = existing.requesterId === user.id;

    if (parsed.data.status === "withdrawn" && !isRequester) {
      return fail("Nur wer angefragt hat, kann die Anfrage zurueckziehen.", 403);
    }
    if (parsed.data.status !== "withdrawn" && !isTutor) {
      return fail("Nur die angefragte Person kann darauf antworten.", 403);
    }

    await prisma.tutoringRequest.update({
      where: { id },
      data: {
        status: parsed.data.status,
        responseMessage: parsed.data.responseMessage ?? null,
        respondedAt: new Date(),
      },
    });

    return ok({ id, status: parsed.data.status });
  });
}
