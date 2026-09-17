import type { AppointmentStatus, RequestStatus } from "@/lib/constants";

/**
 * Die Regeln rund um feste Lerntermine - ohne Datenbank, damit sie sich ohne
 * laufenden Server testen lassen. Die Abfragen stehen in
 * lib/appointments-db.ts.
 *
 * Zeitzonen: `startsAt` ist eine Wanduhrzeit. Eingegeben wird sie als
 * "2026-09-23T15:00" und hier in ein Datum der Serverzeitzone uebersetzt;
 * angezeigt wird sie mit denselben Bestandteilen. Dadurch kommt heraus, was
 * eingetippt wurde - auch dann, wenn der Server in einer anderen Zeitzone
 * laeuft als die Schule. Ein echter Zeitpunkt mit Zeitzone waere erst noetig,
 * wenn sich Leute ueber Zeitzonen hinweg verabreden, und das tut hier niemand.
 */

/** Zur Auswahl stehende Dauern in Minuten. */
export const DURATIONS = [30, 45, 60, 90, 120] as const;
export const DURATION_MIN = 15;
export const DURATION_MAX = 240;

export interface TerminZeit {
  startsAt: Date;
  durationMinutes: number;
}

const dateTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });

/**
 * Liest "2026-09-23T15:00" aus einem datetime-local-Feld.
 *
 * Bewusst zerlegt statt `new Date(text)`: Das Verhalten dieser Zeichenketten
 * haengt sonst an Feinheiten der Sprachnorm (mit Sekunden, ohne Sekunden, mit
 * Zeitzone). Hier ist es eindeutig - und ein Datum wie der 31. Februar faellt
 * auf, statt still zum 3. Maerz zu werden.
 */
export function parseLocalDateTime(value: string | undefined | null): Date | null {
  if (!value) return null;
  const treffer = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!treffer) return null;

  const [jahr, monat, tag, stunde, minute] = treffer.slice(1).map(Number);
  if (monat < 1 || monat > 12 || stunde > 23 || minute > 59) return null;

  const datum = new Date(jahr, monat - 1, tag, stunde, minute, 0, 0);
  if (datum.getMonth() !== monat - 1 || datum.getDate() !== tag) return null;
  return datum;
}

/** Fuer den Wert eines datetime-local-Feldes. */
export function toLocalDateTimeValue(date: Date): string {
  const z = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${z(date.getMonth() + 1)}-${z(date.getDate())}T${z(date.getHours())}:${z(date.getMinutes())}`;
}

export function endOf(termin: TerminZeit): Date {
  return new Date(termin.startsAt.getTime() + termin.durationMinutes * 60_000);
}

/**
 * Ueberschneiden sich zwei Termine?
 *
 * Beruehrende Termine (einer endet um 16:00, der naechste beginnt um 16:00)
 * gelten nicht als Ueberschneidung - sonst liesse sich kein Termin an den
 * naechsten anschliessen.
 */
export function overlaps(a: TerminZeit, b: TerminZeit): boolean {
  return a.startsAt < endOf(b) && b.startsAt < endOf(a);
}

/** "Mi, 23.09.2026, 15:00-16:00 Uhr" */
export function formatAppointment(termin: TerminZeit): string {
  const ende = endOf(termin);
  return `${dateTimeFormatter.format(termin.startsAt)}, ${timeFormatter.format(termin.startsAt)}–${timeFormatter.format(ende)} Uhr`;
}

export function isPast(startsAt: Date, now: Date = new Date()): boolean {
  return startsAt.getTime() < now.getTime();
}

/** Termine gibt es erst nach einer Zusage - wie Nachrichten auch. */
export function canPropose(requestStatus: RequestStatus): boolean {
  return requestStatus === "accepted";
}

/**
 * Zusagen darf nur die andere Seite.
 *
 * Wer vorschlaegt, sagt nicht selbst zu: Sonst waere der Termin einseitig
 * gesetzt und die Zusage ein leeres Wort.
 */
export function canConfirm(
  termin: { status: AppointmentStatus; proposedById: string },
  userId: string,
): boolean {
  return termin.status === "proposed" && termin.proposedById !== userId;
}

/** Absagen duerfen beide - auch einen bereits zugesagten Termin. */
export function canCancel(termin: { status: AppointmentStatus }): boolean {
  return termin.status !== "cancelled";
}
