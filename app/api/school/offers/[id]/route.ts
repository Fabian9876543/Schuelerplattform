import { z } from "zod";

import { fail, fromZodError, ok, withUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { denyIfNotAdmin } from "@/lib/school-api";

const schema = z.object({ approved: z.boolean() });

/** Ein Nachhilfe-Angebot der eigenen Schule freigeben oder sperren. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return withUser(async (user) => {
    const verboten = denyIfNotAdmin(user);
    if (verboten) return verboten;

    const { id } = await context.params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fromZodError(parsed.error);

    const offer = await prisma.tutorOffer.findUnique({
      where: { id },
      include: { user: { select: { schoolId: true } } },
    });
    // Ein Verwalter verwaltet seine eigene Schule. Ein Angebot von woanders
    // sieht fuer ihn aus wie keines.
    if (!offer || offer.user.schoolId !== user.schoolId) {
      return fail("Dieses Angebot gibt es nicht.", 404);
    }

    await prisma.tutorOffer.update({
      where: { id },
      data: {
        approved: parsed.data.approved,
        approvedAt: parsed.data.approved ? new Date() : null,
        approvedById: parsed.data.approved ? user.id : null,
      },
    });

    return ok({ id, approved: parsed.data.approved });
  });
}
