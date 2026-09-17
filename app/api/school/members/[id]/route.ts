import { z } from "zod";

import { fail, fromZodError, ok, withUser } from "@/lib/api";
import { userRoleSchema } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { canChangeRole } from "@/lib/school";
import { denyIfNotAdmin } from "@/lib/school-api";

const schema = z.object({ role: userRoleSchema });

/** Jemanden aus der eigenen Schule zum Verwalter machen - oder wieder nicht. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return withUser(async (user) => {
    const verboten = denyIfNotAdmin(user);
    if (verboten) return verboten;

    const { id } = await context.params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fromZodError(parsed.error);

    if (!canChangeRole(user.id, id)) {
      return fail(
        "Die eigene Rolle kannst du nicht aendern. Sonst stuende die Schule ohne Verwaltung da.",
        403,
      );
    }

    const ziel = await prisma.user.findUnique({
      where: { id },
      select: { id: true, schoolId: true, name: true },
    });
    if (!ziel || ziel.schoolId !== user.schoolId) {
      return fail("Dieses Konto gibt es nicht.", 404);
    }

    await prisma.user.update({ where: { id }, data: { role: parsed.data.role } });
    return ok({ id, role: parsed.data.role, name: ziel.name });
  });
}
