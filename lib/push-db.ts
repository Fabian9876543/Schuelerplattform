import { prisma } from "@/lib/db";

/**
 * Die Abonnements der Geraete.
 *
 * Geschluesselt wird ueber `endpoint` - die Adresse beim Push-Dienst des
 * Browserherstellers. Meldet sich dasselbe Geraet erneut an (nach einem
 * Ausschalten, nach einem Update), aktualisiert das den vorhandenen Eintrag
 * statt einen zweiten anzulegen.
 */

export interface BrowserAbo {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function saveSubscription(
  userId: string,
  abo: BrowserAbo,
  userAgent?: string | null,
): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: { endpoint: abo.endpoint },
    // userId wird beim Aktualisieren mitgeschrieben: Ein weitergegebenes
    // Geraet soll die Benachrichtigungen des Vorbesitzers nicht weiter
    // bekommen.
    update: { userId, p256dh: abo.keys.p256dh, auth: abo.keys.auth, userAgent: userAgent ?? null },
    create: {
      userId,
      endpoint: abo.endpoint,
      p256dh: abo.keys.p256dh,
      auth: abo.keys.auth,
      userAgent: userAgent ?? null,
    },
  });
}

/** Abmelden - nur das eigene Abonnement. */
export async function deleteSubscription(userId: string, endpoint: string): Promise<number> {
  const { count } = await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  return count;
}

/** Hat dieses Konto mindestens ein Geraet angemeldet? Fuer den Schalter. */
export async function hasSubscription(userId: string): Promise<boolean> {
  return (await prisma.pushSubscription.count({ where: { userId } })) > 0;
}

export async function subscriptionsFor(userIds: string[]) {
  if (userIds.length === 0) return [];
  return prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, userId: true, endpoint: true, p256dh: true, auth: true },
  });
}

/**
 * Ein Abonnement wegwerfen, das der Push-Dienst als unbekannt meldet.
 *
 * Das passiert im Normalbetrieb: App geloescht, Browserdaten geleert,
 * Abonnement abgelaufen. Ohne dieses Aufraeumen sammeln sich totes Gewicht
 * und bei jedem Versand vermeidbare Fehlversuche.
 */
export async function dropSubscription(endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

export async function markSuccess(endpoints: string[]): Promise<void> {
  if (endpoints.length === 0) return;
  await prisma.pushSubscription.updateMany({
    where: { endpoint: { in: endpoints } },
    data: { lastSuccessAt: new Date() },
  });
}
