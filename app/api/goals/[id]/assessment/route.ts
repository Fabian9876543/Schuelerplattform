import { fail, ok, withUser } from "@/lib/api";
import { getCoach } from "@/lib/ai";
import { prisma } from "@/lib/db";
import { LIMITS, assessmentsToday } from "@/lib/limits";
import { serializeOptions } from "@/lib/questions";

/**
 * Startet einen Selbsttest: laesst die Fragen erzeugen und legt sie ab.
 * Ein bereits begonnener, noch nicht abgeschickter Test wird weiterverwendet,
 * damit ein zweiter Klick nicht alles neu erzeugt.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return withUser(async (user) => {
    const { id } = await context.params;

    const goal = await prisma.learningGoal.findUnique({
      where: { id },
      include: {
        topics: { orderBy: { position: "asc" } },
        assessments: { where: { status: "draft" }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    if (!goal || goal.userId !== user.id) return fail("Klausur nicht gefunden.", 404);
    if (goal.topics.length === 0) return fail("Zu dieser Klausur sind keine Themen hinterlegt.");

    const existing = goal.assessments[0];
    if (existing) return ok({ id: existing.id, reused: true });

    // Vor dem Erzeugen pruefen, nicht danach: Jeder Selbsttest kostet rund
    // 0,09 USD an API-Nutzung. Ein wiederverwendeter zaehlt nicht mit, sonst
    // wuerde blosses Fortsetzen das Kontingent aufbrauchen.
    if ((await assessmentsToday(user.id)) >= LIMITS.assessmentsPerDay) {
      return fail(
        `Du hast heute schon ${LIMITS.assessmentsPerDay} Selbsttests gemacht. Morgen geht es weiter.`,
        429,
      );
    }

    const coach = getCoach();
    const quiz = await coach.generateQuiz({
      subject: goal.subject,
      gradeLevel: user.gradeLevel,
      examDate: goal.examDate,
      topics: goal.topics.map((topic) => ({ id: topic.id, name: topic.name })),
    });

    if (quiz.questions.length === 0) return fail("Es konnten keine Fragen erzeugt werden.", 502);

    const assessment = await prisma.assessment.create({
      data: {
        learningGoalId: goal.id,
        status: "draft",
        questions: {
          create: quiz.questions.map((question, position) => ({
            topicId: question.topicId,
            kind: question.kind,
            prompt: question.prompt,
            position,
            optionsJson: serializeOptions(question.options),
            correctIndex: question.correctIndex,
            expectedPoints: question.expectedPoints,
          })),
        },
      },
    });

    return ok({ id: assessment.id, source: quiz.source }, 201);
  });
}
