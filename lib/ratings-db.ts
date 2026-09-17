import { prisma } from "@/lib/db";
import { averageStars } from "@/lib/ratings";

/** Schnitt und Anzahl der Rueckmeldungen zu einem Angebot. */
export interface RatingSummary {
  average: number;
  count: number;
}

/**
 * Bewertungen zu mehreren Angeboten auf einmal - eine Abfrage fuer die ganze
 * Trefferliste statt einer je Zeile. Angebote ohne Rueckmeldung fehlen in der
 * Map; "noch nicht bewertet" und "schlecht bewertet" bleiben dadurch
 * unterscheidbar.
 */
export async function ratingSummaries(offerIds: string[]): Promise<Map<string, RatingSummary>> {
  if (offerIds.length === 0) return new Map();

  const rows = await prisma.rating.groupBy({
    by: ["tutorOfferId"],
    where: { tutorOfferId: { in: offerIds } },
    _avg: { stars: true },
    _count: { _all: true },
  });

  return new Map(
    rows
      .filter((row) => row._avg.stars !== null)
      .map((row) => [
        row.tutorOfferId,
        { average: row._avg.stars as number, count: row._count._all },
      ]),
  );
}

/** Die einzelnen Rueckmeldungen zu den eigenen Angeboten, neueste zuerst. */
export async function ratingsForOwnOffers(userId: string) {
  return prisma.rating.findMany({
    where: { tutorOffer: { userId } },
    include: {
      rater: { select: { name: true } },
      request: { select: { topic: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Schnitt ueber alle eigenen Angebote zusammen - fuer eine einzelne Zahl. */
export function summarize(stars: number[]): RatingSummary | null {
  const schnitt = averageStars(stars);
  return schnitt === null ? null : { average: schnitt, count: stars.length };
}
