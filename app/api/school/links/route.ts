import { z } from "zod";

import { fail, fromZodError, ok, withUser } from "@/lib/api";
import { subjectSchema } from "@/lib/constants";
import { LIMITS } from "@/lib/limits";
import { canCurateLinks, isSafeUrl } from "@/lib/links";
import { addLink } from "@/lib/links-db";
import { denyIfNotAdmin } from "@/lib/school-api";

const schema = z.object({
  subject: subjectSchema,
  topic: z
    .string()
    .trim()
    .min(2, "Das Thema ist zu kurz.")
    .max(LIMITS.topicLength, "Das Thema ist zu lang."),
  title: z
    .string()
    .trim()
    .min(3, "Der Titel ist zu kurz.")
    .max(LIMITS.linkTitleLength, "Der Titel ist zu lang."),
  url: z
    .string()
    .trim()
    .max(LIMITS.linkUrlLength, "Die Adresse ist zu lang.")
    .refine(isSafeUrl, "Bitte eine vollstaendige https-Adresse angeben."),
  note: z
    .string()
    .trim()
    .max(LIMITS.descriptionLength, "Die Notiz ist zu lang.")
    .nullable()
    .optional(),
});

/** Einen gepruefen Link zu einem Thema hinterlegen. */
export async function POST(request: Request) {
  return withUser(async (user) => {
    const verboten = denyIfNotAdmin(user);
    if (verboten) return verboten;

    // Anders als bei den uebrigen Verwaltungsaufgaben steht hier eine echte
    // Erklaerung: Eine Schuelerin mit Verwaltungsrechten sieht die Liste, und
    // sie soll erfahren, warum sie nichts eintragen kann.
    if (!canCurateLinks(user)) {
      return fail(
        "Links duerfen Lehrkraefte eintragen: Wer eine Klasse auf fremde Seiten schickt, steht dafuer gerade.",
        403,
      );
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fromZodError(parsed.error);

    try {
      const link = await addLink({
        schoolId: user.schoolId,
        subject: parsed.data.subject,
        topic: parsed.data.topic,
        title: parsed.data.title,
        url: parsed.data.url,
        note: parsed.data.note ?? null,
        addedById: user.id,
      });
      return ok(link, 201);
    } catch (error) {
      // Denselben Link zweimal am selben Thema laesst die Datenbank nicht zu.
      if (error instanceof Error && error.message.includes("Unique constraint")) {
        return fail("Diesen Link gibt es zu dem Thema schon.", 409);
      }
      throw error;
    }
  });
}
