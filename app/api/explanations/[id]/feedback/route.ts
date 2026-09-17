import { z } from "zod";

import { fail, fromZodError, ok, withUser } from "@/lib/api";
import { setHelpful } from "@/lib/explanations-db";

const schema = z.object({ helpful: z.boolean() });

/**
 * "Hat das geholfen?"
 *
 * Die Antwort gehoert zu dem Aufruf, den diese Person gemacht hat - eine
 * Rueckmeldung zu einer Erklaerung, die man nie geoeffnet hat, waere keine.
 * Zu einer regelbasierten Erklaerung gibt es keinen Eintrag und damit auch
 * nichts zu beantworten; die Oberflaeche fragt dort gar nicht erst.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return withUser(async (user) => {
    const { id } = await context.params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fromZodError(parsed.error);

    const gefunden = await setHelpful(user.id, id, parsed.data.helpful);
    if (!gefunden) return fail("Dazu gibt es nichts.", 404);

    return ok({ ok: true });
  });
}
