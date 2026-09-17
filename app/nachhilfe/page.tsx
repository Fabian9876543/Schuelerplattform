import { RequestDialog } from "@/app/nachhilfe/request-dialog";
import { Stars } from "@/components/stars";
import { Card, EmptyState, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { SUBJECTS } from "@/lib/constants";
import { allowedSubjects } from "@/lib/school";
import { schoolSubjects } from "@/lib/school-db";
import { prisma } from "@/lib/db";
import { searchTutors } from "@/lib/tutors";

export default async function TutorSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; topic?: string; deficit?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  // Zur Auswahl steht, was die Schule fuehrt - ohne eigene Liste alle Faecher.
  const faecher = allowedSubjects(await schoolSubjects(user.schoolId));
  const subject = params.subject && SUBJECTS.includes(params.subject as never) ? params.subject : "";
  const topic = params.topic ?? "";

  // Das Defizit wird nur verknuepft, wenn es wirklich zur eigenen Auswertung
  // gehoert - sonst koennte man ueber die URL fremde Auswertungen anhaengen.
  let deficitId: string | null = null;
  if (params.deficit) {
    const deficit = await prisma.deficit.findUnique({
      where: { id: params.deficit },
      include: { evaluation: { include: { assessment: { include: { learningGoal: true } } } } },
    });
    if (deficit && deficit.evaluation.assessment.learningGoal.userId === user.id) {
      deficitId = deficit.id;
    }
  }

  const matches = subject
    ? await searchTutors({
        subject,
        topic: topic || undefined,
        gradeLevel: user.gradeLevel,
        excludeUserId: user.id,
        schoolId: user.schoolId,
        requiresApproval: user.schoolRequiresApproval,
      })
    : [];

  return (
    <div>
      <PageTitle
        title="Nachhilfe finden"
        subtitle="Suche Mitschueler, die dir in einem bestimmten Thema weiterhelfen."
      />

      <Card className="mb-6">
        <form method="get" className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Fach</span>
            <select
              name="subject"
              defaultValue={subject}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-brand-500"
            >
              <option value="">Bitte waehlen</option>
              {faecher.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Thema</span>
            <input
              name="topic"
              defaultValue={topic}
              placeholder="z. B. Kurvendiskussion"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-brand-500"
            />
          </label>

          {deficitId ? <input type="hidden" name="deficit" value={deficitId} /> : null}

          <button
            type="submit"
            className="rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700"
          >
            Suchen
          </button>
        </form>
      </Card>

      {!subject ? (
        <EmptyState title="Waehle zuerst ein Fach">
          Du kannst zusaetzlich ein Thema angeben - dann werden passende Angebote nach oben sortiert.
        </EmptyState>
      ) : matches.length === 0 ? (
        <EmptyState title="Noch niemand bietet hier Nachhilfe an">
          In {subject} bietet an deiner Schule ({user.schoolName}) gerade niemand Nachhilfe an.
          Gesucht wird nur innerhalb deiner Schule - das ist Absicht.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            {matches.length} {matches.length === 1 ? "Angebot" : "Angebote"} gefunden
            {topic ? `, die besten Treffer zu „${topic}" zuerst` : ""}.
          </p>

          {matches.map((match) => (
            <Card key={match.candidate.offerId}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h3 className="font-medium text-slate-900">{match.candidate.userName}</h3>
                    {match.candidate.rating ? (
                      <Stars
                        value={match.candidate.rating.average}
                        count={match.candidate.rating.count}
                      />
                    ) : (
                      // "noch nicht bewertet" ist etwas anderes als "schlecht
                      // bewertet" - deshalb steht es da, statt einfach zu fehlen.
                      <span className="text-xs text-slate-500">noch keine Rueckmeldungen</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{match.candidate.description}</p>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {match.candidate.topics.map((candidateTopic) => (
                      <span
                        key={candidateTopic.normalized}
                        className={`rounded-full px-2.5 py-0.5 text-xs ${
                          match.matchedTopics.includes(candidateTopic.name)
                            ? "bg-brand-100 font-medium text-brand-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {candidateTopic.name}
                      </span>
                    ))}
                  </div>

                  <ul className="mt-2 text-xs text-slate-500">
                    {match.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>

                <RequestDialog
                  offerId={match.candidate.offerId}
                  tutorName={match.candidate.userName}
                  topic={topic}
                  deficitId={deficitId}
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
