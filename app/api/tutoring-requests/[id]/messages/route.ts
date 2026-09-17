import { z } from "zod";

import { fail, fromZodError, ok, withUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { LIMITS } from "@/lib/limits";
import { canWrite } from "@/lib/messages";
import { counterpart, loadThread, markThreadRead } from "@/lib/messages-db";
import { notifyAfter } from "@/lib/push-send";

const schema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Schreib noch etwas dazu.")
    .max(LIMITS.messageLength, "Die Nachricht ist zu lang."),
});

type Nachricht = {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: Date;
};

function alsAntwort(nachrichten: Nachricht[], userId: string) {
  return nachrichten.map((m) => ({
    id: m.id,
    body: m.body,
    createdAt: m.createdAt,
    senderName: m.senderName,
    // Damit die Anzeige nicht selbst IDs vergleichen muss.
    mine: m.senderId === userId,
  }));
}

/**
 * Den Verlauf lesen. Nur die beiden Beteiligten bekommen ihn zu sehen;
 * fuer alle anderen sieht es aus, als gaebe es die Anfrage nicht.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return withUser(async (user) => {
    const { id } = await context.params;
    const thread = await loadThread(id, user.id);
    if (!thread) return fail("Diese Anfrage gibt es nicht.", 404);

    // Wer den Verlauf offen hat, hat ihn gelesen - auch beim Nachladen,
    // damit der Zaehler nicht stehen bleibt, waehrend man mitliest.
    await markThreadRead(id, user.id);

    return ok({
      status: thread.request.status,
      messages: alsAntwort(
        thread.request.messages.map((m) => ({
          id: m.id,
          senderId: m.senderId,
          senderName: m.sender.name,
          body: m.body,
          createdAt: m.createdAt,
        })),
        user.id,
      ),
    });
  });
}

/** Eine Nachricht schreiben - erlaubt erst nach einer Zusage. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return withUser(async (user) => {
    const { id } = await context.params;
    const thread = await loadThread(id, user.id);
    if (!thread) return fail("Diese Anfrage gibt es nicht.", 404);

    if (!canWrite(thread.request.status)) {
      return fail("Schreiben koennt ihr erst, wenn die Anfrage angenommen ist.", 403);
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return fromZodError(parsed.error);

    const created = await prisma.message.create({
      data: { requestId: id, senderId: user.id, body: parsed.data.body },
      include: { sender: { select: { name: true } } },
    });

    notifyAfter([counterpart(thread).id], {
      art: "nachricht",
      von: user.name,
      requestId: id,
    });

    return ok(
      {
        message: alsAntwort(
          [
            {
              id: created.id,
              senderId: created.senderId,
              senderName: created.sender.name,
              body: created.body,
              createdAt: created.createdAt,
            },
          ],
          user.id,
        )[0],
      },
      201,
    );
  });
}
