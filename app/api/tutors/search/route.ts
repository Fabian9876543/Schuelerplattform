import { ok, withUser } from "@/lib/api";
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

    const grade = Number(url.searchParams.get("grade"));

    const matches = await searchTutors({
      subject,
      topic: url.searchParams.get("topic") ?? undefined,
      gradeLevel: Number.isFinite(grade) && grade > 0 ? grade : user.gradeLevel,
      excludeUserId: user.id,
    });

    return ok({ matches });
  });
}
