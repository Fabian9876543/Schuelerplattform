import { DURATION_MAX, endOf, overlaps, type TerminZeit } from "@/lib/appointments";
import { prisma } from "@/lib/db";

/**
 * Die Datenbankseite der Termine.
 *
 * Jede Abfrage filtert selbst auf die beteiligte Person - einen Termin ohne
 * diese Bedingung gibt es hier nicht zu holen.
 */

/** Bedingung: Termine, an denen diese Person beteiligt ist. */
function beteiligt(userId: string) {
  return {
    request: {
      OR: [{ requesterId: userId }, { tutorOffer: { userId } }],
    },
  };
}

/**
 * Ein bereits zugesagter Termin dieser Person, der sich mit dem neuen
 * ueberschneidet - oder null.
 *
 * Geprueft wird nur gegen **zugesagte** Termine: Ein blosser Vorschlag ist
 * noch keine Verabredung und soll andere Vorschlaege nicht blockieren.
 *
 * Die Ueberschneidung rechnet nicht die Datenbank aus, sondern `overlaps` -
 * dieselbe Funktion, die auch getestet ist. Die Abfrage holt dafuer ein
 * Zeitfenster, das jeden in Frage kommenden Termin enthaelt: frueher als die
 * laengstmoegliche Dauer vor dem Start kann keiner beginnen und noch
 * hineinreichen.
 */
export async function conflictingAppointment(
  userId: string,
  neuer: TerminZeit,
  exceptId?: string,
) {
  const kandidaten = await prisma.appointment.findMany({
    where: {
      ...beteiligt(userId),
      status: "confirmed",
      id: exceptId ? { not: exceptId } : undefined,
      startsAt: {
        gte: new Date(neuer.startsAt.getTime() - DURATION_MAX * 60_000),
        lt: endOf(neuer),
      },
    },
    orderBy: { startsAt: "asc" },
  });

  return kandidaten.find((kandidat) => overlaps(kandidat, neuer)) ?? null;
}

/** Termine dieser Person in einem Zeitraum - fuer den Kalender. */
export async function appointmentsInRange(userId: string, von: Date, bis: Date) {
  return prisma.appointment.findMany({
    where: {
      ...beteiligt(userId),
      // Abgesagte Termine stehen nicht im Kalender; im Verlauf bleiben sie.
      status: { in: ["proposed", "confirmed"] },
      startsAt: { gte: von, lte: bis },
    },
    select: {
      id: true,
      requestId: true,
      startsAt: true,
      durationMinutes: true,
      place: true,
      status: true,
      request: {
        select: {
          topic: true,
          requesterId: true,
          requester: { select: { name: true } },
          tutorOffer: { select: { subject: true, user: { select: { id: true, name: true } } } },
        },
      },
    },
    orderBy: { startsAt: "asc" },
  });
}
