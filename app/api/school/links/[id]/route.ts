import { fail, ok, withUser } from "@/lib/api";
import { canCurateLinks } from "@/lib/links";
import { removeLink } from "@/lib/links-db";
import { denyIfNotAdmin } from "@/lib/school-api";

/** Einen Link der eigenen Schule entfernen. */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  return withUser(async (user) => {
    const verboten = denyIfNotAdmin(user);
    if (verboten) return verboten;

    if (!canCurateLinks(user)) {
      return fail("Links duerfen Lehrkraefte pflegen.", 403);
    }

    const { id } = await context.params;
    // Die Schul-ID steckt in der Loeschbedingung: Ein Link einer anderen
    // Schule bekommt dieselbe Antwort wie ein bereits geloeschter.
    const weg = await removeLink(user.schoolId, id);
    if (!weg) return fail("Diesen Link gibt es nicht mehr.", 404);

    return ok({ ok: true });
  });
}
