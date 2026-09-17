import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import {
  evaluationResultSchema,
  explanationSchema,
  quizSchema,
  type CoachEvaluation,
  type CoachExplanation,
  type CoachQuiz,
  type EvaluationRequest,
  type ExplanationRequest,
  type LearningCoach,
  type QuizRequest,
} from "@/lib/ai/types";

const MODEL = "claude-opus-5";
const MAX_TOKENS = 16000;

/**
 * Auswertung mit Claude.
 *
 * Das Ausgabeformat wird ueber zodOutputFormat erzwungen - es wird also kein
 * Freitext geparst. Die Themen gehen als nummerierte Liste hinein und kommen
 * als Index zurueck, damit das Modell keine Datenbank-IDs abschreiben muss.
 */
/** Verbrauch eines Aufrufs - fuer die Kostenkontrolle in scripts/ki-probe.ts. */
export interface CoachUsage {
  step: "quiz" | "evaluation" | "explanation";
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

export class ClaudeCoach implements LearningCoach {
  private client: Anthropic;

  /** Verbrauch der bisherigen Aufrufe dieser Instanz. */
  readonly usage: CoachUsage[] = [];

  constructor(apiKey?: string) {
    this.client = apiKey ? new Anthropic({ apiKey }) : new Anthropic();
  }

  private track(step: CoachUsage["step"], usage: Anthropic.Usage, startedAt: number): void {
    this.usage.push({
      step,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      durationMs: Date.now() - startedAt,
    });
  }

  async generateQuiz(request: QuizRequest): Promise<CoachQuiz> {
    const topicList = request.topics.map((topic, index) => `${index}: ${topic.name}`).join("\n");
    const startedAt = Date.now();

    const response = await this.client.messages.parse({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: "adaptive" },
      system:
        "Du bist eine erfahrene Lehrkraft und erstellst kurze Selbsttests fuer Schuelerinnen und Schueler in Deutschland. " +
        "Du formulierst fachlich korrekt, altersgerecht und auf Deutsch. Die Fragen pruefen Verstaendnis, nicht Auswendiglernen.",
      messages: [
        {
          role: "user",
          content: [
            `Erstelle einen kurzen Selbsttest fuer eine Klausur im Fach ${request.subject}, Klassenstufe ${request.gradeLevel}.`,
            "",
            "Teilthemen (mit Index):",
            topicList,
            "",
            "Vorgaben:",
            "- Insgesamt 6 bis 8 Fragen.",
            "- Zu jedem Teilthema mindestens eine Frage; setze topicIndex auf den passenden Index oben.",
            "- Ueberwiegend multiple_choice mit genau 4 Antwortmoeglichkeiten und genau einer richtigen Antwort (correctIndex).",
            "- Dazu 1 bis 2 Fragen vom Typ free_text, bei denen etwas erklaert oder ein Rechenweg beschrieben wird.",
            "- Bei multiple_choice: options und correctIndex ausfuellen, expectedPoints auf null setzen.",
            "- Bei free_text: options und correctIndex auf null setzen, expectedPoints ausfuellen.",
            "- Die falschen Antwortmoeglichkeiten sollen typische Schuelerfehler abbilden, nicht offensichtlich unsinnig sein.",
          ].join("\n"),
        },
      ],
      output_config: { format: zodOutputFormat(quizSchema) },
    });

    this.track("quiz", response.usage, startedAt);

    const parsed = response.parsed_output;
    if (!parsed) {
      throw new Error("Claude hat kein verwertbares Quiz geliefert.");
    }

    const questions = parsed.questions.map((question) => {
      const topic = request.topics[question.topicIndex];
      const isMultipleChoice = question.kind === "multiple_choice";
      // Gegen halb ausgefuellte Antworten absichern: eine MC-Frage ohne
      // brauchbare Optionen wird als Freitextfrage behandelt.
      const optionsValid =
        isMultipleChoice &&
        Array.isArray(question.options) &&
        question.options.length >= 2 &&
        question.correctIndex !== null &&
        question.correctIndex >= 0 &&
        question.correctIndex < question.options.length;

      return {
        topicId: topic?.id ?? null,
        kind: optionsValid ? ("multiple_choice" as const) : ("free_text" as const),
        prompt: question.prompt,
        options: optionsValid ? question.options : null,
        correctIndex: optionsValid ? question.correctIndex : null,
        expectedPoints: optionsValid ? null : (question.expectedPoints ?? "Erklaere deinen Gedankengang nachvollziehbar."),
      };
    });

