import { SUBJECTS, type Subject, type UserKind } from "@/lib/constants";

/**
 * Die Regeln der Schulverwaltung - ohne Datenbank, damit sie sich ohne
 * laufenden Server testen lassen. Die Abfragen stehen in lib/school-db.ts.
 */

export function isAdmin(user: { isAdmin: boolean }): boolean {
  return user.isAdmin;
}

/**
 * Nimmt dieses Konto an der Nachhilfe teil?
 *
 * Lehrkraefte nicht: Die Plattform vermittelt Nachhilfe **unter Mitschuelern**.
 * Eine Lehrkraft, die als Nachhilfegeber in der Trefferliste auftaucht, waere
 * etwas anderes - und eine, die ihre Schueler um Hilfe bittet, erst recht.
 * Ein Lehrerkonto dient der Verwaltung, nicht dem Markt.
 */
export function takesPartInTutoring(kind: UserKind): boolean {
  return kind === "student";
}

/** "Klasse 11" oder "Lehrkraft" - eine Stelle fuer beide Faelle. */
export function describeGrade(user: { kind: UserKind; gradeLevel: number | null }): string {
  return user.kind === "teacher" || user.gradeLevel === null
    ? "Lehrkraft"
    : `Klasse ${user.gradeLevel}`;
}

/**
 * Welche Art Konto entsteht mit diesem Beitrittscode?
 *
 * Jede Schule hat zwei: einen fuer Schueler und einen fuer Lehrkraefte. Der
 * Code entscheidet, nicht ein Haken im Formular - sonst koennte sich jeder
 * mit dem Schuelercode zur Lehrkraft erklaeren.
 */
export function kindForJoinCode(
  school: { joinCode: string; teacherJoinCode: string },
  code: string,
): UserKind | null {
  const eingabe = code.trim().toUpperCase();
  if (eingabe && eingabe === school.joinCode.toUpperCase()) return "student";
  if (eingabe && eingabe === school.teacherJoinCode.toUpperCase()) return "teacher";
  return null;
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
