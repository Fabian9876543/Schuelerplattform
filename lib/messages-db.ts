import { prisma } from "@/lib/db";
import { participantRole, type ThreadRole } from "@/lib/messages";

/**
 * Die Datenbankseite des Nachrichtenverlaufs.
 *
 * Jede Funktion hier nimmt die Nutzer-ID entgegen und filtert selbst danach.
 * Es gibt bewusst keine Funktion, die einen Verlauf ohne diese Pruefung
 * herausgibt - so kann sie an keiner Aufrufstelle vergessen werden.
 */

/**
 * Laedt einen Verlauf, aber nur fuer die beiden Beteiligten.
 *
 * `null` sowohl bei "gibt es nicht" als auch bei "gehoert dir nicht": Der
 * Aufrufer antwortet darauf mit 404 und verraet damit nicht, dass es die
 * Anfrage gibt.
 */
export async function loadThread(requestId: string, userId: string) {
  const request = await prisma.tutoringRequest.findUnique({
    where: { id: requestId },
    include: {
      requester: { select: { id: true, name: true, gradeLevel: true } },
      tutorOffer: {
        select: { subject: true, user: { select: { id: true, name: true, gradeLevel: true } } },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { sender: { select: { id: true, name: true } } },
      },
    },
  });
  if (!request) return null;

  const role = participantRole(
    { requesterId: request.requesterId, tutorUserId: request.tutorOffer.user.id },
    userId,
  );
  if (!role) return null;

  return { request, role };
}

export type Thread = NonNullable<Awaited<ReturnType<typeof loadThread>>>;

/** Wer im Verlauf gegenuebersitzt. */
export function counterpart(thread: Thread) {
  return thread.role === "requester" ? thread.request.tutorOffer.user : thread.request.requester;
}

/**
 * Setzt alles als gelesen, was in diesem Verlauf von der Gegenseite kam.
 * Eigene Nachrichten bleiben unangetastet - gelesen heisst: von der
 * Gegenseite gelesen.
 */
export async function markThreadRead(requestId: string, userId: string): Promise<void> {
  await prisma.message.updateMany({
    where: { requestId, senderId: { not: userId }, readAt: null },
    data: { readAt: new Date() },
  });
}

/** Bedingung fuer "an mich und noch nicht gelesen". */
function unreadFor(userId: string) {
  return {
    readAt: null,
    senderId: { not: userId },
    request: {
      OR: [{ requesterId: userId }, { tutorOffer: { userId } }],
    },
  };
}

/** Zahl fuer die Navigation: alle ungelesenen Nachrichten dieses Nutzers. */
export async function unreadTotal(userId: string): Promise<number> {
  return prisma.message.count({ where: unreadFor(userId) });
}

/**
 * Ungelesene je Anfrage - eine Abfrage fuer die ganze Liste, statt einer
 * Abfrage je Zeile.
 */
export async function unreadByRequest(userId: string): Promise<Map<string, number>> {
  const rows = await prisma.message.groupBy({
    by: ["requestId"],
    where: unreadFor(userId),
    _count: { _all: true },
  });
  return new Map(rows.map((row) => [row.requestId, row._count._all]));
}

export type { ThreadRole };