    return { source: "ai", questions };
  }

  async evaluate(request: EvaluationRequest): Promise<CoachEvaluation> {
    const topicList = request.topics.map((topic, index) => `${index}: ${topic.name}`).join("\n");

    const confidenceByTopic = new Map(
      request.selfRatings.map((rating) => [rating.topicId, rating.confidence]),
    );

    const answerBlocks = request.questions.map((question, index) => {
      const topicName = request.topics.find((topic) => topic.id === question.topicId)?.name ?? "ohne Thema";
      const lines = [`Frage ${index} (Thema: ${topicName}, Typ: ${question.kind})`, `Frage: ${question.prompt}`];

      if (question.kind === "multiple_choice" && question.options) {
        lines.push(
          `Antwortmoeglichkeiten: ${question.options.map((option, i) => `[${i}] ${option}`).join(" | ")}`,
        );
        lines.push(`Richtig waere: ${question.correctIndex}`);
        lines.push(
          `Angekreuzt: ${question.answerIndex === null ? "nichts angekreuzt" : question.answerIndex}`,
        );
      } else {
        if (question.expectedPoints) lines.push(`Erwartet wird: ${question.expectedPoints}`);
        const text = question.answerText?.trim();
        lines.push(
          text
            ? `Antwort (abgegeben): ${text}`
            : "Antwort: KEINE - das Feld wurde leer gelassen",
        );
      }
      return lines.join("\n");
    });

    const startedAt = Date.now();

    const ratingLines = request.topics.map((topic, index) => {
      const confidence = confidenceByTopic.get(topic.id);
      return `${index}: ${topic.name} - Selbsteinschaetzung ${confidence ?? "keine"} von 5`;
    });

    const response = await this.client.messages.parse({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: "adaptive" },
      system:
        "Du bist eine erfahrene Lehrkraft und wertest den Selbsttest einer Schuelerin oder eines Schuelers aus. " +
        "Du schreibst auf Deutsch, direkt in der Du-Form, sachlich und ermutigend, aber ohne Luecken schoenzureden. " +
        "Du benennst konkret, woran es hakt, statt allgemeine Ratschlaege zu geben.",
      messages: [
        {
          role: "user",
          content: [
            `Fach: ${request.subject}, Klassenstufe: ${request.gradeLevel}.`,
            `Bis zur Klausur sind es noch ${request.daysUntilExam} Tage.`,
            "",
            "Teilthemen (mit Index):",
            topicList,
            "",
            "Selbsteinschaetzung (1 = sehr unsicher, 5 = sehr sicher):",
            ...ratingLines,
            "",
            "Antworten im Selbsttest:",
            ...answerBlocks,
            "",
            "Deine Aufgabe:",
            "- Bewerte jede Frage einzeln (questionFeedback, questionIndex ist die Nummer oben, score von 0 bis 100).",
            "- Unterscheide dabei genau zwischen einer leeren und einer schwachen Antwort: Nur wo ausdruecklich KEINE Antwort steht, darfst du von einer fehlenden Antwort sprechen. Wurde etwas abgegeben, das inhaltlich nicht traegt, benenne das als unzureichende Antwort und greife auf, was die Person geschrieben hat - sonst fuehlt sie sich zu Unrecht uebergangen.",
            "- Gib eine Gesamtrueckmeldung (summary) von 2 bis 4 Saetzen und einen overallScore von 0 bis 100.",
            "- Liste unter deficits nur die Teilthemen auf, bei denen wirklich eine Luecke besteht.",
            "- Beziehe dabei die Selbsteinschaetzung mit ein: Wer sich unsicher fuehlt, aber richtig geantwortet hat, braucht eher Bestaetigung als Wiederholung.",
            "- severity: 1 = leichte Luecke, 2 = deutliche Luecke, 3 = gravierende Luecke.",
            "- focus beschreibt knapp, was konkret geuebt werden soll - dieser Text erscheint spaeter im Lernplan.",
            "- Wenn alles sitzt, darf deficits leer bleiben.",
          ].join("\n"),
        },
      ],
      output_config: { format: zodOutputFormat(evaluationResultSchema) },
    });

