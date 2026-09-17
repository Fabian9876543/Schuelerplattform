import type { RequestStatus } from "@/lib/constants";

/**
 * Die Rechnung hinter den Bewertungen - ohne Datenbank, damit sie sich ohne
 * laufenden Server testen laesst. Die Abfragen stehen in lib/ratings-db.ts.
 */

export const STAR_MIN = 1;
export const STAR_MAX = 5;

/** Schnitt der Sterne, oder null, wenn es noch keine Rueckmeldung gibt. */
export function averageStars(stars: number[]): number | null {
  if (stars.length === 0) return null;
  return stars.reduce((summe, wert) => summe + wert, 0) / stars.length;
}

/** "4,7" - eine Nachkommastelle, deutsches Komma. */
export function formatStars(average: number): string {
  return average.toFixed(1).replace(".", ",");
}

/** "3 Rueckmeldungen", "1 Rueckmeldung" */
export function describeRatingCount(count: number): string {
  return `${count} ${count === 1 ? "Rueckmeldung" : "Rueckmeldungen"}`;
}

/**
 * Wie stark eine Bewertung die Trefferliste verschiebt.
 *
 * Drei Ueberlegungen stecken darin:
 *
 * 1. **Ohne Rueckmeldung kein Nachteil.** Wer neu anfaengt, bekommt 0 - denselben
 *    Wert wie ein genau durchschnittlich bewertetes Angebot. Sonst kaeme nie
 *    jemand zu seiner ersten Anfrage, und die Liste waere eingefroren.
 * 2. **Wenige Stimmen wiegen weniger.** Eine einzelne Fuenf ist ein Zufall,
 *    drei sind ein Hinweis. Darum die Staffelung bis {@link VOLLES_GEWICHT}.
 * 3. **Der Bonus bleibt klein.** Er liegt zwischen -1 und +1, waehrend ein
 *    exakter Thementreffer 3 Punkte bringt. Bewertungen entscheiden damit
 *    nur bei annaehernd gleich passenden Angeboten - wer das Thema kann,
 *    steht weiter oben als wer nur beliebt ist.
 */
const VOLLES_GEWICHT = 3;

export function ratingBonus(average: number | null, count: number): number {
  if (average === null || count === 0) return 0;
  const abweichung = (average - 3) / 2; // -1 (nur Einsen) bis +1 (nur Fuenfen)
  const sicherheit = Math.min(count, VOLLES_GEWICHT) / VOLLES_GEWICHT;
  return abweichung * sicherheit;
}

/**
 * Bewerten darf nur, wer angefragt hat, und erst nach einer Zusage.
 *
 * Die Gegenrichtung gibt es bewusst nicht: Sichtbar werden sollen gute
 * Erklaerer. Eine Note fuer Hilfesuchende haette keinen Nutzen, aber
 * jede Menge sozialen Sprengstoff im Klassenzimmer.
 */
export function canRate(status: RequestStatus, isRequester: boolean): boolean {
  return isRequester && status === "accepted";
}
