/**
 * Kalenderrechnung - ohne Datenbank und ohne React, damit sie fuer sich
 * testbar ist.
 *
 * Alle Daten liegen hier mittags (wie in lib/planning.ts). Das ist kein
 * Schoenheitsfehler, sondern der Grund, warum kein Termin durch eine
 * Zeitzonen- oder Sommerzeitverschiebung auf den Vortag rutscht.
 */
import { atNoon } from "@/lib/planning";

export interface CalendarDay {
  /** mittags an diesem Tag */
  date: Date;
  /** "2026-09-17" - Schluessel fuer die Zuordnung von Terminen */
  key: string;
  /** gehoert der Tag zum angezeigten Monat oder ist er nur Rand? */
  inMonth: boolean;
  isToday: boolean;
}

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;
const monthFormatter = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" });

export const WEEKDAY_LABELS = WEEKDAYS;

function zwei(zahl: number): string {
  return String(zahl).padStart(2, "0");
}

/**
 * "2026-09-17" aus den oertlichen Bestandteilen.
 *
 * Bewusst nicht ueber toISOString(): Das rechnet nach UTC um und wuerde in
 * einer Zeitzone oestlich von Greenwich abends den naechsten Tag liefern.
 */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${zwei(date.getMonth() + 1)}-${zwei(date.getDate())}`;
}

/** "2026-09" */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${zwei(date.getMonth() + 1)}`;
}

/** "September 2026" */
export function monthLabel(date: Date): string {
  return monthFormatter.format(date);
}

/** Erster Tag des Monats, mittags. */
export function startOfMonth(date: Date): Date {
  return atNoon(new Date(date.getFullYear(), date.getMonth(), 1));
}

/**
 * Monate vor oder zurueck.
 *
 * Erst auf den Ersten setzen: Vom 31. Januar aus wuerde "ein Monat weiter"
 * sonst im Maerz landen, weil es keinen 31. Februar gibt.
 */
export function shiftMonth(date: Date, delta: number): Date {
  return atNoon(new Date(date.getFullYear(), date.getMonth() + delta, 1));
}

/** "2026-09" einlesen; alles andere ergibt null. */
export function parseMonthKey(value: string | undefined): Date | null {
  if (!value) return null;
  const treffer = /^(\d{4})-(\d{2})$/.exec(value);
  if (!treffer) return null;
  const jahr = Number(treffer[1]);
  const monat = Number(treffer[2]);
  if (monat < 1 || monat > 12) return null;
  return atNoon(new Date(jahr, monat - 1, 1));
}

/** "2026-09-17" einlesen; alles andere ergibt null. */
export function parseDayKey(value: string | undefined): Date | null {
  if (!value) return null;
  const treffer = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!treffer) return null;
  const [jahr, monat, tag] = treffer.slice(1).map(Number);
  const datum = atNoon(new Date(jahr, monat - 1, tag));
  // Der 31. April wuerde sonst still zum 1. Mai - lieber ablehnen.
  if (datum.getMonth() !== monat - 1 || datum.getDate() !== tag) return null;
  return datum;
}

/**
 * Das Monatsraster, in vollen Wochen von Montag bis Sonntag.
 *
 * Die Tage vor dem Monatsersten und nach dem Monatsletzten gehoeren zum
 * Nachbarmonat und sind mit inMonth = false gekennzeichnet; sie bleiben im
 * Raster stehen, damit die Wochen nicht zerfallen.
 */
export function buildMonthGrid(month: Date, today: Date = new Date()): CalendarDay[][] {
  const erster = startOfMonth(month);
  // Tag 0 des Folgemonats ist der letzte Tag dieses Monats.
  const letzter = atNoon(new Date(erster.getFullYear(), erster.getMonth() + 1, 0));
  // getDay(): 0 = Sonntag. Gezaehlt wird ab Montag, wie im deutschen Kalender.
  const versatz = (erster.getDay() + 6) % 7;

  const laufend = new Date(erster);
  laufend.setDate(laufend.getDate() - versatz);

  const heuteKey = dayKey(today);
  const wochen: CalendarDay[][] = [];

  // Volle Wochen, bis der Monatsletzte drin ist - je nach Monat vier bis sechs.
  while (laufend.getTime() <= letzter.getTime()) {
    const woche: CalendarDay[] = [];
    for (let i = 0; i < 7; i += 1) {
      const tag = atNoon(laufend);
      woche.push({
        date: tag,
        key: dayKey(tag),
        inMonth: tag.getMonth() === erster.getMonth(),
        isToday: dayKey(tag) === heuteKey,
      });
      laufend.setDate(laufend.getDate() + 1);
    }
    wochen.push(woche);
  }

  return wochen;
}