    this.track("evaluation", response.usage, startedAt);

    const parsed = response.parsed_output;
    if (!parsed) {
      throw new Error("Claude hat keine verwertbare Auswertung geliefert.");
    }

    const questionFeedback = parsed.questionFeedback
      .filter((entry) => request.questions[entry.questionIndex] !== undefined)
      .map((entry) => {
        const question = request.questions[entry.questionIndex];
        const isCorrect =
          question.kind === "multiple_choice" && question.correctIndex !== null
            ? question.answerIndex === question.correctIndex
            : null;
        return {
          questionId: question.id,
          score: entry.score,
          feedback: entry.feedback,
          isCorrect,
        };
      });

    const deficits = parsed.deficits
      .filter((deficit) => request.topics[deficit.topicIndex] !== undefined)
      .map((deficit) => ({
        topicId: request.topics[deficit.topicIndex].id,
        severity: deficit.severity,
        explanation: deficit.explanation,
        focus: deficit.focus,
      }));

    return {
      summary: parsed.summary,
      overallScore: parsed.overallScore,
      source: "ai",
      questionFeedback,
      deficits,
    };
  }

  /**
   * Erklaert ein Thema - die Stufe vor der Nachhilfe.
   *
   * Deutlich kleiner angesetzt als Selbsttest und Auswertung: Es geht um eine
   * Erklaerung, nicht um eine Unterrichtsreihe. Der Prompt verlangt
   * ausdruecklich ein vollstaendiges Beispiel und die typischen Fehler - daran
   * haengt es meistens, nicht an der Definition.
   */
  async explain(request: ExplanationRequest): Promise<CoachExplanation> {
    const startedAt = Date.now();

    const response = await this.client.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      system:
        "Du bist eine erfahrene Lehrkraft und erklaerst einer Schuelerin oder einem Schueler in Deutschland ein Thema, " +
        "an dem sie oder er gerade haengt. Du schreibst auf Deutsch, in der Du-Form, fachlich korrekt und ohne " +
        "Fachbegriffe, die du nicht erklaerst. Du erfindest nichts: Was du nicht sicher weisst, laesst du weg. " +
        "Du verweist nicht auf Videos oder Internetseiten - Links kommen in dieser App von Lehrkraeften, nicht von dir.",
      messages: [
        {
          role: "user",
          content: [
            `Erklaere das Thema "${request.topic}" im Fach ${request.subject} fuer Klassenstufe ${request.gradeLevel}.`,
            "",
            "Vorgaben:",
            "- summary: worum es geht, 2 bis 3 Saetze.",
            "- steps: der Weg durch das Thema in 2 bis 5 Schritten, je mit kurzer Ueberschrift.",
            "- example: ein vollstaendig durchgerechnetes oder durchgespieltes Beispiel. Keine Andeutung, sondern der ganze Weg.",
            "- pitfalls: bis zu 3 Fehler, die an genau dieser Stelle typisch sind.",
            "- checkQuestion: eine Frage, an der man selbst merkt, ob man es verstanden hat.",
            "- Richte dich nach der Klassenstufe: kein Stoff, der dort noch nicht dran war.",
          ].join("\n"),
        },
      ],
      output_config: { format: zodOutputFormat(explanationSchema) },
    });

    this.track("explanation", response.usage, startedAt);

    const parsed = response.parsed_output;
    if (!parsed) {
      throw new Error("Claude hat keine verwertbare Erklaerung geliefert.");
    }

    return { source: "ai", body: parsed };
  }
}
