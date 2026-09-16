import Anthropic from "@anthropic-ai/sdk";

import { findApiKey, apiKeySource } from "@/lib/ai/api-key";
import { ClaudeCoach } from "@/lib/ai/claude-coach";
import { RuleCoach } from "@/lib/ai/rule-coach";
import type {
  CoachEvaluation,
  CoachQuiz,
  EvaluationRequest,
  LearningCoach,
  QuizRequest,
} from "@/lib/ai/types";

export * from "@/lib/ai/types";
export { ClaudeCoach } from "@/lib/ai/claude-coach";
export { RuleCoach } from "@/lib/ai/rule-coach";

export { findApiKey, apiKeySource } from "@/lib/ai/api-key";

export function hasApiKey(): boolean {
  return Boolean(findApiKey());
}

function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return `Der hinterlegte Schluessel (${apiKeySource()}) wurde abgelehnt.`;
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "Das API-Kontingent ist erschoepft.";
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return "Die Claude-API war nicht erreichbar.";
  }
  if (error instanceof Anthropic.APIError) {
    return `Die Claude-API meldete einen Fehler (${error.status}).`;
  }
  return error instanceof Error ? error.message : "Unbekannter Fehler.";
}

/**
 * Waehlt die Auswertung aus und faengt Ausfaelle ab.
 *
 * Ohne API-Schluessel wird direkt regelbasiert gearbeitet. Mit Schluessel wird
 * Claude gefragt - schlaegt das fehl, uebernimmt ebenfalls die regelbasierte
 * Auswertung. Eine Schuelerin, die kurz vor der Klausur sitzt, soll nie vor
 * einer Fehlerseite stehen, nur weil eine API gerade klemmt.
 */
class FallbackCoach implements LearningCoach {
  private rule = new RuleCoach();

  private claude(): ClaudeCoach | null {
    const key = findApiKey();
    return key ? new ClaudeCoach(key) : null;
  }

  async generateQuiz(request: QuizRequest): Promise<CoachQuiz> {
    const claude = this.claude();
    if (!claude) return this.rule.generateQuiz(request);

    try {
      return await claude.generateQuiz(request);
    } catch (error) {
      console.error("[ai] Fragengenerierung faellt auf Regeln zurueck:", describeError(error));
      return this.rule.generateQuiz(request);
    }
  }

  async evaluate(request: EvaluationRequest): Promise<CoachEvaluation> {
    const claude = this.claude();
    if (!claude) return this.rule.evaluate(request);

    try {
      return await claude.evaluate(request);
    } catch (error) {
      console.error("[ai] Auswertung faellt auf Regeln zurueck:", describeError(error));
      return this.rule.evaluate(request);
    }
  }
}

export function getCoach(): LearningCoach {
  return new FallbackCoach();
}
