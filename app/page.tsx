import Link from "next/link";

import { Card, EmptyState, LinkButton, PageTitle } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { describeCountdown, formatDate } from "@/lib/format";
import { daysBetween } from "@/lib/planning";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) return <Welcome />;

  const [goals, openRequests] = await Promise.all([
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
            const tasks = evaluation?.studyTasks ?? [];
            const doneCount = tasks.filter((task) => task.done).length;

            return (
              <Card key={goal.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/lernplan/${goal.id}`}
                      className="text-lg font-semibold text-slate-900 hover:text-brand-600"
                    >
                      {goal.title}
                    </Link>
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
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                        {doneCount} von {tasks.length} Aufgaben erledigt
                      </span>
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
