import { describeSoon } from "@/lib/appointments";
import { fail, ok } from "@/lib/api";
import { prisma } from "@/lib/db";
import { startOfDay } from "@/lib/limits";
import { sendToUsers } from "@/lib/push-send";

/**
 * Die taegliche Erinnerung: "2 Lernaufgaben offen · Termin morgen 15:00".
 *
 * Wird von einem Zeitplan aufgerufen (vercel.json), nicht von der App. Wer
 * heute nichts offen hat und keinen Termin vor sich, bekommt nichts - eine
 * Benachrichtigung ohne Inhalt ist nur Rauschen.
 *
 * Geschickt wird nur an Konten, die sich angemeldet haben; ueber die
 * Abonnements laeuft ohnehin alles.
 */
export async function GET(request: Request) {
  const geheim = process.env.CRON_SECRET;
  // Ohne Geheimnis bleibt die Route zu. Sonst koennte jeder im Netz allen
  // Nutzern Benachrichtigungen schicken, indem er diese Adresse aufruft.
  if (!geheim) return fail("Diese Route ist nicht eingerichtet.", 503);
  if (request.headers.get("authorization") !== `Bearer ${geheim}`) {
    return fail("Nicht erlaubt.", 401);
  }

  const jetzt = new Date();
  const tagesBeginn = startOfDay(jetzt);
  const tagesEnde = new Date(tagesBeginn);
  tagesEnde.setHours(23, 59, 59, 999);
  const in24Stunden = new Date(jetzt.getTime() + 24 * 60 * 60 * 1000);

  // Nur Konten mit angemeldetem Geraet - fuer alle anderen waere jede
  // Abfrage vergebliche Arbeit.
  const empfaenger = await prisma.pushSubscription.findMany({
    distinct: ["userId"],
    select: { userId: true },
  });
  const ids = empfaenger.map((eintrag) => eintrag.userId);
  if (ids.length === 0) return ok({ empfaenger: 0, benachrichtigt: 0 });

  // Zwei Abfragen fuer alle Empfaenger, nicht zwei je Empfaenger.
  const [aufgaben, termine] = await Promise.all([
    prisma.studyTask.findMany({
      where: {
        done: false,
        skipped: false,
        dueDate: { gte: tagesBeginn, lte: tagesEnde },
        evaluation: { assessment: { learningGoal: { userId: { in: ids } } } },
      },
      select: {
        evaluation: { select: { assessment: { select: { learningGoal: { select: { userId: true } } } } } },
      },
    }),
    prisma.appointment.findMany({
      where: {
        status: "confirmed",
        startsAt: { gte: jetzt, lte: in24Stunden },
        request: { OR: [{ requesterId: { in: ids } }, { tutorOffer: { userId: { in: ids } } }] },
      },
      select: {
        startsAt: true,
        request: { select: { requesterId: true, tutorOffer: { select: { userId: true } } } },
      },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  const offenJeNutzer = new Map<string, number>();
  for (const aufgabe of aufgaben) {
    const userId = aufgabe.evaluation.assessment.learningGoal.userId;
    offenJeNutzer.set(userId, (offenJeNutzer.get(userId) ?? 0) + 1);
  }

  // Termine aufsteigend sortiert - der erste Eintrag je Nutzer ist der
  // naechste.
  const naechsterTermin = new Map<string, Date>();
  for (const termin of termine) {
    for (const userId of [termin.request.requesterId, termin.request.tutorOffer.userId]) {
      if (!ids.includes(userId)) continue;
      if (!naechsterTermin.has(userId)) naechsterTermin.set(userId, termin.startsAt);
    }
  }

  let benachrichtigt = 0;
  for (const userId of ids) {
    const offeneAufgaben = offenJeNutzer.get(userId) ?? 0;
    const termin = naechsterTermin.get(userId);
    if (offeneAufgaben === 0 && !termin) continue;

    const bericht = await sendToUsers([userId], {
      art: "erinnerung",
      offeneAufgaben,
      naechsterTermin: termin ? describeSoon(termin, jetzt) : null,
    });
    if (bericht.zugestellt > 0) benachrichtigt += 1;
  }

  return ok({ empfaenger: ids.length, benachrichtigt });
}
