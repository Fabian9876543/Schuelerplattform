import { z } from "zod";

import { getCoach, hasApiKey } from "@/lib/ai";
import { fail, fromZodError, ok, withUser } from "@/lib/api";
import { subjectSchema } from "@/lib/constants";
import { findExplanation, recordView, storeExplanation } from "@/lib/explanations-db";
import { LIMITS } from "@/lib/limits";
import { explanationsGeneratedToday } from "@/lib/limits-db";
import { hostOf, searchUrl, SEARCH_HINT } from "@/lib/links";
import { linksForTopic } from "@/lib/links-db";
import { studentOrDeny } from "@/lib/school-api";

const schema = z.object({
  subject: subjectSchema,
  topic: z
    .string()
    .trim()
    .min(2, "Das Thema ist zu kurz.")
    .max(LIMITS.topicLength, "Das Thema ist zu lang."),
});

/**
 * Erklaert ein Thema - die Stufe vor der Nachhilfe.
 *
 * Erst wird im Zwischenspeicher nachgesehen: Dieselbe Frage in derselben
 * Klassenstufe ist fuer alle dieselbe Frage. Erst wenn dort nichts liegt, wird
 * die KI bemueht - und nur dann zaehlt es gegen das Tageskontingent.
 *
 * Dazu kommen die Links, die Lehrkraefte dieser Schule zum Thema hinterlegt
 * haben. Hat niemand etwas hinterlegt, gibt es eine vorbereitete Suche mit dem
 * Hinweis, dass die niemand geprueft hat - ein erfundener Video-Link waere das
 * Gegenteil von Hilfe.
 */
export async function POST(request: Request) {
  return withUser(async (user) => {
    const { deny, student } = studentOrDeny(user);
    if (deny) return deny;

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fromZodError(parsed.error);
    const { subject, topic } = parsed.data;

    const links = await linksForTopic(student.schoolId, subject, topic);
    const zubehoer = {
      links: links.map((link) => ({
        id: link.id,
        title: link.title,
        url: link.url,
        host: hostOf(link.url),
        note: link.note,
        topic: link.topic,
      })),
      // Die Suche nur anbieten, wenn die Schule nichts Geprueftes hat -
      // sonst stuende der ungeprueste Weg neben dem geprueften.
      search: links.length === 0 ? { url: searchUrl(subject, topic), hint: SEARCH_HINT } : null,
    };

    const vorhanden = await findExplanation(subject, topic, student.gradeLevel);
    if (vorhanden) {
      await recordView(student.id, vorhanden.id, false);
      return ok({ explanationId: vorhanden.id, source: "ai", body: vorhanden.body, ...zubehoer });
    }

    // Die Grenze schuetzt bares Geld. Ohne Schluessel entsteht keines, dann
    // waere sie nur eine Schikane.
    if (hasApiKey() && (await explanationsGeneratedToday(student.id)) >= LIMITS.explanationsPerDay) {
      return fail(
        `Du hast heute schon ${LIMITS.explanationsPerDay} Erklaerungen angefordert. Schon erklaerte Themen kannst du weiter aufschlagen - neue gibt es morgen wieder.`,
        429,
      );
    }

    const erklaerung = await getCoach().explain({
      subject,
      topic,
      gradeLevel: student.gradeLevel,
    });

    // Nur was die KI geschrieben hat, wandert in den Zwischenspeicher. Die
    // Rueckfallebene entsteht jedes Mal neu - sonst bliebe sie liegen, auch
    // wenn spaeter ein Schluessel hinterlegt wird.
    if (erklaerung.source === "rule") {
      return ok({ explanationId: null, source: "rule", body: erklaerung.body, ...zubehoer });
    }

    const gespeichert = await storeExplanation(subject, topic, student.gradeLevel, erklaerung.body);
    await recordView(student.id, gespeichert.id, true);

    return ok({
      explanationId: gespeichert.id,
      source: "ai",
      body: gespeichert.body,
      ...zubehoer,
    });
  });
}
