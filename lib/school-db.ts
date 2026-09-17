import { prisma } from "@/lib/db";

/**
 * Die Abfragen der Schulverwaltung.
 *
 * Alles hier ist auf eine Schule beschraenkt: Ein Verwalter verwaltet seine
 * eigene Schule und sonst keine. Und er sieht, wer was anbietet - nicht, was
 * die Leute einander schreiben, wie sie bewertet haben oder wie ihre
 * Selbsttests ausgefallen sind. Diese Abfragen gibt es hier schlicht nicht.
 */

/** Die Faecher, die diese Schule zulaesst (leer = alle). */
export async function schoolSubjects(schoolId: string): Promise<string[]> {
  const zeilen = await prisma.schoolSubject.findMany({
    where: { schoolId },
    select: { subject: true },
  });
  return zeilen.map((zeile) => zeile.subject);
}

/** Alles, was die Verwaltungsseite anzeigt. */
export async function schoolOverview(schoolId: string) {
  const [school, members, offers, faecher, zahlen] = await Promise.all([
    prisma.school.findUniqueOrThrow({
      where: { id: schoolId },
      select: {
        id: true,
        name: true,
        joinCode: true,
        teacherJoinCode: true,
        requiresApproval: true,
      },
    }),
    prisma.user.findMany({
      where: { schoolId },
      select: {
        id: true,
        name: true,
        email: true,
        gradeLevel: true,
        kind: true,
        isAdmin: true,
        createdAt: true,
        _count: { select: { tutorOffers: true } },
      },
      // Verwaltung zuerst, danach alphabetisch.
      orderBy: [{ isAdmin: "desc" }, { name: "asc" }],
    }),
    prisma.tutorOffer.findMany({
      where: { user: { schoolId } },
      select: {
        id: true,
        subject: true,
        maxGradeLevel: true,
        description: true,
        active: true,
        approved: true,
        approvedAt: true,
        user: { select: { id: true, name: true, gradeLevel: true, kind: true } },
        topics: { select: { id: true, name: true } },
        approvedBy: { select: { name: true } },
      },
      orderBy: [{ approved: "asc" }, { subject: "asc" }],
    }),
    schoolSubjects(schoolId),
    Promise.all([
      prisma.tutoringRequest.count({ where: { requester: { schoolId } } }),
      prisma.appointment.count({
        where: { status: "confirmed", request: { requester: { schoolId } } },
      }),
    ]),
  ]);

  return {
    school,
    members,
    offers,
    faecher,
    anfragen: zahlen[0],
    termine: zahlen[1],
  };
}
