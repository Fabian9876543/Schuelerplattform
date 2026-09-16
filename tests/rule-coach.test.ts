import { describe, expect, it } from "vitest";

import { RuleCoach } from "@/lib/ai/rule-coach";
import type { AnsweredQuestion, EvaluationRequest } from "@/lib/ai/types";

const topics = [
  { id: "t1", name: "Ableitungen" },
  { id: "t2", name: "Integrale" },
];

function mcQuestion(id: string, topicId: string, answerIndex: number | null): AnsweredQuestion {
  return {
    id,
    topicId,
    kind: "multiple_choice",
    prompt: "Frage",
    options: ["a", "b", "c", "d"],
    correctIndex: 1,
    expectedPoints: null,
    answerText: null,
    answerIndex,
  };
}

function baseRequest(overrides: Partial<EvaluationRequest> = {}): EvaluationRequest {
  return {
    subject: "Mathematik",
    gradeLevel: 11,
    topics,
    questions: [],
    selfRatings: [
      { topicId: "t1", confidence: 3 },
      { topicId: "t2", confidence: 3 },
    ],
    daysUntilExam: 10,
    ...overrides,
  };
}

describe("RuleCoach.generateQuiz", () => {
  it("erfindet keine Multiple-Choice-Loesungen", async () => {
    const quiz = await new RuleCoach().generateQuiz({
      subject: "Mathematik",
      gradeLevel: 11,
      examDate: new Date("2026-04-01"),
      topics,
    });

    expect(quiz.source).toBe("rule");
    expect(quiz.questions.every((q) => q.kind === "free_text")).toBe(true);
    expect(quiz.questions.every((q) => q.correctIndex === null)).toBe(true);
  });

  it("deckt jedes Thema ab", async () => {
    const quiz = await new RuleCoach().generateQuiz({
      subject: "Mathematik",
      gradeLevel: 11,
      examDate: new Date("2026-04-01"),
      topics,
    });

    for (const topic of topics) {
      expect(quiz.questions.some((q) => q.topicId === topic.id)).toBe(true);
    }
  });
});

describe("RuleCoach.evaluate", () => {
  it("meldet ein Defizit bei niedriger Selbsteinschaetzung", async () => {
    const result = await new RuleCoach().evaluate(
      baseRequest({
        selfRatings: [
          { topicId: "t1", confidence: 1 },
          { topicId: "t2", confidence: 5 },
        ],
      }),
    );

    expect(result.source).toBe("rule");
    expect(result.deficits.map((d) => d.topicId)).toEqual(["t1"]);
    expect(result.deficits[0].severity).toBe(3);
  });

  it("meldet kein Defizit, wenn alles sicher sitzt", async () => {
    const result = await new RuleCoach().evaluate(
      baseRequest({
        selfRatings: [
          { topicId: "t1", confidence: 5 },
          { topicId: "t2", confidence: 5 },
        ],
      }),
    );

    expect(result.deficits).toEqual([]);
    expect(result.overallScore).toBe(100);
  });

  it("gewichtet falsche Antworten staerker als gutes Gefuehl", async () => {
    const result = await new RuleCoach().evaluate(
      baseRequest({
        questions: [mcQuestion("q1", "t1", 0), mcQuestion("q2", "t1", 3)],
        selfRatings: [
          { topicId: "t1", confidence: 5 },
          { topicId: "t2", confidence: 5 },
        ],
      }),
    );

    // Beide Fragen falsch trotz voller Selbstsicherheit -> trotzdem Defizit.
    expect(result.deficits.map((d) => d.topicId)).toEqual(["t1"]);
    expect(result.questionFeedback.every((f) => f.isCorrect === false)).toBe(true);
  });

  it("erkennt richtige Antworten", async () => {
    const result = await new RuleCoach().evaluate(
      baseRequest({ questions: [mcQuestion("q1", "t1", 1)] }),
    );

    expect(result.questionFeedback[0].isCorrect).toBe(true);
    expect(result.questionFeedback[0].score).toBe(100);
  });

  it("wertet eine leere Freitextantwort als Luecke", async () => {
    const result = await new RuleCoach().evaluate(
      baseRequest({
        questions: [
          {
            id: "q1",
            topicId: "t1",
            kind: "free_text",
            prompt: "Erklaere",
            options: null,
            correctIndex: null,
            expectedPoints: null,
            answerText: "",
            answerIndex: null,
          },
        ],
        selfRatings: [
          { topicId: "t1", confidence: 2 },
          { topicId: "t2", confidence: 5 },
        ],
      }),
    );

    expect(result.questionFeedback[0].score).toBe(0);
    expect(result.deficits.some((d) => d.topicId === "t1")).toBe(true);
  });

  it("erfindet keinen fachlichen Schwerpunkt", async () => {
    // Ohne Fachwissen waere ein "Schwerpunkt" nur eine Umschreibung des
    // Themennamens. Der Hinweis auf die Herkunft steht in der Oberflaeche.
    const result = await new RuleCoach().evaluate(
      baseRequest({
        selfRatings: [
          { topicId: "t1", confidence: 1 },
          { topicId: "t2", confidence: 5 },
        ],
      }),
    );
    expect(result.deficits[0].focus).toBeUndefined();
    expect(result.source).toBe("rule");
  });
});
