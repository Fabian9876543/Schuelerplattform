import { z } from "zod";

import { fail, fromZodError, ok, withUser } from "@/lib/api";
import { prisma } from "@/lib/db";

const schema = z.object({ done: z.boolean() });

/** Hakt eine Aufgabe im Lernplan ab oder nimmt das Haekchen zurueck. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return withUser(async (user) => {
    const { id } = await context.params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fromZodError(parsed.error);

    const task = await prisma.studyTask.findUnique({
      where: { id },
      include: { evaluation: { include: { assessment: { include: { learningGoal: true } } } } },
    });

    if (!task || task.evaluation.assessment.learningGoal.userId !== user.id) {
      return fail("Aufgabe nicht gefunden.", 404);
    }

    await prisma.studyTask.update({ where: { id }, data: { done: parsed.data.done } });
    return ok({ id, done: parsed.data.done });
  });
}
