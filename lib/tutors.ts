import { prisma } from "@/lib/db";
import { findMatches, type MatchResult, type TutorCandidate } from "@/lib/matching";
import { ratingSummaries } from "@/lib/ratings-db";

/**
 * Laedt passende Angebote aus der Datenbank und bewertet sie.
 * Wird sowohl von der Suchseite als auch von der API benutzt, damit beide
 * garantiert dasselbe Ergebnis liefern.
 */
export async function searchTutors(options: {
  subject: string;
  topic?: string;
  gradeLevel: number;
  excludeUserId: string;
  /// Nur Angebote aus dieser Schule - die Plattform endet an der Schulgrenze.
  schoolId: string;
}): Promise<MatchResult[]> {
  const offers = await prisma.tutorOffer.findMany({
    where: {
      subject: options.subject,
      active: true,
      NOT: { userId: options.excludeUserId },
      user: { schoolId: options.schoolId },
    },
    include: {
      topics: true,
      user: { select: { id: true, name: true } },
      _count: { select: { requests: { where: { status: "accepted" } } } },
    },
  });

  // Eine Abfrage fuer alle Angebote der Trefferliste, nicht eine je Zeile.
  const bewertungen = await ratingSummaries(offers.map((offer) => offer.id));

  const candidates: TutorCandidate[] = offers.map((offer) => ({
    offerId: offer.id,
    userId: offer.user.id,
    userName: offer.user.name,
    subject: offer.subject,
    maxGradeLevel: offer.maxGradeLevel,
    description: offer.description,
    topics: offer.topics.map((topic) => ({ name: topic.name, normalized: topic.normalized })),
    acceptedRequests: offer._count.requests,
    rating: bewertungen.get(offer.id),
  }));

  return findMatches(candidates, {
    subject: options.subject,
    topic: options.topic,
    gradeLevel: options.gradeLevel,
    excludeUserId: options.excludeUserId,
  });
}
