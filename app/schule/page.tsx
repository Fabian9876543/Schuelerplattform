import {
  ApprovalToggle,
  BlockButton,
  MemberRole,
  OfferApproval,
  ReportActions,
  SubjectPicker,
} from "@/app/schule/school-controls";
import { Card, PageTitle } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { canBlockAccounts, describeReason, describeTarget } from "@/lib/reports";
import { describeGrade } from "@/lib/school";
import { schoolOverview } from "@/lib/school-db";

/**
 * Die Verwaltungsseite einer Schule.
 *
 * Erreichbar nur fuer Verwalter der eigenen Schule - wer das nicht ist,
 * bekommt 404 statt einer Meldung. Die Seite kann Freigaben, Faecher und
 * weitere Verwalter regeln; sie zeigt bewusst **keine** Inhalte: keine
 * Nachrichten, keine Bewertungen, keine Auswertungen. Wer verwaltet, soll
 * nicht mitlesen.
 */
export default async function SchoolPage() {
  const user = await requireAdmin();
  const { school, members, offers, faecher, reports, anfragen, termine } = await schoolOverview(
    user.schoolId,
  );

  const offen = offers.filter((offer) => !offer.approved);
  const freigegeben = offers.filter((offer) => offer.approved);
  const offeneMeldungen = reports.filter((report) => report.status === "open");
  // Sperren duerfen nur Lehrkraefte - eine Schuelerin mit Verwaltungsrechten
  // sieht den Knopf gar nicht erst.
  const darfSperren = canBlockAccounts(user);

  return (
    <div className="space-y-6">
      <PageTitle
        title={school.name}
        subtitle="Was an dieser Schule laeuft - und was ihr freigebt."
      />

      <Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Zahl wert={members.length} was="Konten" />
          <Zahl wert={offers.length} was="Nachhilfe-Angebote" />
          <Zahl wert={anfragen} was="Anfragen" />
          <Zahl wert={termine} was="feste Termine" />
        </div>
        <p className="mt-4 text-sm text-slate-600">
          Beitrittscode fuer Schueler:{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5">{school.joinCode}</code>
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Beitrittscode fuer Lehrkraefte:{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5">{school.teacherJoinCode}</code>{" "}
          &ndash; damit entsteht ein Konto ohne Klassenstufe, das an der Nachhilfe nicht
          teilnimmt. Gib ihn nur im Kollegium weiter.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Diese Seite zeigt keine Nachrichten, keine Bewertungen und keine Selbsttests. Verwalten
          heisst nicht mitlesen.
        </p>
      </Card>

      <Card>
        <h2 className="mb-3 font-medium text-slate-900">Freigabe</h2>
        <ApprovalToggle requiresApproval={school.requiresApproval} />
      </Card>

      <section>
        <h2 className="mb-3 font-medium text-slate-900">
          Nachhilfe-Angebote
          {offen.length > 0 ? (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              {offen.length} ohne Freigabe
            </span>
          ) : null}
        </h2>

        {offers.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500">Noch bietet niemand Nachhilfe an.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {[...offen, ...freigegeben].map((offer) => (
              <Card key={offer.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-slate-900">
                        {offer.user.name}
                        <span className="ml-2 text-sm font-normal text-slate-500">
                          {describeGrade(offer.user)}
                        </span>
                      </h3>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">
                        {offer.subject} bis Klasse {offer.maxGradeLevel}
                      </span>
                      {!offer.active ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                          pausiert
                        </span>
                      ) : offer.approved ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-700">
                          freigegeben
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs text-amber-700">
                          wartet auf Freigabe
                        </span>
                      )}
                    </div>

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

                    {offer.approved && offer.approvedAt ? (
                      <p className="mt-2 text-xs text-slate-500">
                        Freigegeben am {formatDate(offer.approvedAt)}
                        {offer.approvedBy ? ` von ${offer.approvedBy.name}` : ""}
                      </p>
                    ) : null}
                  </div>

                  <OfferApproval offerId={offer.id} approved={offer.approved} />
                </div>
              </Card>
            ))}
          </div>
        )}

        {!school.requiresApproval && offen.length > 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Solange die Freigabe oben ausgeschaltet ist, sind auch die noch nicht freigegebenen
            Angebote in der Suche zu sehen.
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="mb-1 font-medium text-slate-900">
          Meldungen
          {offeneMeldungen.length > 0 ? (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              {offeneMeldungen.length} offen
            </span>
          ) : null}
        </h2>
        <p className="mb-3 text-sm text-slate-600">
          Gemeldet wird immer ein einzelner Inhalt. Ihr seht den Wortlaut zum Zeitpunkt der
          Meldung - nicht den Verlauf drumherum.
        </p>

        {reports.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500">Es liegt nichts vor.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <Card key={report.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">
                    {describeTarget(report.targetType)}
                  </span>
                  <span className="text-sm font-medium text-slate-800">
                    {describeReason(report.reason)}
                  </span>
                  {report.status === "open" ? (
                    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs text-amber-700">
                      offen
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                      {report.status === "resolved" ? "erledigt" : "unbegruendet"}
                    </span>
                  )}
                  <span className="text-xs text-slate-500">{formatDate(report.createdAt)}</span>
                </div>

                <p className="mt-2 text-sm text-slate-500">
                  von {report.author.name}, gemeldet von {report.reporter.name}
                </p>

                <blockquote className="mt-2 whitespace-pre-wrap rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-800">
                  {report.snapshot}
                </blockquote>

                {report.note ? (
                  <p className="mt-2 text-sm text-slate-700">
                    Dazu geschrieben: &bdquo;{report.note}&ldquo;
                  </p>
                ) : null}

                {report.status === "open" ? (
                  <ReportActions reportId={report.id} />
                ) : (
                  <p className="mt-2 text-xs text-slate-500">
                    {report.handledBy ? `Bearbeitet von ${report.handledBy.name}` : "Bearbeitet"}
                    {report.handledAt ? ` am ${formatDate(report.handledAt)}` : ""}
                    {report.resolution ? `: ${report.resolution}` : ""}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <Card>
        <h2 className="mb-1 font-medium text-slate-900">Faecher</h2>
        <p className="mb-3 text-sm text-slate-600">
          Welche Faecher darf man an eurer Schule anbieten und suchen? Ohne Auswahl sind alle
          erlaubt.
        </p>
        <SubjectPicker gewaehlt={faecher} />
      </Card>

      <section>
        <h2 className="mb-3 font-medium text-slate-900">Konten</h2>
        <div className="space-y-2">
          {members.map((member) => (
            <Card key={member.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">
                    {member.name}
                    {member.isAdmin ? (
                      <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                        Verwaltung
                      </span>
                    ) : null}
                    {member.blockedAt ? (
                      <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                        gesperrt
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm text-slate-500">
                    {describeGrade(member)} &middot; {member.email} &middot; dabei seit{" "}
                    {formatDate(member.createdAt)}
                    {member._count.tutorOffers > 0
                      ? ` · ${member._count.tutorOffers} ${member._count.tutorOffers === 1 ? "Angebot" : "Angebote"}`
                      : ""}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {darfSperren && member.id !== user.id && !member.isAdmin ? (
                    <BlockButton
                      userId={member.id}
                      name={member.name}
                      blocked={member.blockedAt !== null}
                    />
                  ) : null}
                  <MemberRole
                    userId={member.id}
                    isAdmin={member.isAdmin}
                    name={member.name}
                    self={member.id === user.id}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function Zahl({ wert, was }: { wert: number; was: string }) {
  return (
    <div>
      <p className="text-2xl font-semibold text-slate-900">{wert}</p>
      <p className="text-sm text-slate-600">{was}</p>
    </div>
  );
}
