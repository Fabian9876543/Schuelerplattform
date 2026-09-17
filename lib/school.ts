import { SUBJECTS, type Subject } from "@/lib/constants";
import type { UserRole } from "@/lib/constants";

/**
 * Die Regeln der Schulverwaltung - ohne Datenbank, damit sie sich ohne
 * laufenden Server testen lassen. Die Abfragen stehen in lib/school-db.ts.
 */

export function isAdmin(role: UserRole): boolean {
  return role === "admin";
}

/**
 * Welche Faecher diese Schule zulaesst.
 *
 * Eine leere Liste heisst "keine Einschraenkung", nicht "nichts erlaubt".
 * Andersherum waere jede Schule stillgelegt, bis jemand eine Liste pflegt -
 * und niemand wuesste, warum ploetzlich kein Angebot mehr anzulegen ist.
 */
export function allowedSubjects(gewaehlt: string[]): readonly Subject[] {
  if (gewaehlt.length === 0) return SUBJECTS;
  return SUBJECTS.filter((fach) => gewaehlt.includes(fach));
}

export function canOfferSubject(subject: string, gewaehlt: string[]): boolean {
  return allowedSubjects(gewaehlt).includes(subject as Subject);
}

/**
 * Taucht das Angebot in der Suche auf?
 *
 * Die Freigabe zaehlt nur, wenn die Schule sie verlangt. Schaltet eine Schule
 * die Pflicht wieder ab, sind alle Angebote sofort wieder zu sehen, ohne dass
 * jemand hunderte Haken setzen muss.
 */
export function offerVisible(
  offer: { active: boolean; approved: boolean },
  requiresApproval: boolean,
): boolean {
  if (!offer.active) return false;
  return requiresApproval ? offer.approved : true;
}

/**
 * Darf diese Person der anderen die Verwaltung entziehen?
 *
 * Sich selbst nicht: Sonst stuende eine Schule ohne Verwaltung da, und den
 * naechsten Verwalter koennte niemand mehr ernennen - ausser jemand geht an
 * die Datenbank.
 */
export function canChangeRole(adminId: string, zielId: string): boolean {
  return adminId !== zielId;
}

/** Aendert eine Bearbeitung die Freigabe? */
export function resetsApproval(requiresApproval: boolean): boolean {
  // Freigegeben wurde das Angebot, das die Schule gesehen hat. Wird es
  // geaendert, ist es nicht mehr dasselbe.
  return requiresApproval;
}
