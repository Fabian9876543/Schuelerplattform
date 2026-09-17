import type {
  CoachEvaluation,
  CoachExplanation,
  CoachQuiz,
  EvaluationRequest,
  ExplanationRequest,
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
          // Kein Schwerpunkt: ohne Fachwissen waere er nur eine Umschreibung
          // des Themennamens und wuerde die Aufgabe doppelt beschreiben.
        });
      }
    }

    const overallScore = topicScores.length
      ? Math.round(topicScores.reduce((sum, value) => sum + value, 0) / topicScores.length)
      : 0;

    // Der Hinweis auf die regelbasierte Herkunft steht in der Oberflaeche und
    // gehoert nicht zusaetzlich in den Text - sonst liest man ihn zweimal.
    const summary =
      deficits.length === 0
        ? `Du wirkst in allen ${request.topics.length} Themen recht sicher. Nutze die Zeit bis zur Klausur fuer Wiederholungen.`
        : `Bei ${deficits.length} von ${request.topics.length} Themen gibt es noch Luecken, am deutlichsten bei "${
            request.topics.find((t) => t.id === deficits[0].topicId)?.name ?? ""
          }". Der Lernplan setzt genau dort an.`;

    return { summary, overallScore, source: "rule", questionFeedback, deficits };
  }

  /**
   * Die Erklaerung ohne KI.
   *
   * Hier steht **kein Fachtext**, und das wird auch so gesagt: Eine erfundene
   * Erklaerung zur Kurvendiskussion waere schlimmer als keine - man merkt ihr
   * den Fehler erst in der Klausur an. Was ohne Fachwissen trotzdem stimmt,
   * ist der Weg: sich ein Beispiel vornehmen, es selbst rechnen, es jemandem
   * erklaeren. Genau der steht hier, und er gilt in jedem Fach.
   *
   * Der Text nennt keinen Grund fuer das Fehlen der KI: Er erscheint sowohl
   * ohne Schluessel als auch dann, wenn die API gerade klemmt. "Ohne
   * Schluessel" waere im zweiten Fall schlicht falsch.
   */
  async explain(request: ExplanationRequest): Promise<CoachExplanation> {
    const thema = request.topic;

    return {
      source: "rule",
      body: {
        summary:
          `Zu "${thema}" steht hier kein Fachtext: Die KI ist gerade nicht dabei, und raten hilft dir ` +
          "vor einer Klausur nicht. Was ich dir geben kann, ist der Weg, mit dem man sich ein Thema " +
          "selbst erschliesst - und darunter stehen die Links, die deine Schule geprueft hat.",
        steps: [
          {
            title: "Such dir ein geloestes Beispiel",
            body: `Im Heft, im Buch oder in einer alten Klausur: eine Aufgabe zu "${thema}", bei der die Loesung dabeisteht.`,
          },
          {
            title: "Rechne es selbst, mit abgedeckter Loesung",
            body: "Schreib jeden Schritt auf. Die Stelle, an der du haengenbleibst, ist deine eigentliche Luecke - nicht das ganze Thema.",
          },
          {
            title: "Erklaer es laut",
            body: "Jemandem, oder der Wand. Wo du ins Stocken geraetst, sitzt es noch nicht.",
          },
        ],
        example:
          `So sieht das konkret aus: Du nimmst die letzte Aufgabe zu "${thema}" aus dem Unterricht, deckst die ` +
          "Loesung ab und rechnest sie noch einmal. Kommst du bei Schritt drei nicht weiter, ist das die eine " +
          "Frage, die du stellen musst - im Unterricht oder bei jemandem aus deiner Stufe.",
        pitfalls: [
          "Die Loesung ansehen und denken, man koenne es jetzt. Nachvollziehen ist leichter als selbst machen.",
          "Das ganze Thema noch einmal lesen, statt die eine Stelle zu suchen, an der es hakt.",
        ],
        checkQuestion: `Kannst du "${thema}" in zwei Minuten jemandem erklaeren, ohne ins Heft zu sehen?`,
      },
    };
  }
}
