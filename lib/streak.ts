import { dayKey } from "@/lib/calendar";

/**
 * Serie und Wochenbilanz - ohne Datenbank, damit sie sich ohne laufenden
 * Server testen lassen.
 *
 * Gerechnet wird ueber Kalendertage, nicht ueber Stunden: Wer um 23:50 und um
 * 00:10 etwas abhakt, hat an zwei Tagen gelernt. Die Tagesschluessel kommen
 * aus lib/calendar.ts und damit aus den oertlichen Bestandteilen - nicht
 * ueber UTC, sonst waere abends alles einen Tag zu weit.
 */

/** Die Kalendertage, an denen mindestens eine Aufgabe abgehakt wurde. */
export function activeDays(zeitpunkte: Date[]): Set<string> {
  return new Set(zeitpunkte.map((zeitpunkt) => dayKey(zeitpunkt)));
}

function vortag(tag: Date): Date {
  const d = new Date(tag);
  d.setDate(d.getDate() - 1);
  return d;
}

/**
 * Wie viele Tage am Stueck zuletzt etwas geschafft wurde.
 *
 * Der heutige Tag zaehlt mit, **muss** aber nicht dabei sein: Wer gestern
 * gelernt hat und heute noch nicht, steht morgens weiter bei seiner Serie.
 * Erst wenn auch gestern nichts war, ist sie vorbei. Alles andere waere eine
 * Uhr, die einem um Mitternacht die Arbeit von fuenf Tagen wegnimmt.
 */
export function currentStreak(tage: Set<string>, heute: Date = new Date()): number {
  let zeiger = tage.has(dayKey(heute)) ? new Date(heute) : vortag(heute);
  if (!tage.has(dayKey(zeiger))) return 0;

  let laenge = 0;
  while (tage.has(dayKey(zeiger))) {
    laenge += 1;
    zeiger = vortag(zeiger);
  }
  return laenge;
}

/** Montag dieser Woche, 0 Uhr - der deutsche Wochenanfang. */
export function startOfWeek(now: Date = new Date()): Date {
  const montag = new Date(now);
  // getDay(): 0 = Sonntag. Wir zaehlen ab Montag.
  montag.setDate(montag.getDate() - ((montag.getDay() + 6) % 7));
  montag.setHours(0, 0, 0, 0);
  return montag;
}

/** Wie viele Aufgaben seit Montag abgehakt wurden. */
export function doneThisWeek(zeitpunkte: Date[], now: Date = new Date()): number {
  const montag = startOfWeek(now);
  return zeitpunkte.filter((zeitpunkt) => zeitpunkt >= montag && zeitpunkt <= now).length;
}

/** "5 Tage in Folge" - oder nichts, wenn es nichts zu feiern gibt. */
export function describeStreak(tage: number): string | null {
  if (tage <= 0) return null;
  return `${tage} ${tage === 1 ? "Tag" : "Tage"} in Folge`;
}
