import { z } from "zod";

import { fail, fromZodError, ok, withUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canBlock } from "@/lib/reports";
import { canChangeRole } from "@/lib/school";
import { denyIfNotAdmin } from "@/lib/school-api";

const schema = z.object({
  isAdmin: z.boolean().optional(),
  /// Zugang sperren oder wieder freigeben - nur fuer Lehrkraefte
  blocked: z.boolean().optional(),
});

/**
 * Jemanden aus der eigenen Schule zum Verwalter machen - oder wieder nicht.
 *
 * Hier geht es nur um Rechte. Ob jemand Schueler oder Lehrkraft ist, steht
 * beim Beitritt fest und laesst sich hier nicht umstellen.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return withUser(async (user) => {
    const verboten = denyIfNotAdmin(user);
    if (verboten) return verboten;

    const { id } = await context.params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fromZodError(parsed.error);

    const ziel = await prisma.user.findUnique({
      where: { id },
      select: { id: true, schoolId: true, name: true, isAdmin: true },
    });
    if (!ziel || ziel.schoolId !== user.schoolId) {
      return fail("Dieses Konto gibt es nicht.", 404);
    }

    if (parsed.data.isAdmin !== undefined) {
      if (!canChangeRole(user.id, id)) {
        return fail(
          "Die eigene Rolle kannst du nicht aendern. Sonst stuende die Schule ohne Verwaltung da.",
          403,
        );
      }
      await prisma.user.update({ where: { id }, data: { isAdmin: parsed.data.isAdmin } });
    }

    if (parsed.data.blocked !== undefined) {
      if (!canBlock(user, ziel)) {
        return fail(
          user.kind === "teacher"
            ? "Verwalter lassen sich nicht sperren. Nimm sie erst aus der Verwaltung."
            : "Zugaenge sperren duerfen nur Lehrkraefte.",
          403,
        );
      }

      await prisma.$transaction([
        prisma.user.update({
          where: { id },
          data: parsed.data.blocked
            ? { blockedAt: new Date(), blockedById: user.id }
            : { blockedAt: null, blockedById: null },
        }),
        // Eine Sperre wirkt sofort, nicht erst beim naechsten Anmelden:
        // laufende Sitzungen werden beendet.
        ...(parsed.data.blocked ? [prisma.session.deleteMany({ where: { userId: id } })] : []),
      ]);
    }

    return ok({ id, name: ziel.name });
  });
}
