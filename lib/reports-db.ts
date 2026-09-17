import type { SessionUser } from "@/lib/auth";
import type { ReportTargetType } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { startOfDay } from "@/lib/limits";
import { loadThread } from "@/lib/messages-db";
import { snapshot } from "@/lib/reports";

/**
 * Die Datenbankseite der Meldungen.
 */

/** Was eine Meldung ueber den gemeldeten Inhalt festhaelt. */
export interface ReportTarget {
  /** wer den Inhalt verfasst hat */
  authorId: string;
  /** Wortlaut zum Zeitpunkt der Meldung */
  snapshot: string;
}

/**
 * Loest den gemeldeten Inhalt auf - und prueft dabei, ob die meldende Person
 * ihn ueberhaupt sehen darf.
 *
 * `null` heisst in jedem Fall "gibt es fuer dich nicht": unbekannte ID,
 * fremde Schule, fremder Verlauf oder der eigene Beitrag. Der Aufrufer
 * antwortet darauf mit 404 und verraet damit nichts.
 *
 * Die Pruefungen sind bewusst dieselben wie beim Lesen: Melden darf nur, wer
 * den Inhalt regulaer zu sehen bekommt. Ueber die Meldefunktion soll niemand
 * an Inhalte kommen, die ihn sonst nichts angehen.
 */
export async function resolveTarget(
  targetType: ReportTargetType,
  targetId: string,
  user: SessionUser,
): Promise<ReportTarget | null> {
  if (targetType === "offer") {
    const offer = await prisma.tutorOffer.findUnique({
      where: { id: targetId },
      include: {
        topics: { select: { name: true } },
        user: { select: { id: true, schoolId: true } },
      },
    });
    if (!offer) return null;
    if (offer.user.schoolId !== user.schoolId) return null;
    // Das eigene Angebot zu melden ergibt keinen Sinn.
    if (offer.user.id === user.id) return null;

    return {
      authorId: offer.user.id,
      snapshot: snapshot(
        `${offer.subject} bis Klasse ${offer.maxGradeLevel}\n` +
          `Themen: ${offer.topics.map((topic) => topic.name).join(", ")}\n\n` +
          offer.description,
      ),
    };
  }

  if (targetType === "message") {
    const message = await prisma.message.findUnique({ where: { id: targetId } });
    if (!message) return null;
    // Dieselbe Pruefung wie beim Lesen des Verlaufs.
    const thread = await loadThread(message.requestId, user.id);
    if (!thread) return null;
    if (message.senderId === user.id) return null;

    return { authorId: message.senderId, snapshot: snapshot(message.body) };
  }

  const rating = await prisma.rating.findUnique({
    where: { id: targetId },
    include: { tutorOffer: { select: { userId: true } } },
  });
  if (!rating) return null;
  // Eine Bewertung meldet, wer sie abbekommen hat.
  if (rating.tutorOffer.userId !== user.id) return null;

  return {
    authorId: rating.raterId,
    snapshot: snapshot(
      `${rating.stars} von 5 Sternen\n\n${rating.comment ?? "(ohne Kommentar)"}`,
    ),
  };
}

/** Meldungen, die dieser Nutzer heute abgesetzt hat - fuer die Tagesgrenze. */
export async function reportsToday(userId: string): Promise<number> {
  return prisma.report.count({
    where: { reporterId: userId, createdAt: { gte: startOfDay() } },
  });
}

/** Offene Meldungen dieser Schule - die Zahl an der Navigation. */
export async function openReportCount(schoolId: string): Promise<number> {
  return prisma.report.count({ where: { schoolId, status: "open" } });
}

/** Alle Meldungen der Schule, offene zuerst. */
export async function reportsForSchool(schoolId: string) {
  return prisma.report.findMany({
    where: { schoolId },
    include: {
      reporter: { select: { id: true, name: true } },
      author: { select: { id: true, name: true, isAdmin: true, blockedAt: true } },
      handledBy: { select: { name: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

/**
 * Wie oft dieser Inhalt insgesamt gemeldet wurde.
 *
 * Bewusst nur als Hinweis fuer die Verwaltung: Ab einer bestimmten Zahl
 * automatisch auszublenden waere die Einladung, dass drei Freunde einen
 * unliebsamen Mitschueler wegmelden. Ein Mensch entscheidet.
 */
export async function reportCounts(
  eintraege: { targetType: ReportTargetType; targetId: string }[],
): Promise<Map<string, number>> {
  if (eintraege.length === 0) return new Map();

  const zeilen = await prisma.report.groupBy({
    by: ["targetType", "targetId"],
    where: { OR: eintraege.map((e) => ({ targetType: e.targetType, targetId: e.targetId })) },
    _count: { _all: true },
  });

  return new Map(zeilen.map((zeile) => [`${zeile.targetType}:${zeile.targetId}`, zeile._count._all]));
}
