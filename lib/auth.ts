import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import type { UserRole } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/school";

const COOKIE_NAME = "schuelerplattform_session";
const SESSION_DAYS = 30;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  gradeLevel: number;
  /// An welche Schule der Zugang gebunden ist - Suche und Anfragen enden hier.
  schoolId: string;
  schoolName: string;
  role: UserRole;
  /// Verlangt diese Schule eine Freigabe fuer Nachhilfe-Angebote?
  schoolRequiresApproval: boolean;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Legt eine Session an und setzt das Cookie. */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  await prisma.session.create({ data: { token, userId, expiresAt } });

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;

  if (token) {
    // deleteMany statt delete: ein bereits abgelaufener Token soll nicht werfen.
    await prisma.session.deleteMany({ where: { token } });
  }
  store.delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { include: { school: true } } },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.deleteMany({ where: { token } });
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    gradeLevel: session.user.gradeLevel,
    schoolId: session.user.schoolId,
    schoolName: session.user.school.name,
    role: session.user.role,
    schoolRequiresApproval: session.user.school.requiresApproval,
  };
}

/** Fuer Seiten: leitet zum Login um, wenn niemand angemeldet ist. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Fuer die Verwaltungsseite. Wer nicht angemeldet ist, landet beim Login;
 * wer angemeldet ist, aber nichts zu verwalten hat, bekommt 404 statt einer
 * Meldung - die Seite muss ihm gar nicht erst bekannt werden.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isAdmin(user.role)) notFound();
  return user;
}
