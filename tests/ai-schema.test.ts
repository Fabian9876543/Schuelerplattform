import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { describe, expect, it } from "vitest";

import { evaluationResultSchema, quizSchema } from "@/lib/ai/types";

/**
 * Diese Tests brauchen keinen API-Schluessel. Sie stellen sicher, dass die
 * Schemas, mit denen die Antwort von Claude erzwungen wird, sich ueberhaupt in
 * ein gueltiges Ausgabeformat uebersetzen lassen - das ist die Stelle, an der
 * inkompatible Zod-Konstrukte sonst erst im laufenden Betrieb auffallen.
 */
describe("Ausgabeformate fuer die KI", () => {
  it("uebersetzt das Quiz-Schema in ein JSON-Schema", () => {
    const format = zodOutputFormat(quizSchema);
    expect(format.type).toBe("json_schema");
    expect(JSON.stringify(format)).toContain("topicIndex");
  });

  it("uebersetzt das Auswertungs-Schema in ein JSON-Schema", () => {
    const format = zodOutputFormat(evaluationResultSchema);
    expect(format.type).toBe("json_schema");
    const asText = JSON.stringify(format);
    expect(asText).toContain("deficits");
    expect(asText).toContain("questionFeedback");
  });

  it("nimmt eine wohlgeformte Quiz-Antwort an", () => {
    const parsed = quizSchema.safeParse({
      questions: [
        {
          topicIndex: 0,
          kind: "multiple_choice",
          prompt: "Wie lautet die Ableitung von f(x) = x^2?",
          options: ["2x", "x", "2", "x^2"],
          correctIndex: 0,
          expectedPoints: null,
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("weist eine Antwort mit unzulaessigem Fragetyp zurueck", () => {
    const parsed = quizSchema.safeParse({
      questions: [
        { topicIndex: 0, kind: "essay", prompt: "Frage", options: null, correctIndex: null, expectedPoints: null },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("weist einen Schweregrad ausserhalb von 1 bis 3 zurueck", () => {
    const parsed = evaluationResultSchema.safeParse({
      summary: "Text",
      overallScore: 50,
      questionFeedback: [],
      deficits: [{ topicIndex: 0, severity: 7, explanation: "x", focus: "y" }],
    });
    expect(parsed.success).toBe(false);
  });
});
