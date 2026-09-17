import { z } from "zod";

import { fail, fromZodError, ok, withUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { LIMITS } from "@/lib/limits";
import { deleteSubscription, saveSubscription } from "@/lib/push-db";

/**
 * So, wie der Browser das Abonnement liefert. Die Schluessel sind
 * base64url-Zeichenketten aus der Anmeldung - Inhalt und Laenge legt der
 * Browser fest, deshalb wird hier nur auf "vorhanden und nicht absurd lang"
 * geprueft.
 */
const schema = z.object({
  endpoint: z.string().url("Das Abonnement ist unvollstaendig.").max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});

const abmelden = z.object({ endpoint: z.string().min(1).max(1000) });

/** Dieses Geraet fuer Benachrichtigungen anmelden. */
export async function POST(request: Request) {
  return withUser(async (user) => {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fromZodError(parsed.error);

    await saveSubscription(
      user.id,
      parsed.data,
      request.headers.get("user-agent"),
    );

    // Deckel gegen aufgelaufene Altlasten: Wer sich von vielen Geraeten
    // anmeldet, behaelt die neuesten. Ohne das koennte ein Konto beliebig
    // viele Eintraege anlegen.
    const zuViele = await prisma.pushSubscription.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      skip: LIMITS.devicesPerUser,
      select: { id: true },
    });
    if (zuViele.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: { id: { in: zuViele.map((eintrag) => eintrag.id) } },
      });
    }

    return ok({ abonniert: true }, 201);
  });
}

/** Dieses Geraet wieder abmelden. */
export async function DELETE(request: Request) {
  return withUser(async (user) => {
    const parsed = abmelden.safeParse(await request.json());
    if (!parsed.success) return fromZodError(parsed.error);

    // deleteMany mit userId: Ein fremdes Abonnement laesst sich damit nicht
    // abmelden, auch wenn man seine Adresse kennt.
    const entfernt = await deleteSubscription(user.id, parsed.data.endpoint);
    if (entfernt === 0) return fail("Dieses Geraet war nicht angemeldet.", 404);

    return ok({ abonniert: false });
  });
}
