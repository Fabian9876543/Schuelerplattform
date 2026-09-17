import { notFound, redirect } from "next/navigation";

import { AssessmentForm } from "@/app/lernplan/[id]/selbsttest/assessment-form";
import { PageTitle } from "@/components/ui";
import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseOptions } from "@/lib/questions";

export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStudent();
  const { id } = await params;

  const goal = await prisma.learningGoal.findUnique({
    where: { id },
    include: {
      topics: { orderBy: { position: "asc" } },
      assessments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          questions: { orderBy: { position: "asc" } },
          selfRatings: true,
          evaluation: true,
        },
      },
    },
  });

  if (!goal || goal.userId !== user.id) notFound();

  const assessment = goal.assessments[0];
  // Ohne begonnenen Test oder nach der Auswertung gehoert man auf die
  // Uebersicht - dort steht der passende naechste Schritt.
  if (!assessment || assessment.evaluation) redirect(`/lernplan/${goal.id}`);

  const ratingByTopic = new Map(assessment.selfRatings.map((r) => [r.topicId, r.confidence]));

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle
        title="Selbsttest"
        subtitle={`${goal.subject} · ${goal.title}. Beantworte, was du kannst - auch eine unvollstaendige Antwort hilft der Auswertung.`}
      />
      <AssessmentForm
        assessmentId={assessment.id}
        goalId={goal.id}
        questions={assessment.questions.map((question) => ({
          id: question.id,
          kind: question.kind === "multiple_choice" ? "multiple_choice" : "free_text",
          prompt: question.prompt,
          options: parseOptions(question.optionsJson),
          topicName: goal.topics.find((topic) => topic.id === question.topicId)?.name ?? null,
          answerText: question.answerText,
          answerIndex: question.answerIndex,
        }))}
        topics={goal.topics.map((topic) => ({
          id: topic.id,
          name: topic.name,
          confidence: ratingByTopic.get(topic.id) ?? 3,
        }))}
      />
    </div>
  );
}
