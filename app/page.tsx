import Link from "next/link";

import { PushToggle } from "@/components/push-toggle";
import { Card, EmptyState, LinkButton, PageTitle } from "@/components/ui";
import { getCurrentUser, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { describeCountdown, formatDate } from "@/lib/format";
import { daysBetween, progressPercent, type Mastery } from "@/lib/planning";
import { hasSubscription } from "@/lib/push-db";
import { publicKey } from "@/lib/push-send";
import { takesPartInTutoring } from "@/lib/school";

/** Ampelfarbe zum Fortschritt - die drei Stufen aus dem Entwurf. */
function ampel(prozent: number): { punkt: string; text: string } {
  if (prozent >= 75) return { punkt: "bg-emerald-500", text: "text-emerald-700" };
  if (prozent >= 40) return { punkt: "bg-amber-500", text: "text-amber-700" };
  return { punkt: "bg-red-500", text: "text-red-700" };
}

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) return <Welcome />;
  // Lehrkraefte haben keine Klausuren - fuer sie ist die Startseite eine
  // andere. Eine leere Klausurliste waere kein Zustand, sondern ein Irrtum.
  if (!takesPartInTutoring(user.kind)) {
    return <TeacherHome user={user} abonniert={await hasSubscription(user.id)} />;
  }

  const [goals, openRequests, abonniert] = await Promise.all([
    prisma.learningGoal.findMany({
      where: { userId: user.id },
      orderBy: { examDate: "asc" },
      include: {
        topics: true,
        assessments: {
          orderBy: { createdAt: "desc" },
          include: { evaluation: { include: { studyTasks: true } } },
        },
      },
    }),
    prisma.tutoringRequest.count({
      where: { status: "open", tutorOffer: { userId: user.id } },
    }),
    hasSubscription(user.id),
  ]);

  const today = new Date();

  return (
    <div>
      <PageTitle
        title={`Hallo ${user.name}`}
        subtitle="Deine anstehenden Klausuren und was noch zu tun ist."
      />

      {openRequests > 0 ? (
        <div className="mb-6 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700">
          Du hast {openRequests} offene Nachhilfe-{openRequests === 1 ? "Anfrage" : "Anfragen"}.{" "}
          <Link href="/anfragen" className="font-medium underline">
            Jetzt ansehen
          </Link>
        </div>
      ) : null}

      <div className="mb-6">
        <LinkButton href="/lernplan/neu">Klausur eintragen</LinkButton>
      </div>

      {goals.length === 0 ? (
        <EmptyState title="Noch keine Klausur eingetragen">
          Trage deine naechste Klausur ein - danach bekommst du einen Selbsttest und daraus einen
          Lernplan.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => {
            const days = daysBetween(today, goal.examDate);
            const latest = goal.assessments[0];
            const evaluation = latest?.evaluation;
            const tasks = (evaluation?.studyTasks ?? []).filter((task) => !task.skipped);
            const doneCount = tasks.filter((task) => task.done).length;
            const fortschritt = progressPercent(goal.topics.map((t) => t.mastery as Mastery));
            const farbe = ampel(fortschritt);

            return (
              <Card key={goal.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      {evaluation ? (
                        <span
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${farbe.punkt}`}
                          aria-hidden="true"
                        />
                      ) : null}
                      <Link
                        href={`/lernplan/${goal.id}`}
                        className="text-lg font-semibold text-slate-900 hover:text-brand-600"
                      >
                        {goal.title}
                      </Link>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {goal.subject} &middot; {formatDate(goal.examDate)} ({describeCountdown(days)})
                    </p>
                  </div>

                  <div className="text-right text-sm">
                    {!latest ? (
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
                        Selbsttest steht aus
                      </span>
                    ) : !evaluation ? (
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
                        Selbsttest begonnen
                      </span>
                    ) : (
                      <div>
                        <span className={`font-medium ${farbe.text}`}>{fortschritt} % geschafft</span>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {doneCount} von {tasks.length} Aufgaben erledigt
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <p className="mt-3 text-sm text-slate-500">
                  Themen: {goal.topics.map((topic) => topic.name).join(", ")}
                </p>
              </Card>
            );
          })}
        </div>
      )}

      <div className="mt-6">
        <PushToggle publicKey={publicKey()} abonniert={abonniert} />
      </div>
    </div>
  );
}

/**
 * Die Startseite eines Lehrerkontos. Sie zeigt, was die Plattform tut und
 * wo es fuer diese Lehrkraft weitergeht - und sagt klar, was sie hier nicht
 * kann und nicht sieht.
 */
function TeacherHome({ user, abonniert }: { user: SessionUser; abonniert: boolean }) {
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle
        title={`Hallo ${user.name}`}
        subtitle={`Dein Lehrerzugang fuer ${user.schoolName}.`}
      />

      {user.isAdmin ? (
        <Card className="mb-4">
          <h2 className="font-medium text-slate-900">Verwaltung</h2>
          <p className="mt-1 text-sm text-slate-600">
            Du gibst Nachhilfe-Angebote frei, legst die Faecher fest und bestimmst, wer
            mitverwaltet.
          </p>
          <div className="mt-4">
            <LinkButton href="/schule">Zur Schulverwaltung</LinkButton>
          </div>
        </Card>
      ) : (
        <Card className="mb-4">
          <h2 className="font-medium text-slate-900">Noch keine Verwaltungsrechte</h2>
          <p className="mt-1 text-sm text-slate-600">
            Dein Konto gehoert zu {user.schoolName}, verwaltet die Schule aber nicht. Wer das
            bereits tut, kann dir die Rechte geben.
          </p>
        </Card>
      )}

      {user.isAdmin ? (
        <div className="mb-4">
          <PushToggle publicKey={publicKey()} abonniert={abonniert} />
        </div>
      ) : null}

      <Card>
        <h2 className="font-medium text-slate-900">Was hier passiert</h2>
        <p className="mt-1 text-sm text-slate-600">
          Schuelerinnen und Schueler tragen ihre Klausuren ein, machen einen kurzen Selbsttest
          und bekommen daraus einen Lernplan. Wo Luecken bleiben, suchen sie sich Nachhilfe bei
          Mitschuelern derselben Schule.
        </p>
        <p className="mt-3 text-sm text-slate-500">
          Dein Zugang nimmt daran nicht teil: keine eigenen Klausuren, keine Angebote, keine
          Anfragen. Und du siehst weder Nachrichten noch Bewertungen oder Selbsttests - auch
          nicht mit Verwaltungsrechten.
        </p>
      </Card>
    </div>
  );
}

function Welcome() {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h1 className="text-3xl font-semibold text-slate-900">
        Lerne gezielt auf deine naechste Klausur
      </h1>
      <p className="mt-3 text-slate-600">
        Trage Datum, Fach und Themen ein, mach einen kurzen Selbsttest und bekomme eine Auswertung
        mit passendem Lernplan. Wo es noch hakt, findest du Mitschueler, die dir in genau dem Thema
        weiterhelfen.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <LinkButton href="/register">Konto anlegen</LinkButton>
        <LinkButton href="/login" variant="secondary">
          Anmelden
        </LinkButton>
      </div>
    </div>
  );
}
