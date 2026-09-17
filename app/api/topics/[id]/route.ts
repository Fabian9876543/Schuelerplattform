import { z } from "zod";

import { fail, fromZodError, ok, withUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { replan, type Mastery } from "@/lib/planning";

const schema = z.object({
  mastery: z.enum(["weak", "medium", "strong"], { error: "Unbekannter Lernstand." }),
});

/**
 * Setzt den Lernstand eines Teilthemas und rechnet den Lernplan nach.
 *
 * Das ist Schritt 5 des Ablaufs: Sitzt ein Thema, entfallen seine offenen
 * Aufgaben; wackelt es wieder, leben sie auf. Liegengebliebenes rutscht dabei
 * nach vorn. Die Terminlogik steckt in lib/planning.ts und ist dort getestet -
 * hier wird nur geladen, angewendet und gespeichert.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return withUser(async (user) => {
    const { id } = await context.params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fromZodError(parsed.error);

    const topic = await prisma.topic.findUnique({
      where: { id },
      include: {
        learningGoal: {
          include: {
            topics: true,
            assessments: {
              orderBy: { createdAt: "desc" },
              take: 1,
              include: { evaluation: { include: { studyTasks: true } } },
            },
          },
        },
      },
    });

    if (!topic || topic.learningGoal.userId !== user.id) {
      return fail("Thema nicht gefunden.", 404);
    }

    await prisma.topic.update({
      where: { id },
      data: { mastery: parsed.data.mastery, masteryUpdatedAt: new Date() },
    });

    const evaluation = topic.learningGoal.assessments[0]?.evaluation;
    if (!evaluation) return ok({ id, mastery: parsed.data.mastery, replanned: 0 });

    // Den gerade gesetzten Stand mitnehmen - die geladene Kopie ist aelter.
    const stand = new Map<string, Mastery>(
      topic.learningGoal.topics.map((t) => [
        t.id,
        (t.id === id ? parsed.data.mastery : t.mastery) as Mastery,
      ]),
    );

    const result = replan(
      evaluation.studyTasks.map((task) => ({
        id: task.id,
        topicId: task.topicId,
        dueDate: task.dueDate,
        done: task.done,
        skipped: task.skipped,
      })),
      stand,
      topic.learningGoal.examDate,
    );

    await prisma.$transaction([
      ...(result.skip.length
        ? [prisma.studyTask.updateMany({ where: { id: { in: result.skip } }, data: { skipped: true } })]
        : []),
      ...(result.unskip.length
        ? [prisma.studyTask.updateMany({ where: { id: { in: result.unskip } }, data: { skipped: false } })]
        : []),
      ...result.move.map((m) =>
        prisma.studyTask.update({ where: { id: m.id }, data: { dueDate: m.dueDate } }),
      ),
    ]);

    return ok({
      id,
      mastery: parsed.data.mastery,
      entfallen: result.skip.length,
      wiederAktiv: result.unskip.length,
      verschoben: result.move.length,
    });
  });
}
