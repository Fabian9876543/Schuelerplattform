import { z } from "zod";

import { fromZodError, ok, withUser } from "@/lib/api";
import { SUBJECTS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { denyIfNotAdmin } from "@/lib/school-api";

const schema = z.object({
  requiresApproval: z.boolean().optional(),
  /** Die zugelassenen Faecher; leere Liste heisst "alle" */
  subjects: z.array(z.enum(SUBJECTS)).max(SUBJECTS.length).optional(),
});

/** Einstellungen der eigenen Schule aendern. */
export async function PATCH(request: Request) {
  return withUser(async (user) => {
    const verboten = denyIfNotAdmin(user);
    if (verboten) return verboten;

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fromZodError(parsed.error);

    if (parsed.data.requiresApproval !== undefined) {
      await prisma.school.update({
        where: { id: user.schoolId },
        data: { requiresApproval: parsed.data.requiresApproval },
      });
    }

    if (parsed.data.subjects) {
      // Die Liste wird ersetzt, nicht ergaenzt: Auf dem Bildschirm steht der
      // gewuenschte Endzustand, und genau der soll herauskommen.
      const gewuenscht = [...new Set(parsed.data.subjects)];
      await prisma.$transaction([
        prisma.schoolSubject.deleteMany({ where: { schoolId: user.schoolId } }),
        prisma.schoolSubject.createMany({
          data: gewuenscht.map((subject) => ({ schoolId: user.schoolId, subject })),
        }),
      ]);
    }

    return ok({ ok: true });
  });
}
