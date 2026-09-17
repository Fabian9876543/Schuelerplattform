import type { ReportReason, ReportTargetType, UserKind } from "@/lib/constants";

/**
 * Die Regeln rund um Meldungen - ohne Datenbank, damit sie sich ohne
 * laufenden Server testen lassen. Die Abfragen stehen in lib/reports-db.ts.
 */

/** Auswahl im Meldeformular, in dieser Reihenfolge. */
export const REPORT_REASONS: { wert: ReportReason; label: string }[] = [
  { wert: "insult", label: "Beleidigend oder verletzend" },
  { wert: "inappropriate", label: "Unangemessener Inhalt" },
  { wert: "spam", label: "Werbung oder Spam" },
  { wert: "other", label: "Etwas anderes" },
];

export function describeReason(reason: ReportReason): string {
  return REPORT_REASONS.find((eintrag) => eintrag.wert === reason)?.label ?? "Etwas anderes";
}

export function describeTarget(target: ReportTargetType): string {
  if (target === "offer") return "Nachhilfe-Angebot";
  if (target === "message") return "Nachricht";
  return "Bewertung";
}

/**
 * Wer Konten sperren darf.
 *
 * Nur Lehrkraefte mit Verwaltungsrechten. Eine Schuelerin kann die Schule
 * mitverwalten - Angebote freigeben, Faecher pflegen, Meldungen bearbeiten -,
 * aber einer Mitschuelerin den Zugang abzudrehen ist ein Machtmittel unter
 * Gleichaltrigen. Das gehoert in die Hand einer Lehrkraft.
 */
export function canBlockAccounts(user: { kind: UserKind; isAdmin: boolean }): boolean {
  return user.isAdmin && user.kind === "teacher";
}

/**
 * Darf diese Person jenes Konto sperren?
 *
 * Nicht sich selbst, und keine anderen Verwalter: Wer verwaltet, wird nicht
 * gesperrt, sondern erst aus der Verwaltung genommen. Sonst koennten sich
 * zwei Verwalter gegenseitig aussperren.
 */
export function canBlock(
  actor: { id: string; kind: UserKind; isAdmin: boolean },
  target: { id: string; isAdmin: boolean },
): boolean {
  if (!canBlockAccounts(actor)) return false;
  if (actor.id === target.id) return false;
  return !target.isAdmin;
}

export function isBlocked(user: { blockedAt: Date | null }): boolean {
  return user.blockedAt !== null;
}

/**
 * Kuerzt einen gemeldeten Text auf eine handhabbare Laenge.
 *
 * Die Verwaltung soll lesen koennen, worum es geht, ohne dass eine Meldung
 * zum Ablageort fuer beliebig lange Texte wird.
 */
export const SNAPSHOT_MAX = 2_000;

export function snapshot(text: string): string {
  const sauber = text.trim();
  return sauber.length <= SNAPSHOT_MAX ? sauber : `${sauber.slice(0, SNAPSHOT_MAX)} […]`;
}
