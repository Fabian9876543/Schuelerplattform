import { z } from "zod";

import { getCoach, type AnsweredQuestion } from "@/lib/ai";
import { fail, fromZodError, ok, withUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { buildStudyPlan, daysBetween } from "@/lib/planning";
import { parseOptions } from "@/lib/questions";

const schema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string(),
      answerText: z.string().nullable().optional(),
      answerIndex: z.number().int().nullable().optional(),
    }),
  ),
  selfRatings: z.array(
    z.object({
      topicId: z.string(),
      confidence: z.number().int().min(1).max(5),
    }),
  ),
});

/**
 * Nimmt den ausgefuellten Selbsttest entgegen, laesst ihn auswerten und legt
 * daraus Auswertung, Defizite und den Lernplan an.
 *
 * Die Termine des Lernplans rechnet lib/planning.ts aus - die Auswertung
 * liefert nur, WAS gelernt werden muss.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return withUser(async (user) => {
    const { id } = await context.params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fromZodError(parsed.error);

    const assessment = await prisma.assessment.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { position: "asc" } },
        learningGoal: { include: { topics: { orderBy: { position: "asc" } } } },
        evaluation: true,
      },
    });

    if (!assessment || assessment.learningGoal.userId !== user.id) {
      return fail("Selbsttest nicht gefunden.", 404);
    }
    if (assessment.evaluation) {
      return fail("Dieser Selbsttest wurde bereits ausgewertet.", 409);
    }

    const goal = assessment.learningGoal;
    const topicIds = new Set(goal.topics.map((topic) => topic.id));
    const answerByQuestion = new Map(parsed.data.answers.map((answer) => [answer.questionId, answer]));

    // Antworten festhalten, bevor die Auswertung laeuft - falls sie scheitert,
    // ist die Arbeit der Schuelerin nicht verloren.
    await prisma.$transaction([
      ...assessment.questions.map((question) => {
        const answer = answerByQuestion.get(question.id);
        return prisma.question.update({
          where: { id: question.id },
          data: {
            answerText: answer?.answerText ?? null,
            answerIndex: answer?.answerIndex ?? null,
          },
        });
      }),
      ...parsed.data.selfRatings
        .filter((rating) => topicIds.has(rating.topicId))
        .map((rating) =>
          prisma.selfRating.upsert({
            where: {
              assessmentId_topicId: { assessmentId: assessment.id, topicId: rating.topicId },
            },
            create: {
              assessmentId: assessment.id,
              topicId: rating.topicId,
              confidence: rating.confidence,
            },
            update: { confidence: rating.confidence },
          }),
        ),
      prisma.assessment.update({
        where: { id: assessment.id },
        data: { status: "submitted", submittedAt: new Date() },
      }),
    ]);

    const questions: AnsweredQuestion[] = assessment.questions.map((question) => {
      const answer = answerByQuestion.get(question.id);
      return {
        id: question.id,
        topicId: question.topicId,
        kind: question.kind === "multiple_choice" ? "multiple_choice" : "free_text",
        prompt: question.prompt,
        options: parseOptions(question.optionsJson),
        correctIndex: question.correctIndex,
        expectedPoints: question.expectedPoints,
        answerText: answer?.answerText ?? null,
        answerIndex: answer?.answerIndex ?? null,
      };
    });

    const daysUntilExam = Math.max(0, daysBetween(new Date(), goal.examDate));

    const result = await getCoach().evaluate({
      subject: goal.subject,
      gradeLevel: user.gradeLevel,
      topics: goal.topics.map((topic) => ({ id: topic.id, name: topic.name })),
      questions,
      selfRatings: parsed.data.selfRatings,
      daysUntilExam,
    });

    const topicNameById = new Map(goal.topics.map((topic) => [topic.id, topic.name]));
    const validDeficits = result.deficits.filter((deficit) => topicIds.has(deficit.topicId));

    const plan = buildStudyPlan(
      validDeficits.map((deficit) => ({
        topicId: deficit.topicId,
        topicName: topicNameById.get(deficit.topicId) ?? "Thema",
        severity: deficit.severity,
        focus: deficit.focus,
      })),
      goal.examDate,
    );

    await prisma.$transaction([
      ...result.questionFeedback.map((feedback) =>
        prisma.question.update({
          where: { id: feedback.questionId },
          data: { score: feedback.score, feedback: feedback.feedback, isCorrect: feedback.isCorrect },
        }),
      ),
      prisma.evaluation.create({
        data: {
          assessmentId: assessment.id,
          summary: result.summary,
          overallScore: result.overallScore,
          source: result.source,
          deficits: {
            create: validDeficits.map((deficit) => ({
              topicId: deficit.topicId,
              severity: deficit.severity,
              explanation: deficit.explanation,
            })),
          },
          studyTasks: {
            create: plan.map((task) => ({
              topicId: task.topicId,
              dueDate: task.dueDate,
              title: task.title,
              description: task.description,
              estimatedMinutes: task.estimatedMinutes,
            })),
          },
        },
      }),
      prisma.assessment.update({ where: { id: assessment.id }, data: { status: "evaluated" } }),
    ]);

    return ok({ goalId: goal.id, source: result.source, deficits: validDeficits.length });
  });
}
