import type {
  CoachEvaluation,
  CoachQuiz,
  EvaluationRequest,
  LearningCoach,
  QuizRequest,
} from "@/lib/ai/types";

/**
 * Auswertung ohne KI.
 *
 * Greift immer dann, wenn kein ANTHROPIC_API_KEY gesetzt ist oder der
 * API-Aufruf fehlschlaegt. Der Anspruch ist Ehrlichkeit statt Schein: Ohne
 * Fachwissen werden hier keine Multiple-Choice-Fragen mit angeblich richtigen
 * Loesungen erfunden. Stattdessen gibt es Reflexionsfragen, und die Bewertung
 * stuetzt sich auf die Selbsteinschaetzung und darauf, wie gruendlich die
 * Fragen bearbeitet wurden.
 */

const REFLECTION_TEMPLATES = [
  (topic: string) => `Erklaere in eigenen Worten, worum es bei "${topic}" geht. Schreibe so, als wuerdest du es einer Mitschuelerin erklaeren, die gefehlt hat.`,
  (topic: string) => `Welche Aufgabentypen zu "${topic}" koenntest du in der Klausur bekommen? Nenne mindestens zwei und beschreibe, wie du vorgehen wuerdest.`,
  (topic: string) => `An welcher Stelle bist du bei "${topic}" zuletzt haengen geblieben? Beschreibe die Stelle so genau wie moeglich.`,
];

export class RuleCoach implements LearningCoach {
  async generateQuiz(request: QuizRequest): Promise<CoachQuiz> {
    const questions: CoachQuiz["questions"] = [];

    request.topics.forEach((topic, topicIndex) => {
      // Pro Thema zwei Reflexionsfragen, abwechselnd aus den Vorlagen.
      const first = REFLECTION_TEMPLATES[0](topic.name);
      const second = REFLECTION_TEMPLATES[1 + (topicIndex % 2)](topic.name);

      for (const prompt of [first, second]) {
        questions.push({
          topicId: topic.id,
          kind: "free_text",
          prompt,
          options: null,
          correctIndex: null,
          expectedPoints:
            "Je genauer und fachlicher deine Antwort, desto besser kannst du einschaetzen, wie sicher du bist.",
        });
      }
    });

    return { source: "rule", questions };
  }

  async evaluate(request: EvaluationRequest): Promise<CoachEvaluation> {
    const confidenceByTopic = new Map(
      request.selfRatings.map((rating) => [rating.topicId, rating.confidence]),
    );

    const questionFeedback: CoachEvaluation["questionFeedback"] = [];
    // Pro Thema sammeln, wie die Fragen bearbeitet wurden.
    const stats = new Map<string, { mcTotal: number; mcCorrect: number; textScores: number[] }>();
    for (const topic of request.topics) {
      stats.set(topic.id, { mcTotal: 0, mcCorrect: 0, textScores: [] });
    }

    for (const question of request.questions) {
      const bucket = question.topicId ? stats.get(question.topicId) : undefined;

      if (question.kind === "multiple_choice") {
        const isCorrect =
          question.correctIndex !== null && question.answerIndex === question.correctIndex;
        if (bucket) {
          bucket.mcTotal += 1;
          if (isCorrect) bucket.mcCorrect += 1;
        }
        questionFeedback.push({
          questionId: question.id,
          score: isCorrect ? 100 : 0,
          feedback: isCorrect
            ? "Richtig."
            : question.correctIndex !== null && question.options
              ? `Nicht richtig. Korrekt waere gewesen: ${question.options[question.correctIndex]}`
              : "Nicht richtig.",
          isCorrect,
        });
        continue;
      }

      // Freitext laesst sich ohne Fachwissen nicht inhaltlich bewerten.
      // Bewertet wird deshalb nur die Bearbeitungstiefe - und das wird auch so
      // gesagt, statt eine inhaltliche Korrektur vorzutaeuschen.
      const text = (question.answerText ?? "").trim();
      const words = text ? text.split(/\s+/).length : 0;
      let score: number;
      let feedback: string;
      if (words === 0) {
        score = 0;
        feedback = "Keine Antwort abgegeben - das deutet auf eine Luecke hin.";
      } else if (words < 8) {
        score = 30;
        feedback = "Sehr knapp. Versuche, den Gedanken vollstaendig auszuformulieren.";
      } else if (words < 25) {
        score = 60;
        feedback = "Solide bearbeitet. Pruefe selbst, ob die Fachbegriffe richtig sitzen.";
      } else {
        score = 85;
        feedback = "Ausfuehrlich bearbeitet. Vergleiche deine Erklaerung mit dem Heft oder Buch.";
      }
      if (bucket) bucket.textScores.push(score);
      questionFeedback.push({ questionId: question.id, score, feedback, isCorrect: null });
    }

    const deficits: CoachEvaluation["deficits"] = [];
    const topicScores: number[] = [];

    for (const topic of request.topics) {
      const bucket = stats.get(topic.id)!;
      const confidence = confidenceByTopic.get(topic.id) ?? 3;
      // Selbsteinschaetzung 1-5 auf 0-100 abbilden.
      const confidenceScore = ((confidence - 1) / 4) * 100;

      let score: number;
      if (bucket.mcTotal > 0) {
        // Gemessenes Wissen wiegt schwerer als das Bauchgefuehl.
        const mcScore = (bucket.mcCorrect / bucket.mcTotal) * 100;
        score = mcScore * 0.6 + confidenceScore * 0.4;
      } else if (bucket.textScores.length > 0) {
        const textScore =
          bucket.textScores.reduce((sum, value) => sum + value, 0) / bucket.textScores.length;
        score = confidenceScore * 0.7 + textScore * 0.3;
      } else {
        score = confidenceScore;
      }

      topicScores.push(score);

      if (score < 50) {
        const severity = score < 25 ? 3 : score < 40 ? 2 : 1;
        deficits.push({
          topicId: topic.id,
          severity,
          explanation:
            bucket.mcTotal > 0
              ? `${bucket.mcCorrect} von ${bucket.mcTotal} Fragen richtig, und du fuehlst dich hier unsicher.`
              : `Du hast dich bei "${topic.name}" als unsicher eingeschaetzt (${confidence} von 5).`,
          focus: `Grundlagen zu ${topic.name} wiederholen und an Aufgaben ueben`,
        });
      }
    }

    const overallScore = topicScores.length
      ? Math.round(topicScores.reduce((sum, value) => sum + value, 0) / topicScores.length)
      : 0;

    const summary =
      deficits.length === 0
        ? `Du wirkst in allen ${request.topics.length} Themen recht sicher. Nutze die Zeit bis zur Klausur fuer Wiederholungen. Hinweis: Diese Auswertung ist regelbasiert und stuetzt sich auf deine Selbsteinschaetzung - sie bewertet die Freitextantworten nicht inhaltlich.`
        : `Bei ${deficits.length} von ${request.topics.length} Themen gibt es noch Luecken, am deutlichsten bei "${
            request.topics.find((t) => t.id === deficits[0].topicId)?.name ?? ""
          }". Der Lernplan setzt genau dort an. Hinweis: Diese Auswertung ist regelbasiert und stuetzt sich auf deine Selbsteinschaetzung - sie bewertet die Freitextantworten nicht inhaltlich.`;

    return { summary, overallScore, source: "rule", questionFeedback, deficits };
  }
}
