import { prisma } from "@/lib/db";
import { normalizeTopic } from "@/lib/constants";
import { matchLinks, type CuratedLink } from "@/lib/links";

/**
 * Die Abfragen hinter den gepruefen Links.
 *
 * Alles an der Schulgrenze: Ein Link, den das Humboldt-Gymnasium gepflegt hat,
 * taucht an der Goethe-Schule nicht auf - und laesst sich von dort auch nicht
 * loeschen.
 */

const auswahl = {
  id: true,
  subject: true,
  topicKey: true,
  topic: true,
  title: true,
  url: true,
  note: true,
} as const;

/** Die Links dieser Schule, die zu Fach und Thema passen. */
export async function linksForTopic(
  schoolId: string,
  subject: string,
  topic: string,
): Promise<CuratedLink[]> {
  // Gefiltert wird auf Schule und Fach, der Themenvergleich passiert danach in
  // lib/links.ts: Teiltreffer ("Kurvendiskussion" in "Kurvendiskussion und
  // Extremwerte") bekommt man mit einer Gleichheitsabfrage nicht.
  const zeilen = await prisma.topicLink.findMany({
    where: { schoolId, subject },
    select: auswahl,
  });
  return matchLinks(zeilen, subject, topic);
}

/** Alle Links der Schule - fuer die Verwaltungsseite. */
export async function linksOfSchool(schoolId: string) {
  return prisma.topicLink.findMany({
    where: { schoolId },
    select: { ...auswahl, createdAt: true, addedBy: { select: { name: true } } },
    orderBy: [{ subject: "asc" }, { topic: "asc" }, { title: "asc" }],
  });
}

export async function addLink(input: {
  schoolId: string;
  subject: string;
  topic: string;
  title: string;
  url: string;
  note: string | null;
  addedById: string;
}) {
  return prisma.topicLink.create({
    data: {
      schoolId: input.schoolId,
      subject: input.subject,
      topic: input.topic.trim(),
      topicKey: normalizeTopic(input.topic),
      title: input.title.trim(),
      url: input.url.trim(),
      note: input.note?.trim() || null,
      addedById: input.addedById,
    },
    select: auswahl,
  });
}

/**
 * Loescht einen Link der eigenen Schule.
 *
 * Die Schul-ID steht in der Bedingung, nicht in einer Pruefung davor: So kann
 * kein Aufruf sie versehentlich auslassen. Gibt false zurueck, wenn es den
 * Link hier nicht gibt - die Antwort ist dieselbe wie bei einem geloeschten,
 * damit sie nicht verraet, dass er anderswo existiert.
 */
export async function removeLink(schoolId: string, id: string): Promise<boolean> {
  const { count } = await prisma.topicLink.deleteMany({ where: { id, schoolId } });
  return count > 0;
}
