/**
 * Was in einer Benachrichtigung steht, und wann ueberhaupt eine verschickt
 * wird - ohne Datenbank, damit es sich ohne laufenden Server testen laesst.
 * Der Versand steht in lib/push-send.ts, die Abonnements in lib/push-db.ts.
 *
 * Eine Entscheidung zieht durch alle Texte: **Auf dem Sperrbildschirm steht
 * kein Inhalt.** "Neue Nachricht von Mira Sahin" - nicht, was sie geschrieben
 * hat. Eine Benachrichtigung liest jeder mit, der auf das liegende Handy
 * schaut; der Inhalt gehoert den beiden Beteiligten. Das ist dieselbe Linie
 * wie bei der Verwaltung, die keine Verlaeufe sieht.
 */

/** Die Ereignisse, die eine Benachrichtigung ausloesen. */
export type PushEvent =
  | { art: "anfrage"; von: string; fach: string; requestId: string }
  | { art: "beantwortet"; von: string; zugesagt: boolean; requestId: string }
  | { art: "nachricht"; von: string; requestId: string }
  | { art: "terminvorschlag"; von: string; wann: string; requestId: string }
  | { art: "terminentschieden"; von: string; wann: string; zugesagt: boolean; requestId: string }
  | { art: "meldung" }
  | { art: "erinnerung"; offeneAufgaben: number; naechsterTermin: string | null };

export interface PushInhalt {
  title: string;
  body: string;
  /** Wohin der Klick fuehrt */
  url: string;
  /**
   * Gleiche Marke ersetzt eine noch offene Benachrichtigung statt eine zweite
   * anzuzeigen. Fuenf Nachrichten aus einem Verlauf werden so zu einer
   * Meldung, nicht zu fuenf.
   */
  tag: string;
}

export function notificationFor(event: PushEvent): PushInhalt {
  switch (event.art) {
    case "anfrage":
      return {
        title: "Neue Nachhilfe-Anfrage",
        body: `${event.von} fragt dich zu ${event.fach}.`,
        url: "/anfragen",
        tag: `anfrage:${event.requestId}`,
      };

    case "beantwortet":
      return {
        title: event.zugesagt ? "Zusage" : "Absage",
        body: event.zugesagt
          ? `${event.von} hilft dir. Jetzt koennt ihr schreiben und einen Termin ausmachen.`
          : `${event.von} kann nicht helfen. Auf der Suche gibt es weitere Angebote.`,
        url: event.zugesagt ? `/anfragen/${event.requestId}` : "/nachhilfe",
        tag: `beantwortet:${event.requestId}`,
      };

    case "nachricht":
      return {
        title: "Neue Nachricht",
        // Bewusst ohne Inhalt - siehe Hinweis oben.
        body: `${event.von} hat dir geschrieben.`,
        url: `/anfragen/${event.requestId}`,
        tag: `nachricht:${event.requestId}`,
      };

    case "terminvorschlag":
      return {
        title: "Terminvorschlag",
        body: `${event.von} schlaegt vor: ${event.wann}`,
        url: `/anfragen/${event.requestId}`,
        tag: `termin:${event.requestId}`,
      };

    case "terminentschieden":
      return {
        title: event.zugesagt ? "Termin steht" : "Termin abgesagt",
        body: event.zugesagt ? `${event.wann} mit ${event.von}` : `${event.wann} mit ${event.von}`,
        url: `/anfragen/${event.requestId}`,
        tag: `termin:${event.requestId}`,
      };

    case "meldung":
      return {
        title: "Neue Meldung",
        // Ohne jeden Hinweis auf den gemeldeten Inhalt oder die Beteiligten:
        // Der Wortlaut steht in der Verwaltung, nicht auf dem Sperrbildschirm.
        body: "In deiner Schule liegt eine Meldung vor.",
        url: "/schule",
        tag: "meldung",
      };

    case "erinnerung": {
      const teile: string[] = [];
      if (event.offeneAufgaben > 0) {
        teile.push(
          `${event.offeneAufgaben} ${event.offeneAufgaben === 1 ? "Lernaufgabe" : "Lernaufgaben"} offen`,
        );
      }
      if (event.naechsterTermin) teile.push(`Termin ${event.naechsterTermin}`);
      return {
        title: "Heute in deinem Lernplan",
        body: teile.join(" · "),
        url: "/kalender",
        tag: "erinnerung",
      };
    }
  }
}

// --- Nachtruhe ---------------------------------------------------------------

export const QUIET_FROM = 22;
export const QUIET_UNTIL = 7;

/**
 * Zwischen 22 und 7 Uhr wird nicht benachrichtigt.
 *
 * Nicht nachgeschickt, sondern weggelassen: Eine Benachrichtigung ueber etwas
 * von vor neun Stunden hilft niemandem, und in der App steht die Zahl der
 * Ungelesenen ohnehin.
 */
export function inQuietHours(now: Date = new Date()): boolean {
  const stunde = now.getHours();
  return stunde >= QUIET_FROM || stunde < QUIET_UNTIL;
}

/**
 * Die taegliche Erinnerung kommt vom Zeitplan und liegt damit ohnehin am
 * Nachmittag - sie ist von der Nachtruhe nicht betroffen. Alles andere
 * entsteht durch eine Handlung und kann mitten in der Nacht passieren.
 */
export function shouldSend(event: PushEvent, now: Date = new Date()): boolean {
  if (event.art === "erinnerung") return true;
  return !inQuietHours(now);
}

/**
 * Empfaenger ohne die Person, die das Ereignis ausgeloest hat - und ohne
 * Doppelte.
 *
 * Wer etwas tut, braucht darueber keine Benachrichtigung. Betrifft vor allem
 * die Verwalter: Meldet ein Verwalter selbst etwas, soll er nicht von seiner
 * eigenen Meldung benachrichtigt werden.
 */
export function withoutActor(userIds: string[], actorId: string): string[] {
  return [...new Set(userIds)].filter((id) => id !== actorId);
}
