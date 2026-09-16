import { z } from "zod";

import * as PrismaEnums from "@/lib/generated/prisma/enums";

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

/**
 * Status- und Typwerte kommen aus dem Prisma-Schema, nicht aus einer zweiten
 * Liste hier: Es gibt genau eine Quelle, und die Datenbank setzt sie selbst
 * durch. Die Zod-Schemas leiten sich davon ab, damit eine API-Eingabe nie
 * etwas durchlaesst, das die Datenbank anschliessend ablehnen wuerde.
 */
export {
  AssessmentStatus,
  EvaluationSource,
  QuestionKind,
  RequestStatus,
} from "@/lib/generated/prisma/enums";

export const assessmentStatusSchema = z.enum(PrismaEnums.AssessmentStatus);
export const questionKindSchema = z.enum(PrismaEnums.QuestionKind);
export const requestStatusSchema = z.enum(PrismaEnums.RequestStatus);
export const evaluationSourceSchema = z.enum(PrismaEnums.EvaluationSource);

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
