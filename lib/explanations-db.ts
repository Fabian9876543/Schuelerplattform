import type { ExplanationBody } from "@/lib/ai/types";
import { prisma } from "@/lib/db";
import {
  explanationKey,
  parseExplanationBody,
  serializeExplanationBody,
} from "@/lib/explanations";

/**
 * Die Abfragen hinter den Erklaerungen.
 *
 * Gespeichert werden **nur Erklaerungen der KI**. Die Rueckfallebene entsteht
 * in Sekundenbruchteilen neu und kostet nichts - sie einzulagern hiesse, dass
 * ein spaeter hinterlegter Schluessel nichts mehr aendert, weil zu jedem Thema
 * schon eine Ersatzantwort im Speicher liegt.
 */

export interface StoredExplanation {
  id: string;
  body: ExplanationBody;
  createdAt: Date;
}

/** Liegt zu Fach, Thema und Klassenstufe schon etwas vor? */
export async function findExplanation(
  subject: string,
  topic: string,
  gradeLevel: number,
): Promise<StoredExplanation | null> {
  const schluessel = explanationKey(subject, topic, gradeLevel);
  const eintrag = await prisma.explanation.findUnique({
    where: {
      subject_topicKey_gradeLevel: {
        subject: schluessel.subject,
        topicKey: schluessel.topicKey,
        gradeLevel: schluessel.gradeLevel,
      },
    },
  });
  if (!eintrag) return null;

  const body = parseExplanationBody(eintrag.bodyJson);
  if (!body) {
    // Passt der Eintrag nicht mehr zum Schema, wird er wie nicht vorhanden
    // behandelt - der naechste Aufruf legt ihn neu an.
    console.warn("[erklaerung] Eintrag passt nicht mehr zum Schema:", eintrag.id);
    return null;
  }
  return { id: eintrag.id, body, createdAt: eintrag.createdAt };
}

/**
 * Legt eine Erklaerung ab.
 *
 * `upsert`, nicht `create`: Zwei Schueler koennen im selben Moment dieselbe
 * Frage stellen. Ohne upsert scheiterte der zweite Aufruf an der Eindeutigkeit
 * - obwohl er die Antwort gerade in der Hand haelt.
 */
export async function storeExplanation(
  subject: string,
  topic: string,
  gradeLevel: number,
  body: ExplanationBody,
): Promise<StoredExplanation> {
  const schluessel = explanationKey(subject, topic, gradeLevel);
  const bodyJson = serializeExplanationBody(body);

  const eintrag = await prisma.explanation.upsert({
    where: {
      subject_topicKey_gradeLevel: {
        subject: schluessel.subject,
        topicKey: schluessel.topicKey,
        gradeLevel: schluessel.gradeLevel,
      },
    },
    create: {
      subject: schluessel.subject,
      topicKey: schluessel.topicKey,
      topic: topic.trim(),
      gradeLevel: schluessel.gradeLevel,
      bodyJson,
      source: "ai",
    },
    update: { bodyJson, source: "ai" },
  });

  return { id: eintrag.id, body, createdAt: eintrag.createdAt };
}

/**
 * Haelt fest, dass jemand diese Erklaerung aufgerufen hat.
 *
 * `generated` wird nur gesetzt, nie zurueckgenommen: Wer die KI einmal gefragt
 * hat, hat das Kontingent verbraucht - auch wenn er die Erklaerung spaeter
 * noch zehnmal aufschlaegt.
 */
export async function recordView(
  userId: string,
  explanationId: string,
  generated: boolean,
): Promise<void> {
  await prisma.explanationView.upsert({
    where: { userId_explanationId: { userId, explanationId } },
    create: { userId, explanationId, generated },
    update: generated ? { generated: true } : {},
  });
}

/**
 * "Hat das geholfen?" - die Antwort gehoert zu dem, der sie gibt.
 *
 * Gibt false zurueck, wenn es den Aufruf nicht gibt: Eine Rueckmeldung zu
 * einer Erklaerung, die man nie geoeffnet hat, waere keine.
 */
export async function setHelpful(
  userId: string,
  explanationId: string,
  helpful: boolean,
): Promise<boolean> {
  const { count } = await prisma.explanationView.updateMany({
    where: { userId, explanationId },
    data: { helpful },
  });
  return count > 0;
}
