import { OfferForm } from "@/app/nachhilfe/anbieten/offer-form";
import { ReportDialog } from "@/components/report-dialog";
import { Stars } from "@/components/stars";
import { Card, PageTitle } from "@/components/ui";
import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { ratingSummaries, ratingsForOwnOffers } from "@/lib/ratings-db";
import { allowedSubjects } from "@/lib/school";
import { schoolSubjects } from "@/lib/school-db";

export default async function OfferPage() {
  const user = await requireStudent();

  const offers = await prisma.tutorOffer.findMany({
    where: { userId: user.id },
    include: {
      topics: true,
      _count: { select: { requests: { where: { status: "accepted" } } } },
    },
    orderBy: { subject: "asc" },
  });

  const [bewertungen, rueckmeldungen, faecherDerSchule] = await Promise.all([
    ratingSummaries(offers.map((offer) => offer.id)),
    ratingsForOwnOffers(user.id),
    schoolSubjects(user.schoolId),
  ]);
  const faecher = allowedSubjects(faecherDerSchule);

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle
        title="Nachhilfe geben"
        subtitle="Trage ein, worin du anderen helfen kannst. Du wirst dann bei passenden Luecken vorgeschlagen."
      />

      {offers.length > 0 ? (
        <div className="mb-6 space-y-3">
          <h2 className="font-medium text-slate-900">Deine Angebote</h2>
          {offers.map((offer) => (
            <Card key={offer.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium text-slate-900">
                    {offer.subject}{" "}
                    <span className="text-sm font-normal text-slate-500">
                      bis Klasse {offer.maxGradeLevel}
                    </span>
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">{offer.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {offer.topics.map((topic) => (
                      <span
                        key={topic.id}
                        className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600"
                      >
                        {topic.name}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right text-xs text-slate-500">
                  {!offer.active ? (
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5">pausiert</span>
                  ) : user.schoolRequiresApproval && !offer.approved ? (
                    // Ohne diesen Hinweis wuerde sich jemand wundern, warum
                    // ihn niemand findet.
                    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-amber-700">
                      wartet auf Freigabe
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-emerald-700">
                      aktiv
                    </span>
                  )}
                  <div className="mt-1">{offer._count.requests} mal angenommen</div>
                  {bewertungen.has(offer.id) ? (
                    <div className="mt-1 flex justify-end">
                      <Stars
                        value={bewertungen.get(offer.id)!.average}
                        count={bewertungen.get(offer.id)!.count}
                      />
                    </div>
                  ) : (
                    <div className="mt-1">noch keine Rueckmeldungen</div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {rueckmeldungen.length > 0 ? (
        <div className="mb-6 space-y-3">
          <h2 className="font-medium text-slate-900">Was Mitschueler zurueckgemeldet haben</h2>
          {rueckmeldungen.map((rueckmeldung) => (
            <Card key={rueckmeldung.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Stars value={rueckmeldung.stars} />
                <span className="text-xs text-slate-500">
                  {rueckmeldung.rater.name} &middot; {rueckmeldung.request.topic} &middot;{" "}
                  {formatDate(rueckmeldung.updatedAt)}
                </span>
              </div>
              {rueckmeldung.comment ? (
                <p className="mt-2 whitespace-pre-wrap text-slate-700">
                  &bdquo;{rueckmeldung.comment}&ldquo;
                </p>
              ) : null}
              <div className="mt-2">
                <ReportDialog
                  targetType="rating"
                  targetId={rueckmeldung.id}
                  was="Diese Bewertung"
                />
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      <Card>
        <h2 className="mb-1 font-medium text-slate-900">
          {offers.length > 0 ? "Angebot hinzufuegen oder aendern" : "Angebot anlegen"}
        </h2>
        <p className="mb-4 text-sm text-slate-600">
          Pro Fach gibt es ein Angebot. Traegst du ein Fach erneut ein, wird das bestehende Angebot
          aktualisiert.
          {user.schoolRequiresApproval ? (
            <>
              {" "}
              {user.schoolName} gibt Angebote frei, bevor sie in der Suche auftauchen - auch nach
              einer Aenderung schaut die Schule noch einmal drauf.
            </>
          ) : null}
        </p>
        <OfferForm subjects={faecher} />
      </Card>
    </div>
  );
}
