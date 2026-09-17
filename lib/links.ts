import { normalizeTopic, type UserKind } from "@/lib/constants";

/**
 * Die Regeln rund um gepruefte Links - ohne Datenbank, damit sie sich ohne
 * laufenden Server testen lassen. Die Abfragen stehen in lib/links-db.ts.
 */

export interface CuratedLink {
  id: string;
  subject: string;
  /** ueber normalizeTopic() vereinheitlicht */
  topicKey: string;
  topic: string;
  title: string;
  url: string;
  note: string | null;
}

/**
 * Wer Links eintragen darf.
 *
 * Nur Lehrkraefte mit Verwaltungsrechten, dieselbe Linie wie beim Sperren
 * (canBlockAccounts in lib/reports.ts): Wer eine ganze Schule auf fremde
 * Inhalte schickt, traegt dafuer eine Verantwortung. Eine Schuelerin mit
 * Verwaltungsrechten darf Angebote freigeben und Faecher pflegen - fuer das,
 * was ausserhalb der Plattform passiert, geradezustehen ist etwas anderes.
 */
export function canCurateLinks(user: { kind: UserKind; isAdmin: boolean }): boolean {
  return user.isAdmin && user.kind === "teacher";
}

/**
 * Taugt die Adresse?
 *
 * Nur https - ein Link, den die Schule als geprueft ausgibt, soll unterwegs
 * nicht mitlesbar sein. Anmeldedaten in der Adresse werden abgewiesen, weil
 * "https://youtube.com@beispiel.tld" das Ziel verschleiert: Was davor steht,
 * sieht aus wie der Host, ist aber nur der Benutzername.
 */
export function isSafeUrl(input: string): boolean {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  // Ein Host ohne Punkt ist kein oeffentliches Ziel (localhost, Intranet-Namen).
  return url.hostname.includes(".");
}

/** "www.youtube.com" wird zu "youtube.com" - das "www." sagt niemandem etwas. */
export function hostOf(input: string): string {
  try {
    return new URL(input).hostname.replace(/^www\./, "");
  } catch {
    return input;
  }
}

/**
 * Welche Links zu einem Thema passen.
 *
 * Exakter Treffer vor Teiltreffer, wie beim Nachhilfe-Matching in
 * lib/matching.ts: "Kurvendiskussion" schlaegt "Kurvendiskussion und
 * Extremwerte", aber beides ist besser als nichts. Kurze Themenschluessel
 * werden vom Teiltreffer ausgenommen, sonst passt "ab" in alles.
 */
export function matchLinks(links: CuratedLink[], subject: string, topic: string): CuratedLink[] {
  const gesucht = normalizeTopic(topic);
  if (!gesucht) return [];

  return links
    .filter((link) => link.subject === subject)
    .map((link) => {
      if (link.topicKey === gesucht) return { link, score: 2 };
      const langGenug = link.topicKey.length > 2 && gesucht.length > 2;
      if (langGenug && (link.topicKey.includes(gesucht) || gesucht.includes(link.topicKey))) {
        return { link, score: 1 };
      }
      return { link, score: 0 };
    })
    .filter((treffer) => treffer.score > 0)
    .sort((a, b) => b.score - a.score || a.link.title.localeCompare(b.link.title))
    .map((treffer) => treffer.link);
}

/**
 * Eine vorbereitete Suche, wenn die Schule zu diesem Thema nichts hinterlegt hat.
 *
 * Bewusst eine Suche und kein einzelnes Video: Ein von der KI erfundener
 * Video-Link fuehrt ins Leere oder - schlimmer - irgendwohin. Die Suche
 * dagegen fuehrt immer irgendwohin Sinnvolles, und es ist genau das, was man
 * sonst selbst eintippen wuerde.
 */
export function searchUrl(subject: string, topic: string): string {
  const frage = `${subject} ${topic} einfach erklaert`.trim();
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(frage)}`;
}

/** Steht neben der vorbereiteten Suche - sie ist eben nicht geprueft. */
export const SEARCH_HINT =
  "Diese Treffer hat deine Schule nicht geprueft - es ist eine gewoehnliche Suche.";
