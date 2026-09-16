import Link from "next/link";
import { notFound } from "next/navigation";

import { StartAssessment } from "@/app/lernplan/[id]/start-assessment";
import { StudyPlan } from "@/app/lernplan/[id]/study-plan";
import { Card, EmptyState, LinkButton, PageTitle, SeverityBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { describeCountdown, formatDate } from "@/lib/format";
import { daysBetween } from "@/lib/planning";

export default async function GoalPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const goal = await prisma.learningGoal.findUnique({
    where: { id },
    include: {
      topics: { orderBy: { position: "asc" } },
      assessments: {
        orderBy: { createdAt: "desc" },
        include: {
          evaluation: {
            include: {
              deficits: { include: { topic: true }, orderBy: { severity: "desc" } },
              studyTasks: { orderBy: { dueDate: "asc" }, include: { topic: true } },
            },
          },
        },
      },
    },
  });

  if (!goal || goal.userId !== user.id) notFound();

  const days = daysBetween(new Date(), goal.examDate);
  const latest = goal.assessments[0];
  const evaluation = latest?.evaluation;

  return (
    <div>
      <PageTitle
        title={goal.title}
        subtitle={`${goal.subject} · Klausur am ${formatDate(goal.examDate)} (${describeCountdown(days)})`}
      />

      <Card className="mb-6">
        <h2 className="mb-2 font-medium text-slate-900">Themen</h2>
        <div className="flex flex-wrap gap-2">
          {goal.topics.map((topic) => (
            <span
              key={topic.id}
              className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
            >
              {topic.name}
            </span>
          ))}
        </div>
      </Card>

      {!evaluation ? (
        <Card>
          <h2 className="font-medium text-slate-900">
            {latest ? "Selbsttest fortsetzen" : "Selbsttest machen"}
          </h2>
          <p className="mt-1 mb-4 text-sm text-slate-600">
            {latest
              ? "Du hast den Selbsttest schon begonnen. Mach dort weiter, wo du aufgehoert hast."
              : "Ein paar kurze Fragen zu deinen Themen. Daraus entsteht die Auswertung und dein Lernplan."}
          </p>
          {latest ? (
            <LinkButton href={`/lernplan/${goal.id}/selbsttest`}>Selbsttest fortsetzen</LinkButton>
          ) : (
            <StartAssessment goalId={goal.id} />
          )}
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex-1">
                <h2 className="font-medium text-slate-900">Auswertung</h2>
                <p className="mt-2 text-slate-700">{evaluation.summary}</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-semibold text-brand-600">{evaluation.overallScore}</div>
                <div className="text-xs text-slate-500">von 100</div>
              </div>
            </div>

            {evaluation.source === "rule" ? (
              <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Diese Auswertung wurde regelbasiert erstellt, weil kein API-Schluessel hinterlegt
                ist. Sie stuetzt sich auf deine Selbsteinschaetzung und bewertet Freitextantworten
                nicht inhaltlich.
              </p>
            ) : null}
          </Card>

          <section>
            <h2 className="mb-3 text-lg font-medium text-slate-900">
              {evaluation.deficits.length > 0 ? "Wo es noch hakt" : "Keine Luecken gefunden"}
            </h2>

            {evaluation.deficits.length === 0 ? (
              <EmptyState title="Es sieht gut aus">
                In allen Themen hast du dich sicher gezeigt. Nutze den Lernplan trotzdem zum
                Wiederholen.
              </EmptyState>
            ) : (
              <div className="space-y-3">
                {evaluation.deficits.map((deficit) => (
                  <Card key={deficit.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-slate-900">{deficit.topic.name}</h3>
                          <SeverityBadge severity={deficit.severity} />
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{deficit.explanation}</p>
                      </div>
                      <Link
                        href={`/nachhilfe?subject=${encodeURIComponent(goal.subject)}&topic=${encodeURIComponent(deficit.topic.name)}&deficit=${deficit.id}`}
                        className="rounded-md border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100"
                      >
                        Nachhilfe finden
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-medium text-slate-900">Dein Lernplan</h2>
            {evaluation.studyTasks.length === 0 ? (
              <EmptyState title="Kein Lernplan noetig">
                Es wurden keine Luecken gefunden, zu denen sich ein Plan lohnen wuerde.
              </EmptyState>
            ) : (
              <StudyPlan
                tasks={evaluation.studyTasks.map((task) => ({
                  id: task.id,
                  title: task.title,
                  description: task.description,
                  dueDate: task.dueDate.toISOString(),
                  estimatedMinutes: task.estimatedMinutes,
                  done: task.done,
                  topicName: task.topic?.name ?? null,
                }))}
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
