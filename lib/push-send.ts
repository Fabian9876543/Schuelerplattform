import { after } from "next/server";
import webpush from "web-push";

import { notificationFor, shouldSend, type PushEvent } from "@/lib/push";
import { dropSubscription, markSuccess, subscriptionsFor } from "@/lib/push-db";

/**
 * Der Versand von Benachrichtigungen.
 *
 * Ohne VAPID-Schluessel in der Umgebung passiert nichts - genau wie die
 * KI-Auswertung ohne API-Schluessel auf die regelbasierte Variante
 * zurueckfaellt. Die App laeuft vollstaendig, nur eben still.
 */

export interface Zustellbericht {
  /** wurde ueberhaupt versucht? */
  versucht: boolean;
  zugestellt: number;
  /** Abonnements, die der Push-Dienst nicht mehr kennt und die wir geloescht haben */
  aufgeraeumt: number;
  fehler: number;
  /** wenn nicht versucht wurde: warum */
  grund?: "keine-schluessel" | "nachtruhe" | "keine-geraete";
}

/** Ein Zusteller - austauschbar, damit sich der Weg ohne echten Versand pruefen laesst. */
export type Zusteller = (
  abo: { endpoint: string; keys: { p256dh: string; auth: string } },
  nutzlast: string,
) => Promise<{ statusCode: number }>;

let konfiguriert = false;
let gewarnt = false;

function vapidBereit(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    if (!gewarnt) {
      console.info(
        "[push] Keine VAPID-Schluessel gesetzt - es werden keine Benachrichtigungen verschickt. " +
          "Siehe README, Abschnitt Benachrichtigungen.",
      );
      gewarnt = true;
    }
    return false;
  }

  if (!konfiguriert) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    konfiguriert = true;
  }
  return true;
}

const echterZusteller: Zusteller = async (abo, nutzlast) => {
  const antwort = await webpush.sendNotification(
    { endpoint: abo.endpoint, keys: abo.keys },
    nutzlast,
    // Eine halbe Tageslaenge: Eine Benachrichtigung ueber eine Nachricht von
    // gestern ist keine Nachricht mehr, sondern Rauschen.
    { TTL: 12 * 60 * 60, urgency: "normal" },
  );
  return { statusCode: antwort.statusCode };
};

/**
 * Verschickt ein Ereignis an alle Geraete der genannten Konten.
 *
 * Wirft nie: Ein misslungener Versand darf die Anfrage nicht scheitern
 * lassen, die ihn ausgeloest hat. Alles Wissenswerte steht im Bericht.
 */
export async function sendToUsers(
  userIds: string[],
  event: PushEvent,
  zusteller: Zusteller = echterZusteller,
  now: Date = new Date(),
): Promise<Zustellbericht> {
  const leer: Zustellbericht = { versucht: false, zugestellt: 0, aufgeraeumt: 0, fehler: 0 };

  if (!vapidBereit()) return { ...leer, grund: "keine-schluessel" };
  if (!shouldSend(event, now)) return { ...leer, grund: "nachtruhe" };

  const abos = await subscriptionsFor(userIds);
  if (abos.length === 0) return { ...leer, grund: "keine-geraete" };

  const nutzlast = JSON.stringify(notificationFor(event));
  const bericht: Zustellbericht = { versucht: true, zugestellt: 0, aufgeraeumt: 0, fehler: 0 };
  const erfolgreich: string[] = [];

  await Promise.all(
    abos.map(async (abo) => {
      try {
        const { statusCode } = await zusteller(
          { endpoint: abo.endpoint, keys: { p256dh: abo.p256dh, auth: abo.auth } },
          nutzlast,
        );
        if (statusCode >= 200 && statusCode < 300) {
          bericht.zugestellt += 1;
          erfolgreich.push(abo.endpoint);
        } else {
          bericht.fehler += 1;
        }
      } catch (error) {
        // 404 und 410 heissen: Dieses Geraet gibt es nicht mehr. Kein Fehler,
        // sondern ein Aufraeumauftrag.
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await dropSubscription(abo.endpoint);
          bericht.aufgeraeumt += 1;
        } else {
          bericht.fehler += 1;
          console.error("[push] Versand fehlgeschlagen:", status ?? error);
        }
      }
    }),
  );

  await markSuccess(erfolgreich);
  return bericht;
}

/**
 * Benachrichtigt im Hintergrund, **nachdem** die Antwort beim Browser ist.
 *
 * Das ist der Grund fuer `after()`: Der Versand geht an fremde Server und
 * kann Sekunden dauern oder scheitern. Beides darf die Anfrage, die ihn
 * ausgeloest hat, weder verzoegern noch zum Scheitern bringen.
 */
export function notifyAfter(userIds: string[], event: PushEvent): void {
  if (userIds.length === 0) return;
  after(async () => {
    try {
      await sendToUsers(userIds, event);
    } catch (error) {
      console.error("[push] unerwarteter Fehler beim Versand:", error);
    }
  });
}

/** Der oeffentliche Schluessel fuer die Anmeldung im Browser - oder null. */
export function publicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}
