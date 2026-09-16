import { prisma } from "@/lib/db";

/**
 * Grenzwerte an einer Stelle, statt verstreut in den Route Handlern.
 *
 * Zwei der Grenzen schuetzen bares Geld: Jeder erzeugte Selbsttest kostet
 * rund 0,09 USD an API-Nutzung, jede Auswertung rund 0,07 USD (gemessen).
 * Ohne Deckel koennte ein einziger Zugang in Minuten dreistellige Betraege
 * verursachen.
 */
export const LIMITS = {
  /** Selbsttests je Nutzer und Tag - deckelt die Kosten auf ~1,60 USD pro Nutzer */
  assessmentsPerDay: 10,
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

// --- Zaehler auf der Datenbank ----------------------------------------------

/**
 * Selbsttests, die dieser Nutzer heute angelegt hat.
 * Braucht keine eigene Tabelle - Assessment.createdAt genuegt.
 */
export async function assessmentsToday(userId: string): Promise<number> {
  return prisma.assessment.count({
    where: {
      createdAt: { gte: startOfDay() },
      learningGoal: { userId },
    },
  });
}

export async function goalsOfUser(userId: string): Promise<number> {
  return prisma.learningGoal.count({ where: { userId } });
}

/** Fehlversuche dieser E-Mail im laufenden Zeitfenster, aeltester zuerst. */
export async function recentLoginAttempts(email: string): Promise<Date[]> {
  const rows = await prisma.loginAttempt.findMany({
    where: { email, createdAt: { gte: loginWindowStart() } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  return rows.map((row) => row.createdAt);
}

export async function recordLoginAttempt(email: string): Promise<void> {
  await prisma.loginAttempt.create({ data: { email } });
  // Nebenbei aufraeumen, damit die Tabelle nicht unbegrenzt waechst.
  await prisma.loginAttempt.deleteMany({
    where: { email, createdAt: { lt: loginWindowStart() } },
  });
}

export async function clearLoginAttempts(email: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { email } });
}
