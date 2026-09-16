"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Card, ErrorNote, inputClass } from "@/components/ui";
import { CONFIDENCE_LABELS } from "@/lib/constants";

interface Question {
  id: string;
  kind: "multiple_choice" | "free_text";
  prompt: string;
  options: string[] | null;
  topicName: string | null;
  answerText: string | null;
  answerIndex: number | null;
}

interface Topic {
  id: string;
  name: string;
  confidence: number;
}

export function AssessmentForm({
  assessmentId,
  goalId,
  questions,
  topics,
}: {
  assessmentId: string;
  goalId: string;
  questions: Question[];
  topics: Topic[];
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, { text: string; index: number | null }>>(
    Object.fromEntries(
      questions.map((question) => [
        question.id,
        { text: question.answerText ?? "", index: question.answerIndex },
      ]),
    ),
  );
  const [ratings, setRatings] = useState<Record<string, number>>(
    Object.fromEntries(topics.map((topic) => [topic.id, topic.confidence])),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const response = await fetch(`/api/assessments/${assessmentId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers: questions.map((question) => ({
          questionId: question.id,
          answerText: question.kind === "free_text" ? (answers[question.id]?.text ?? "") : null,
          answerIndex: question.kind === "multiple_choice" ? (answers[question.id]?.index ?? null) : null,
        })),
        selfRatings: topics.map((topic) => ({
          topicId: topic.id,
          confidence: ratings[topic.id] ?? 3,
        })),
      }),
    });

    const body = await response.json().catch(() => ({ error: "Die Auswertung ist fehlgeschlagen." }));
    if (!response.ok) {
      setError(body.error ?? "Die Auswertung ist fehlgeschlagen.");
      setPending(false);
      return;
    }

    router.push(`/lernplan/${goalId}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="space-y-4">
        <h2 className="text-lg font-medium text-slate-900">Fragen</h2>

        {questions.map((question, index) => (
          <Card key={question.id}>
            <div className="mb-3">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Frage {index + 1}
                {question.topicName ? ` · ${question.topicName}` : ""}
              </span>
              <p className="mt-1 font-medium text-slate-900">{question.prompt}</p>
            </div>

            {question.kind === "multiple_choice" && question.options ? (
              <div className="space-y-2">
                {question.options.map((option, optionIndex) => (
                  <label
                    key={optionIndex}
                    className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 px-3 py-2 hover:bg-slate-50"
                  >
                    <input
                      type="radio"
                      name={question.id}
                      checked={answers[question.id]?.index === optionIndex}
                      onChange={() =>
                        setAnswers((current) => ({
                          ...current,
                          [question.id]: { text: "", index: optionIndex },
                        }))
                      }
                      className="mt-1 accent-indigo-600"
                    />
                    <span className="text-slate-700">{option}</span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                rows={4}
                value={answers[question.id]?.text ?? ""}
                onChange={(event) =>
                  setAnswers((current) => ({
                    ...current,
                    [question.id]: { text: event.target.value, index: null },
                  }))
                }
                placeholder="Deine Antwort ..."
                className={inputClass}
              />
            )}
          </Card>
        ))}
      </section>

      <section>
        <h2 className="text-lg font-medium text-slate-900">Wie sicher fuehlst du dich?</h2>
        <p className="mb-3 text-sm text-slate-600">
          Deine eigene Einschaetzung zaehlt genauso wie die Antworten oben.
        </p>

        <Card className="space-y-5">
          {topics.map((topic) => (
            <div key={topic.id}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-slate-800">{topic.name}</span>
                <span className="text-sm text-slate-500">
                  {CONFIDENCE_LABELS[ratings[topic.id] ?? 3]}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={ratings[topic.id] ?? 3}
                onChange={(event) =>
                  setRatings((current) => ({ ...current, [topic.id]: Number(event.target.value) }))
                }
                className="w-full accent-indigo-600"
              />
            </div>
          ))}
        </Card>
      </section>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Wird ausgewertet ..." : "Auswerten und Lernplan erstellen"}
        </Button>
        {pending ? <span className="text-sm text-slate-500">Das dauert einen Moment.</span> : null}
      </div>
    </form>
  );
}
