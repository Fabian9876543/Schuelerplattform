import { normalizeTopic } from "@/lib/constants";

/**
 * Bewertet Nachhilfe-Angebote gegen ein konkretes Defizit.
 *
 * Bewusst ohne Datenbankzugriff: Die Angebote kommen als Argument herein,
 * dadurch ist die Bewertung fuer sich testbar.
 */

export interface TutorCandidate {
  offerId: string;
  userId: string;
  userName: string;
  subject: string;
  maxGradeLevel: number;
  description: string;
  topics: { name: string; normalized: string }[];
  /** bereits angenommene Anfragen - verteilt die Last bei Gleichstand */
  acceptedRequests: number;
}

export interface MatchQuery {
  subject: string;
  /** gesuchtes Thema, roh wie eingegeben */
  topic?: string;
  /** Klassenstufe der suchenden Person */
  gradeLevel: number;
  /** eigene Angebote nie vorschlagen */
  excludeUserId?: string;
}

export interface MatchResult {
  candidate: TutorCandidate;
  score: number;
  /** kurze Begruendungen fuer die Anzeige in der Trefferliste */
  reasons: string[];
  matchedTopics: string[];
}

const SCORE_TOPIC_EXACT = 3;
const SCORE_TOPIC_PARTIAL = 1;
const SCORE_GRADE_SUFFICIENT = 2;
const SCORE_GRADE_AHEAD = 1;

export function scoreCandidate(candidate: TutorCandidate, query: MatchQuery): MatchResult | null {
  if (candidate.subject !== query.subject) return null;
  if (query.excludeUserId && candidate.userId === query.excludeUserId) return null;

  let score = 0;
  const reasons: string[] = [];
  const matchedTopics: string[] = [];

  const wanted = query.topic ? normalizeTopic(query.topic) : "";

  if (wanted) {
    for (const topic of candidate.topics) {
      if (topic.normalized === wanted) {
        score += SCORE_TOPIC_EXACT;
        matchedTopics.push(topic.name);
      } else if (
        topic.normalized.length > 2 &&
        (topic.normalized.includes(wanted) || wanted.includes(topic.normalized))
      ) {
        score += SCORE_TOPIC_PARTIAL;
        matchedTopics.push(topic.name);
      }
    }
    if (matchedTopics.length > 0) {
      reasons.push(`Bietet genau dieses Thema an: ${matchedTopics.join(", ")}`);
    }
  }

  if (candidate.maxGradeLevel >= query.gradeLevel) {
    score += SCORE_GRADE_SUFFICIENT;
    if (candidate.maxGradeLevel > query.gradeLevel) {
      score += SCORE_GRADE_AHEAD;
      reasons.push(`Gibt Nachhilfe bis Klasse ${candidate.maxGradeLevel}`);
    } else {
      reasons.push(`Kennt den Stoff der Klasse ${query.gradeLevel}`);
    }
  } else {
    reasons.push(`Unterrichtet nur bis Klasse ${candidate.maxGradeLevel}`);
  }

  return { candidate, score, reasons, matchedTopics };
}

/**
 * Sortierte Trefferliste. Bei gleichem Score kommt zuerst, wer bisher
 * weniger Anfragen angenommen hat - so verteilt sich die Nachhilfe.
 */
export function findMatches(candidates: TutorCandidate[], query: MatchQuery): MatchResult[] {
  return candidates
    .map((candidate) => scoreCandidate(candidate, query))
    .filter((result): result is MatchResult => result !== null)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.candidate.acceptedRequests - b.candidate.acceptedRequests ||
        a.candidate.userName.localeCompare(b.candidate.userName),
    );
}
