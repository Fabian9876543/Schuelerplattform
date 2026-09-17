import Link from "next/link";

import { RequestActions } from "@/app/anfragen/request-actions";
import { StatusBadge } from "@/app/anfragen/status-badge";
import { Stars } from "@/components/stars";
import { formatAppointment } from "@/lib/appointments";
import { Card, EmptyState, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { describeUnread } from "@/lib/messages";
import { unreadByRequest } from "@/lib/messages-db";

/**
 * Der Weg in den Verlauf. Frueher stand hier nach einer Zusage die
 * E-Mail-Adresse der Gegenseite - geschrieben wird jetzt in der App, damit
 * Adressen von Minderjaehrigen den Server nicht verlassen.
 */
function ThreadLink({ id, ungelesen }: { id: string; ungelesen: number }) {
  return (
    <Link
      href={`/anfragen/${id}`}
      className="mt-3 inline-flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
    >
      Nachrichten oeffnen
      {ungelesen > 0 ? (
        <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">
          {describeUnread(ungelesen)}
        </span>
      ) : null}
    </Link>
  );
}

/** Der naechste feste Termin, falls einer ausgemacht ist. */
function NextMeeting({
  termin,
}: {
  termin: { startsAt: Date; durationMinutes: number; place: string | null } | null;
}) {
  if (!termin) return null;
  return (
    <p className="mt-2 rounded-md bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800">
      Naechster Termin: {formatAppointment(termin)}
      {termin.place ? `, ${termin.place}` : ""}
    </p>
  );
}

/**
 * Was aus der Bewertung geworden ist. Wer angefragt hat, wird einmal daran
 * erinnert; wer Nachhilfe gegeben hat, sieht das Ergebnis. Ein Anmahnen in
 * die andere Richtung gibt es nicht - ob jemand bewertet, ist seine Sache.
 */
function RatingNote({ stars, role }: { stars: number | null; role: "requester" | "tutor" }) {
  if (stars !== null) {
    return (
      <div className="mt-2">
        <Stars value={stars} />
      </div>
    );
  }
  if (role !== "requester") return null;
  return (
    <p className="mt-2 text-xs text-slate-500">
      Noch nicht bewertet - deine Rueckmeldung hilft anderen bei der Suche.
    </p>
  );
}

/**
 * Nur der naechste noch bevorstehende, zugesagte Termin - mehr braucht die
 * Uebersicht nicht, und es bleibt bei einer Abfrage.
 */
const naechsterTermin = {
  where: { status: "confirmed", startsAt: { gte: new Date() } },
  orderBy: { startsAt: "asc" },
  take: 1,
  select: { id: true, startsAt: true, durationMinutes: true, place: true },
} as const;

export default async function RequestsPage() {
  const user = await requireUser();

  const [incoming, outgoing, ungelesen] = await Promise.all([
    prisma.tutoringRequest.findMany({
      where: { tutorOffer: { userId: user.id } },
      include: {
        requester: { select: { name: true, gradeLevel: true } },
        tutorOffer: { select: { subject: true } },
        rating: { select: { stars: true } },
        meetings: naechsterTermin,
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    prisma.tutoringRequest.findMany({
      where: { requesterId: user.id },
      include: {
        tutorOffer: { select: { subject: true, user: { select: { name: true } } } },
        rating: { select: { stars: true } },
        meetings: naechsterTermin,
      },
      orderBy: { createdAt: "desc" },
    }),
    unreadByRequest(user.id),
  ]);

  return (
    <div className="space-y-10">
      <section>
        <PageTitle
          title="Anfragen an dich"
          subtitle="Mitschueler, die dich um Nachhilfe gebeten haben."
        />

        {incoming.length === 0 ? (
          <EmptyState title="Noch keine Anfragen">
            Sobald jemand deine Hilfe braucht, erscheint die Anfrage hier.
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {incoming.map((request) => (
              <Card key={request.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-slate-900">
                        {request.requester.name}
                        <span className="ml-2 text-sm font-normal text-slate-500">
                          Klasse {request.requester.gradeLevel}
                        </span>
                      </h3>
                      <StatusBadge status={request.status} />
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {request.tutorOffer.subject} &middot; {request.topic} &middot;{" "}
                      {formatDate(request.createdAt)}
                    </p>
                    <p className="mt-2 text-slate-700">{request.message}</p>

                    {request.status === "accepted" ? (
                      <>
                        <NextMeeting termin={request.meetings[0] ?? null} />
                        <ThreadLink id={request.id} ungelesen={ungelesen.get(request.id) ?? 0} />
                        <RatingNote stars={request.rating?.stars ?? null} role="tutor" />
                      </>
                    ) : null}
                  </div>

                  {request.status === "open" ? (
                    <RequestActions requestId={request.id} role="tutor" />
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <PageTitle title="Deine Anfragen" subtitle="Wen du um Hilfe gebeten hast." />

        {outgoing.length === 0 ? (
          <EmptyState title="Du hast noch niemanden angefragt">
            Auf der Seite „Nachhilfe finden" kannst du nach passenden Mitschuelern suchen.
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {outgoing.map((request) => (
              <Card key={request.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-slate-900">{request.tutorOffer.user.name}</h3>
                      <StatusBadge status={request.status} />
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {request.tutorOffer.subject} &middot; {request.topic} &middot;{" "}
                      {formatDate(request.createdAt)}
                    </p>

                    {request.responseMessage ? (
                      <p className="mt-2 text-slate-700">
                        Antwort: &bdquo;{request.responseMessage}&ldquo;
                      </p>
                    ) : null}

                    {request.status === "accepted" ? (
                      <>
                        <NextMeeting termin={request.meetings[0] ?? null} />
                        <ThreadLink id={request.id} ungelesen={ungelesen.get(request.id) ?? 0} />
                        <RatingNote stars={request.rating?.stars ?? null} role="requester" />
                      </>
                    ) : null}
                  </div>

                  {request.status === "open" ? (
                    <RequestActions requestId={request.id} role="requester" />
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
