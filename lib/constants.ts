import { z } from "zod";

/**
 * Einzige Wahrheitsquelle fuer alle Aufzaehlungswerte.
 *
 * SQLite kennt bei Prisma keine enum-Typen, deshalb liegen diese Werte in der
 * Datenbank als String vor und werden hier per Zod validiert.
 */

export const SUBJECTS = [
  "Mathematik",
  "Deutsch",
  "Englisch",
  "Franzoesisch",
  "Latein",
  "Physik",
  "Chemie",
  "Biologie",
  "Informatik",
  "Geschichte",
  "Geographie",
  "Politik/Wirtschaft",
  "Religion/Ethik",
  "Kunst",
  "Musik",
] as const;

export type Subject = (typeof SUBJECTS)[number];
export const subjectSchema = z.enum(SUBJECTS);

export const ASSESSMENT_STATUS = ["draft", "submitted", "evaluated"] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUS)[number];
export const assessmentStatusSchema = z.enum(ASSESSMENT_STATUS);

export const QUESTION_KINDS = ["multiple_choice", "free_text"] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];
export const questionKindSchema = z.enum(QUESTION_KINDS);

export const REQUEST_STATUS = ["open", "accepted", "declined", "withdrawn"] as const;
export type RequestStatus = (typeof REQUEST_STATUS)[number];
export const requestStatusSchema = z.enum(REQUEST_STATUS);

export const EVALUATION_SOURCES = ["ai", "rule"] as const;
export type EvaluationSource = (typeof EVALUATION_SOURCES)[number];

/** Schweregrad eines Defizits */
export const SEVERITY_LABELS: Record<number, string> = {
  1: "leichte Luecke",
  2: "deutliche Luecke",
  3: "gravierende Luecke",
};

/** Selbsteinschaetzung von 1 (unsicher) bis 5 (sicher) */
export const CONFIDENCE_LABELS: Record<number, string> = {
  1: "Gar nicht sicher",
  2: "Eher unsicher",
  3: "Mittel",
  4: "Recht sicher",
  5: "Sehr sicher",
};

export const MIN_GRADE_LEVEL = 5;
export const MAX_GRADE_LEVEL = 13;

/**
 * Bringt ein Thema auf eine vergleichbare Form, damit "Kurvendiskussion",
 * "kurven-diskussion" und "Kurvendiskussion " zusammenfinden. Umlaute werden
 * ausgeschrieben, weil Schueler sie mal so und mal so tippen.
 */
export function normalizeTopic(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
