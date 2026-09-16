import { z } from "zod";

/**
 * Vertrag zwischen der App und der Auswertungs-Intelligenz.
 *
 * Es gibt zwei Implementierungen: ClaudeCoach (echte KI) und RuleCoach
 * (regelbasiert, ohne API-Schluessel). lib/ai/index.ts waehlt aus.
 *
 * Die Schemas dienen doppelt: Sie erzwingen das Ausgabeformat der KI
 * (ueber zodOutputFormat) und validieren anschliessend die Daten, bevor sie
 * in die Datenbank gehen.
 */

// --- Eingaben ---------------------------------------------------------------

export interface TopicInput {
  id: string;
  name: string;
}

export interface QuizRequest {
  subject: string;
  gradeLevel: number;
  examDate: Date;
  topics: TopicInput[];
}

export interface AnsweredQuestion {
  id: string;
  topicId: string | null;
  kind: "multiple_choice" | "free_text";
  prompt: string;
  options: string[] | null;
  correctIndex: number | null;
  expectedPoints: string | null;
  answerText: string | null;
  answerIndex: number | null;
}

export interface EvaluationRequest {
  subject: string;
  gradeLevel: number;
  topics: TopicInput[];
  questions: AnsweredQuestion[];
  /** Selbsteinschaetzung pro Thema, 1 (unsicher) bis 5 (sicher) */
  selfRatings: { topicId: string; confidence: number }[];
  daysUntilExam: number;
}

// --- Ausgabe der KI ---------------------------------------------------------

/**
 * Die KI bekommt die Themen als nummerierte Liste und antwortet mit deren
 * Index. So muss sie keine Datenbank-IDs abschreiben, was eine haeufige
 * Fehlerquelle waere.
 */
export const generatedQuestionSchema = z.object({
  topicIndex: z.number().int().min(0).describe("Index des Teilthemas aus der vorgegebenen Liste"),
  kind: z.enum(["multiple_choice", "free_text"]),
  prompt: z.string().min(5).describe("Die Frage, direkt an die Schuelerin oder den Schueler gerichtet"),
  options: z
    .array(z.string())
    .nullable()
    .describe("Genau 4 Antwortmoeglichkeiten bei multiple_choice, sonst null"),
  correctIndex: z
    .number()
    .int()
    .nullable()
    .describe("Index der richtigen Antwort bei multiple_choice, sonst null"),
  expectedPoints: z
    .string()
    .nullable()
    .describe("Bei free_text: worauf es in einer guten Antwort ankommt. Sonst null."),
});

export const quizSchema = z.object({
  questions: z.array(generatedQuestionSchema).min(1),
});

export type GeneratedQuiz = z.infer<typeof quizSchema>;
export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;

export const evaluationResultSchema = z.object({
  summary: z
    .string()
    .describe("2 bis 4 Saetze Rueckmeldung, direkt an die Schuelerin oder den Schueler gerichtet, auf Deutsch"),
  overallScore: z.number().int().min(0).max(100),
  questionFeedback: z.array(
    z.object({
      questionIndex: z.number().int().min(0),
      score: z.number().int().min(0).max(100),
      feedback: z.string().describe("Ein bis zwei Saetze zur Antwort"),
    }),
  ),
  deficits: z.array(
    z.object({
      topicIndex: z.number().int().min(0),
      severity: z.number().int().min(1).max(3).describe("1 = leicht, 2 = deutlich, 3 = gravierend"),
      explanation: z.string().describe("Woran genau es hakt, ein bis zwei Saetze"),
      focus: z
        .string()
        .describe("Was konkret geuebt werden sollte - wird im Lernplan als Aufgabe angezeigt"),
    }),
  ),
});

export type EvaluationResult = z.infer<typeof evaluationResultSchema>;

// --- Was die App zurueckbekommt --------------------------------------------

export interface CoachEvaluation {
  summary: string;
  overallScore: number;
  source: "ai" | "rule";
  questionFeedback: { questionId: string; score: number; feedback: string; isCorrect: boolean | null }[];
  deficits: { topicId: string; severity: number; explanation: string; focus?: string }[];
}

export interface CoachQuiz {
  source: "ai" | "rule";
  questions: {
    topicId: string | null;
    kind: "multiple_choice" | "free_text";
    prompt: string;
    options: string[] | null;
    correctIndex: number | null;
    expectedPoints: string | null;
  }[];
}

export interface LearningCoach {
  generateQuiz(request: QuizRequest): Promise<CoachQuiz>;
  evaluate(request: EvaluationRequest): Promise<CoachEvaluation>;
}
