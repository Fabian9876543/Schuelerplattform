import { RequestActions } from "@/app/anfragen/request-actions";
import { Card, EmptyState, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import type { RequestStatus } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";

// Record<RequestStatus, ...> statt Record<string, ...>: Kommt ein Status dazu,
// weist der Compiler auf die fehlende Uebersetzung hin, statt sie stillschweigend
// als englischen Rohwert anzuzeigen.
const STATUS_LABEL: Record<RequestStatus, string> = {
  open: "offen",
  accepted: "angenommen",
  declined: "abgelehnt",
  withdrawn: "zurueckgezogen",
};

const STATUS_STYLE: Record<RequestStatus, string> = {
  open: "bg-amber-50 text-amber-700",
  accepted: "bg-emerald-50 text-emerald-700",
  declined: "bg-slate-100 text-slate-600",
  withdrawn: "bg-slate-100 text-slate-600",
};

function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export default async function RequestsPage() {
  const user = await requireUser();

  const [incoming, outgoing] = await Promise.all([
    prisma.tutoringRequest.findMany({
      where: { tutorOffer: { userId: user.id } },
      include: {
        requester: { select: { name: true, gradeLevel: true, email: true } },
        tutorOffer: { select: { subject: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    prisma.tutoringRequest.findMany({
      where: { requesterId: user.id },
      include: {
        tutorOffer: { select: { subject: true, user: { select: { name: true, email: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
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
                      <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                        Du hast zugesagt. Meldet euch unter{" "}
                        <a href={`mailto:${request.requester.email}`} className="font-medium underline">
                          {request.requester.email}
                        </a>{" "}
                        und macht einen Termin aus.
                      </p>
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
                      <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                        {request.tutorOffer.user.name} hat zugesagt. Schreib unter{" "}
                        <a
                          href={`mailto:${request.tutorOffer.user.email}`}
                          className="font-medium underline"
                        >
                          {request.tutorOffer.user.email}
                        </a>{" "}
                        und macht einen Termin aus.
                      </p>
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
