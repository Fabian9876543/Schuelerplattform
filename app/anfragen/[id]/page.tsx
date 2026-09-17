import Link from "next/link";
import { notFound } from "next/navigation";

import { AppointmentsPanel } from "@/app/anfragen/[id]/appointments-panel";
import { MessageThread } from "@/app/anfragen/[id]/message-thread";
import { RatingForm } from "@/app/anfragen/[id]/rating-form";
import { StatusBadge } from "@/app/anfragen/status-badge";
import { Stars } from "@/components/stars";
import { Card, PageTitle } from "@/components/ui";
import { requireStudent } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import {
  canPropose,
  formatAppointment,
  isPast,
  toLocalDateTimeValue,
} from "@/lib/appointments";
import { canWrite } from "@/lib/messages";
import { counterpart, loadThread, markThreadRead } from "@/lib/messages-db";
import { canRate } from "@/lib/ratings";

/** Warum hier nicht geschrieben werden darf - je nach Stand der Anfrage. */
const GESPERRT: Record<string, string> = {
  open: "Sobald zugesagt ist, koennt ihr euch hier schreiben.",
  declined: "Diese Anfrage wurde abgelehnt. Schreiben ist deshalb nicht moeglich.",
  withdrawn: "Diese Anfrage wurde zurueckgezogen. Schreiben ist deshalb nicht moeglich.",
};

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStudent();
  const { id } = await params;

  // loadThread gibt fuer Unbeteiligte dasselbe zurueck wie fuer eine
  // unbekannte ID. Die Seite kann also nicht verraten, dass es die Anfrage
  // gibt - wer nicht dazugehoert, sieht die normale 404-Seite.
  const thread = await loadThread(id, user.id);
  if (!thread) notFound();

  // Wer den Verlauf oeffnet, hat ihn gelesen. Das passiert beim Aufbau der
  // Seite und nicht erst beim Nachladen im Browser: Sonst bliebe der Zaehler
  // stehen, wenn jemand die Seite gleich wieder verlaesst oder das
  // JavaScript nicht durchkommt.
  await markThreadRead(id, user.id);

  const { request, role } = thread;
  const gegenueber = counterpart(thread);
  const darfSchreiben = canWrite(request.status);
  const darfBewerten = canRate(request.status, role === "requester");
  const darfPlanen = canPropose(request.status);

  // Vorschlag standardmaessig auf morgen Nachmittag - der haeufigste Fall,
  // und niemand muss sich durch den Kalender klicken.
  const jetzt = new Date();
  const vorschlagAb = new Date(jetzt);
  vorschlagAb.setDate(vorschlagAb.getDate() + 1);
  vorschlagAb.setHours(15, 0, 0, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/anfragen" className="text-sm text-slate-500 hover:text-brand-600">
          &larr; Zurueck zu den Anfragen
        </Link>
      </div>

      <PageTitle
        title={`Nachhilfe mit ${gegenueber.name}`}
        subtitle={`${request.tutorOffer.subject} · ${request.topic} · Klasse ${gegenueber.gradeLevel}`}
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-medium text-slate-900">Die Anfrage</h2>
          <StatusBadge status={request.status} />
          <span className="text-sm text-slate-500">vom {formatDate(request.createdAt)}</span>
        </div>

        <p className="mt-3 text-sm text-slate-500">
          {role === "requester" ? "Du hast geschrieben" : `${request.requester.name} hat geschrieben`}:
        </p>
        <p className="mt-1 whitespace-pre-wrap text-slate-700">{request.message}</p>

        {request.responseMessage ? (
          <>
            <p className="mt-3 text-sm text-slate-500">
              {role === "tutor" ? "Du hast geantwortet" : `${gegenueber.name} hat geantwortet`}:
            </p>
            <p className="mt-1 whitespace-pre-wrap text-slate-700">{request.responseMessage}</p>
          </>
        ) : null}
      </Card>

      {darfPlanen ? (
        <Card>
          <h2 className="mb-1 font-medium text-slate-900">Termine</h2>
          <p className="mb-3 text-sm text-slate-600">
            Wer vorschlaegt, sagt nicht selbst zu - so steht ein Termin erst, wenn beide
            einverstanden sind. Zugesagte Termine stehen in eurem Kalender.
          </p>
          <AppointmentsPanel
            requestId={request.id}
            partnerName={gegenueber.name}
            defaultStart={toLocalDateTimeValue(vorschlagAb)}
            minStart={toLocalDateTimeValue(jetzt)}
            termine={request.meetings.map((termin) => ({
              id: termin.id,
              // Auf dem Server formatiert: Im Browser haenge die Uhrzeit sonst
              // an der Zeitzone des Geraets.
              label: formatAppointment(termin),
              place: termin.place,
              status: termin.status,
              mine: termin.proposedById === user.id,
              proposerName: termin.proposedBy.name,
              past: isPast(termin.startsAt, jetzt),
            }))}
          />
        </Card>
      ) : null}

      <Card>
        <h2 className="mb-3 font-medium text-slate-900">Nachrichten</h2>

        {darfSchreiben ? null : (
          <p className="mb-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {GESPERRT[request.status]}
          </p>
        )}

        {/* key: beim Wechsel auf einen anderen Verlauf muss der Zustand neu
            beginnen, sonst stuenden kurz die Nachrichten der vorigen Anfrage da. */}
        <MessageThread
          key={request.id}
          requestId={request.id}
          canWrite={darfSchreiben}
          initial={request.messages.map((message) => ({
            id: message.id,
            body: message.body,
            createdAt: message.createdAt.toISOString(),
            senderName: message.sender.name,
            mine: message.senderId === user.id,
          }))}
        />
      </Card>

      {darfBewerten || request.rating ? (
        <Card>
          <h2 className="mb-1 font-medium text-slate-900">
            {role === "requester" ? "Deine Rueckmeldung" : "Rueckmeldung von " + gegenueber.name}
          </h2>

          {role === "requester" ? (
            <>
              <p className="mb-3 text-sm text-slate-600">
                Wie gut hat {gegenueber.name} erklaert? Das sehen andere, die spaeter nach
                Nachhilfe suchen.
              </p>
              <RatingForm
                requestId={request.id}
                tutorName={gegenueber.name}
                initialStars={request.rating?.stars ?? null}
                initialComment={request.rating?.comment ?? null}
              />
            </>
          ) : request.rating ? (
            <div className="space-y-2">
              <Stars value={request.rating.stars} />
              {request.rating.comment ? (
                <p className="whitespace-pre-wrap text-slate-700">
                  &bdquo;{request.rating.comment}&ldquo;
                </p>
              ) : (
                <p className="text-sm text-slate-500">Ohne Kommentar.</p>
              )}
              <p className="text-xs text-slate-500">
                von {gegenueber.name}, {formatDate(request.rating.updatedAt)}
              </p>
            </div>
          ) : null}
        </Card>
      ) : null}

      {darfSchreiben ? (
        <p className="text-sm text-slate-500">
          Ihr schreibt innerhalb der Plattform. E-Mail-Adressen werden dabei nicht ausgetauscht.
        </p>
      ) : null}
    </div>
  );
}
