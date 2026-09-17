import { explanationSchema, type ExplanationBody } from "@/lib/ai/types";
import { normalizeTopic } from "@/lib/constants";

/**
 * Die Regeln rund um Erklaerungen - ohne Datenbank, damit sie sich ohne
 * laufenden Server testen lassen. Die Abfragen stehen in
 * lib/explanations-db.ts.
 */

export interface ExplanationKey {
  subject: string;
  /** ueber normalizeTopic() vereinheitlicht */
  topicKey: string;
  gradeLevel: number;
}

/**
 * Der Schluessel des Zwischenspeichers.
 *
 * Die Klassenstufe gehoert dazu: "Ableitungen" in Klasse 10 und in Klasse 12
 * sind zwei verschiedene Erklaerungen. Das Fach auch - "Analyse" heisst in
 * Deutsch etwas anderes als in Mathematik.
 */
export function explanationKey(subject: string, topic: string, gradeLevel: number): ExplanationKey {
  return { subject, topicKey: normalizeTopic(topic), gradeLevel };
}

/**
 * Liest eine gespeicherte Erklaerung.
 *
 * Gibt null zurueck, wenn der Eintrag nicht mehr zum Schema passt - etwa weil
 * sich der Aufbau geaendert hat. Dann wird neu erzeugt statt eine halbe
 * Erklaerung anzuzeigen; ein kaputter Eintrag im Zwischenspeicher darf keine
 * Seite mitnehmen.
 */
export function parseExplanationBody(json: string): ExplanationBody | null {
  let roh: unknown;
  try {
    roh = JSON.parse(json);
  } catch {
    return null;
  }
  const geprueft = explanationSchema.safeParse(roh);
  return geprueft.success ? geprueft.data : null;
}

export function serializeExplanationBody(body: ExplanationBody): string {
  return JSON.stringify(body);
}

/**
 * Der Hinweis unter einer regelbasierten Erklaerung.
 *
 * Steht in der Oberflaeche, nicht im Text der Erklaerung selbst - so wie bei
 * der Auswertung. Wer ihn zweimal liest, glaubt beim zweiten Mal weniger.
 */
export const RULE_HINT =
  "Diese Antwort ist die Rueckfallebene: Sie kommt ohne KI aus - deshalb steht hier " +
  "kein Fachtext, sondern der Weg, wie du dir das Thema selbst erarbeitest.";
