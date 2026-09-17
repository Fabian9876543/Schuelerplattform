import { z } from "zod";

import { fail, fromZodError, ok, withUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { LIMITS } from "@/lib/limits";

const schema = z.object({
  tutorOfferId: z.string().min(1),
  topic: z.string().trim().min(1, "Bitte gib an, worum es geht.").max(LIMITS.topicLength, "Das Thema ist zu lang."),
  message: z
    .string()
    .trim()
    .min(10, "Schreib kurz, wobei du Hilfe brauchst.")
    .max(LIMITS.messageLength, "Die Nachricht ist zu lang."),
  deficitId: z.string().nullable().optional(),
});

export async function GET() {
  return withUser(async (user) => {
    const [incoming, outgoing] = await Promise.all([
      prisma.tutoringRequest.findMany({
        where: { tutorOffer: { userId: user.id } },
        include: { requester: { select: { name: true, gradeLevel: true } }, tutorOffer: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.tutoringRequest.findMany({
        where: { requesterId: user.id },
        include: { tutorOffer: { include: { user: { select: { name: true } } } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return ok({ incoming, outgoing });
  });
}

export async function POST(request: Request) {
  return withUser(async (user) => {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fromZodError(parsed.error);

    const offer = await prisma.tutorOffer.findUnique({
      where: { id: parsed.data.tutorOfferId },
      include: { user: { select: { id: true, name: true, schoolId: true } } },
    });

    if (!offer || !offer.active) return fail("Dieses Angebot gibt es nicht mehr.", 404);
    if (offer.userId === user.id) return fail("Das ist dein eigenes Angebot.");

    // Der eigentliche Riegel. Dass die Trefferliste nur die eigene Schule
    // zeigt, hindert niemanden daran, eine fremde Angebots-ID direkt an die
    // API zu schicken - deshalb wird hier noch einmal geprueft. Die Meldung
    // verraet dabei nicht, dass es das Angebot woanders gibt.
    if (offer.user.schoolId !== user.schoolId) {
      return fail("Dieses Angebot gibt es nicht mehr.", 404);
    }

    // Eine offene Anfrage pro Angebot und Thema reicht.
    const duplicate = await prisma.tutoringRequest.findFirst({
      where: {
        requesterId: user.id,
        tutorOfferId: offer.id,
        topic: parsed.data.topic,
        status: "open",
      },
    });
    if (duplicate) {
      return fail(`Du hast ${offer.user.name} dazu schon angefragt. Warte die Antwort ab.`, 409);
    }

    // Ein Defizit darf nur verknuepft werden, wenn es zur eigenen Auswertung gehoert.
    let deficitId: string | null = null;
    if (parsed.data.deficitId) {
      const deficit = await prisma.deficit.findUnique({
        where: { id: parsed.data.deficitId },
        include: { evaluation: { include: { assessment: { include: { learningGoal: true } } } } },
      });
      if (deficit && deficit.evaluation.assessment.learningGoal.userId === user.id) {
        deficitId = deficit.id;
      }
    }

    const created = await prisma.tutoringRequest.create({
      data: {
        requesterId: user.id,
        tutorOfferId: offer.id,
        deficitId,
        topic: parsed.data.topic,
        message: parsed.data.message,
      },
    });

    return ok({ id: created.id }, 201);
  });
}
