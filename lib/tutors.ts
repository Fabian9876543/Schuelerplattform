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
  /// Verlangt die Schule eine Freigabe? Dann zaehlen nur freigegebene Angebote.
  requiresApproval: boolean;
}): Promise<MatchResult[]> {
  const offers = await prisma.tutorOffer.findMany({
    where: {
      subject: options.subject,
      active: true,
      NOT: { userId: options.excludeUserId },
      // Lehrkraefte koennen keine Angebote anlegen; der Filter haelt die
      // Trefferliste auch dann sauber, wenn doch einmal eines entstuende.
      // Gesperrte Konten verschwinden aus der Suche, ohne dass jemand ihre
      // Angebote einzeln abschalten muss.
      user: { schoolId: options.schoolId, kind: "student", blockedAt: null },
      // Die Freigabe wirkt nur, solange die Schule sie verlangt. Schaltet sie
      // die Pflicht ab, sind alle Angebote wieder da - ohne dass jemand
      // hunderte Haken setzen muss.
      ...(options.requiresApproval ? { approved: true } : {}),
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
