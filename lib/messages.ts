import type { RequestStatus } from "@/lib/constants";

/**
 * Die Regeln fuer den Nachrichtenverlauf - ohne Datenbank, damit sie sich
 * ohne laufenden Server testen lassen. Die Abfragen dazu stehen in
 * lib/messages-db.ts.
 */

export type ThreadRole = "requester" | "tutor";

/** Die beiden Personen, die zu einer Anfrage gehoeren. */
export interface Participants {
  /** wer die Anfrage gestellt hat */
  requesterId: string;
  /** wem das angefragte Angebot gehoert */
  tutorUserId: string;
}

/**
 * Wer in diesem Verlauf mitschreiben darf - und in welcher Rolle.
 *
 * `null` heisst: unbeteiligt. Alles andere als diese beiden Konten hat an
 * einem Verlauf nichts zu suchen, auch nicht lesend.
 */
export function participantRole(participants: Participants, userId: string): ThreadRole | null {
  if (participants.requesterId === userId) return "requester";
  if (participants.tutorUserId === userId) return "tutor";
  return null;
}

/**
 * Geschrieben wird erst nach einer Zusage.
 *
 * Sonst koennte jeder jeden anschreiben, indem er eine Anfrage stellt - die
 * Anfrage selbst waere dann nur noch die Eintrittskarte in ein offenes
 * Postfach. Mit dieser Schranke ist die eine Eroeffnungsnachricht alles, was
 * ohne Einverstaendnis der Gegenseite ankommt.
 */
export function canWrite(status: RequestStatus): boolean {
  return status === "accepted";
}

/** "3 neu" - fuer den Zaehler an der Navigation und an der Anfrage. */
export function describeUnread(count: number): string {
  return `${count} neu`;
}
