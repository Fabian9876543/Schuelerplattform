import { ok, withUser } from "@/lib/api";
import { studentOrDeny } from "@/lib/school-api";
import { searchTutors } from "@/lib/tutors";

/**
 * Sucht passende Nachhilfe-Angebote.
 * Bewertung in lib/matching.ts, Datenzugriff in lib/tutors.ts.
 */
export async function GET(request: Request) {
  return withUser(async (user) => {
    const url = new URL(request.url);
    const subject = url.searchParams.get("subject");
    if (!subject) return ok({ matches: [] });

    const { deny, student } = studentOrDeny(user);
    if (deny) return deny;

    const grade = Number(url.searchParams.get("grade"));

    const matches = await searchTutors({
      subject,
      topic: url.searchParams.get("topic") ?? undefined,
      gradeLevel: Number.isFinite(grade) && grade > 0 ? grade : student.gradeLevel,
      excludeUserId: user.id,
      schoolId: user.schoolId,
      requiresApproval: user.schoolRequiresApproval,
    });

    return ok({ matches });
  });
}
