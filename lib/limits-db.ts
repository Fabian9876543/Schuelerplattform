import { prisma } from "@/lib/db";

import { loginWindowStart, startOfDay } from "@/lib/limits";

/**
 * Die Zaehler hinter den Grenzwerten aus lib/limits.ts.
 *
 * Bewusst getrennt: Wer nur die Rechnung testen will, soll dafuer keinen
 * Datenbankserver brauchen.
 */
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
