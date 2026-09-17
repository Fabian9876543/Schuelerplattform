/**
 * Grenzwerte an einer Stelle, statt verstreut in den Route Handlern.
 *
 * Diese Datei greift bewusst NICHT auf die Datenbank zu - dadurch laesst sie
 * sich ohne laufenden Datenbankserver testen. Die Zaehlfunktionen stehen in
 * lib/limits-db.ts.
 *
 * Zwei der Grenzen schuetzen bares Geld: Jeder erzeugte Selbsttest kostet
 * rund 0,09 USD an API-Nutzung, jede Auswertung rund 0,07 USD (gemessen).
 * Ohne Deckel koennte ein einziger Zugang in Minuten dreistellige Betraege
 * verursachen.
 */
export const LIMITS = {
  /** Selbsttests je Nutzer und Tag - deckelt die Kosten auf ~1,60 USD pro Nutzer */
  assessmentsPerDay: 10,
  /**
   * Erklaerungen je Nutzer und Tag, die die KI wirklich gefragt haben.
   * Ein Aufruf kostet geschaetzt 0,04 USD - anders als bei Selbsttest und
   * Auswertung ist das nicht gemessen. Treffer im Zwischenspeicher zaehlen
   * nicht mit: Sie kosten nichts, und wer eine Erklaerung noch einmal
   * aufschlaegt, soll dafuer nicht bestraft werden.
   */
  explanationsPerDay: 20,
  /** Lernvorhaben je Nutzer - grosszuegig fuer echte Nutzung, bremst Schleifen */
  goalsPerUser: 50,
  /** Fehlversuche je E-Mail im Zeitfenster */
  loginAttempts: 10,
  /** Laenge des Zeitfensters fuer Anmeldeversuche, in Minuten */
  loginWindowMinutes: 15,

  // Laengen fuer alles, was in einen KI-Prompt gelangt oder gespeichert wird
  answerLength: 5_000,
  titleLength: 200,
  topicLength: 100,
  messageLength: 2_000,
  descriptionLength: 1_000,
  /** Kommentar zu einer Bewertung - ein Satz reicht, kein Aufsatz */
  commentLength: 500,
  /** Meldungen je Nutzer und Tag - bremst das Zuschuetten mit Meldungen */
  reportsPerDay: 10,
  /** Geraete je Nutzer fuer Benachrichtigungen - aelteste fallen heraus */
  devicesPerUser: 10,
  /** Was die meldende Person dazuschreibt */
  reportNoteLength: 500,
  /** Titel eines gepruefen Links */
  linkTitleLength: 150,
  /** Adresse eines gepruefen Links */
  linkUrlLength: 500,
} as const;

// --- reine Funktionen, ohne Datenbank ---------------------------------------

/** Beginn des Kalendertags - Bezugspunkt fuer das Tageskontingent. */
export function startOfDay(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Anfang des gleitenden Zeitfensters fuer Anmeldeversuche. */
export function loginWindowStart(now: Date = new Date()): Date {
  return new Date(now.getTime() - LIMITS.loginWindowMinutes * 60_000);
}

/**
 * Wie lange noch gesperrt? Rechnet vom aeltesten Versuch im Fenster aus,
 * damit die Sperre mitwandert statt bei jedem Versuch neu zu beginnen.
 */
export function minutesUntilUnlocked(oldestAttempt: Date, now: Date = new Date()): number {
  const frei = oldestAttempt.getTime() + LIMITS.loginWindowMinutes * 60_000;
  return Math.max(1, Math.ceil((frei - now.getTime()) / 60_000));
}
