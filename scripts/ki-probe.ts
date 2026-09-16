/**
 * Prüft die KI-Auswertung direkt, ohne Browser, Anmeldung und Datenbank.
 *
 *   npm run ki-probe
 *
 * Ohne ANTHROPIC_API_KEY läuft nur die regelbasierte Variante - so lässt sich
 * das Skript auch ohne Schlüssel benutzen. Mit Schlüssel laufen beide und
 * stehen zum Vergleich nebeneinander.
 *
 * Die Antworten werden bewusst gegenläufig zur Selbsteinschätzung simuliert:
 * Ein Thema wird richtig beantwortet, aber als unsicher eingeschätzt, ein
 * anderes falsch beantwortet, aber als sicher. Daran zeigt sich, ob die
 * Auswertung den Antworten folgt oder nur das Bauchgefühl wiederholt.
 */
import path from "node:path";

import { ClaudeCoach } from "@/lib/ai/claude-coach";
import { RuleCoach } from "@/lib/ai/rule-coach";
import type {
  AnsweredQuestion,
  CoachEvaluation,
  CoachQuiz,
  LearningCoach,
  TopicInput,
} from "@/lib/ai/types";

try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // ohne .env zählt nur die Umgebung
}

// Preise für claude-opus-5 in US-Dollar je Million Token
const PREIS_INPUT = 5;
const PREIS_OUTPUT = 25;

const TOPICS: TopicInput[] = [
  { id: "t1", name: "Ableitungsregeln" },
  { id: "t2", name: "Kurvendiskussion" },
  { id: "t3", name: "Extremwertaufgaben" },
];

/** Wie das jeweilige Thema beantwortet wird und wie sicher sich der Schüler fühlt. */
const SZENARIO: Record<string, { antwort: "richtig" | "falsch" | "gemischt"; confidence: number }> = {
  t1: { antwort: "richtig", confidence: 2 }, // kann es, fühlt sich unsicher
  t2: { antwort: "falsch", confidence: 5 }, // kann es nicht, fühlt sich sicher
  t3: { antwort: "gemischt", confidence: 3 },
};

const trennlinie = (titel: string) => `\n${"─".repeat(72)}\n${titel}\n${"─".repeat(72)}`;

function themenName(id: string | null): string {
  return TOPICS.find((t) => t.id === id)?.name ?? "ohne Thema";
}

function zeigeQuiz(quiz: CoachQuiz): void {
  console.log(`Herkunft: ${quiz.source === "ai" ? "Claude" : "regelbasiert"} · ${quiz.questions.length} Fragen\n`);

  quiz.questions.forEach((frage, i) => {
    console.log(`  ${i + 1}. [${themenName(frage.topicId)}] ${frage.prompt}`);
    if (frage.kind === "multiple_choice" && frage.options) {
      frage.options.forEach((option, index) => {
        const markierung = index === frage.correctIndex ? "  <- als richtig markiert" : "";
        console.log(`       (${index}) ${option}${markierung}`);
      });
    } else {
      console.log(`       Freitext · erwartet: ${frage.expectedPoints ?? "(nichts angegeben)"}`);
    }
    console.log("");
  });

  // Deckt jedes Thema mindestens eine Frage ab?
  const ohneFrage = TOPICS.filter((t) => !quiz.questions.some((q) => q.topicId === t.id));
  if (ohneFrage.length > 0) {
    console.log(`  ACHTUNG: keine Frage zu ${ohneFrage.map((t) => t.name).join(", ")}\n`);
  }
}

/**
 * Baut aus den erzeugten Fragen die Antworten nach dem Szenario oben.
 * Für eine "richtige" Freitextantwort wird der von der KI selbst gelieferte
 * Erwartungshorizont benutzt - das ist per Definition eine gute Antwort.
 */
function beantworte(quiz: CoachQuiz): AnsweredQuestion[] {
  const zaehlerProThema = new Map<string, number>();

  return quiz.questions.map((frage, index) => {
    const plan = frage.topicId ? SZENARIO[frage.topicId] : undefined;
    const nummer = frage.topicId ? (zaehlerProThema.get(frage.topicId) ?? 0) : 0;
    if (frage.topicId) zaehlerProThema.set(frage.topicId, nummer + 1);

    // Bei "gemischt" jede zweite Frage falsch beantworten.
    const richtig =
      plan?.antwort === "richtig" || (plan?.antwort === "gemischt" && nummer % 2 === 0);

    const basis = {
      id: `q${index}`,
      topicId: frage.topicId,
      kind: frage.kind,
      prompt: frage.prompt,
      options: frage.options,
      correctIndex: frage.correctIndex,
      expectedPoints: frage.expectedPoints,
    };

    if (frage.kind === "multiple_choice" && frage.options && frage.correctIndex !== null) {
      const falscherIndex = (frage.correctIndex + 1) % frage.options.length;
      return {
        ...basis,
        answerText: null,
        answerIndex: richtig ? frage.correctIndex : falscherIndex,
      };
    }

    return {
      ...basis,
      answerText: richtig
        ? (frage.expectedPoints ?? "Ich gehe die Regeln der Reihe nach durch und begründe jeden Schritt.")
        : "Weiss ich nicht so genau, irgendwas mit ableiten.",
      answerIndex: null,
    };
  });
}

function zeigeAuswertung(ergebnis: CoachEvaluation, antworten: AnsweredQuestion[]): void {
  console.log(`Herkunft: ${ergebnis.source === "ai" ? "Claude" : "regelbasiert"} · Gesamtwert ${ergebnis.overallScore}/100\n`);
  console.log(`Fazit: ${ergebnis.summary}\n`);

  if (ergebnis.questionFeedback.length > 0) {
    console.log("Rückmeldung je Frage:");
    ergebnis.questionFeedback.forEach((f) => {
      const frage = antworten.find((a) => a.id === f.questionId);
      console.log(`  [${themenName(frage?.topicId ?? null)}] ${f.score}/100 - ${f.feedback}`);
    });
    console.log("");
  }

  console.log("Erkannte Lücken:");
  if (ergebnis.deficits.length === 0) {
    console.log("  keine");
  } else {
    ergebnis.deficits.forEach((d) => {
      console.log(`  [Schwere ${d.severity}] ${themenName(d.topicId)}: ${d.explanation}`);
      if (d.focus) console.log(`      Schwerpunkt: ${d.focus}`);
    });
  }
}

/**
 * Gleicht das Ergebnis gegen die Erwartung aus dem Szenario ab.
 *
 * Die ersten beiden Punkte setzen voraus, dass die Antworten inhaltlich
 * bewertet werden. Die regelbasierte Variante kann das nicht - sie hat kein
 * Fachwissen und stützt sich auf die Selbsteinschätzung. Ein "nein" ist dort
 * deshalb kein Defekt, sondern die bauartbedingte Grenze; sie wird als solche
 * ausgewiesen statt als Fehlschlag.
 */
function pruefe(ergebnis: CoachEvaluation): void {
  console.log(trennlinie("Abgleich mit der Erwartung"));

  const istKi = ergebnis.source === "ai";
  const schwereJeThema = new Map(ergebnis.deficits.map((d) => [d.topicId, d.severity]));
  const zeile = (ok: boolean, text: string, brauchtFachwissen = false) => {
    const marke = ok ? "ok      " : brauchtFachwissen && !istKi ? "bauart  " : "FEHL    ";
    console.log(`  ${marke}${text}`);
  };

  const t1 = schwereJeThema.get("t1") ?? 0;
  zeile(
    t1 <= 1,
    `Ableitungsregeln richtig beantwortet, Selbsteinschätzung nur 2 -> höchstens leichte Lücke erwartet (erkannt: ${t1 === 0 ? "keine" : "Schwere " + t1})`,
    true,
  );

  const t2 = schwereJeThema.get("t2") ?? 0;
  zeile(
    t2 >= 2,
    `Kurvendiskussion falsch beantwortet, Selbsteinschätzung 5 -> deutliche Lücke erwartet (erkannt: ${t2 === 0 ? "keine" : "Schwere " + t2})`,
    true,
  );

  zeile(
    ergebnis.deficits.every((d) => TOPICS.some((t) => t.id === d.topicId)),
    "alle gemeldeten Lücken gehören zu einem der vorgegebenen Themen",
  );

  if (!istKi) {
    console.log(
      "\n  \"bauart\" = braucht inhaltliche Bewertung der Antworten. Ohne API-Schlüssel\n" +
        "  richtet sich die Lückenerkennung praktisch nur nach der Selbsteinschätzung:\n" +
        "  Wer sich überschätzt, wird nicht gewarnt.",
    );
  }
}

async function durchlauf(coach: LearningCoach, titel: string): Promise<void> {
  console.log(trennlinie(`${titel} - erzeugte Fragen`));
  const quiz = await coach.generateQuiz({
    subject: "Mathematik",
    gradeLevel: 11,
    examDate: new Date(Date.now() + 12 * 86_400_000),
    topics: TOPICS,
  });
  zeigeQuiz(quiz);

  const antworten = beantworte(quiz);
  console.log(trennlinie(`${titel} - Auswertung`));
  const ergebnis = await coach.evaluate({
    subject: "Mathematik",
    gradeLevel: 11,
    topics: TOPICS,
    questions: antworten,
    selfRatings: TOPICS.map((t) => ({ topicId: t.id, confidence: SZENARIO[t.id].confidence })),
    daysUntilExam: 12,
  });
  zeigeAuswertung(ergebnis, antworten);
  pruefe(ergebnis);
}

async function main(): Promise<void> {
  console.log("Szenario: Mathematik, Klasse 11, Klausur in 12 Tagen");
  TOPICS.forEach((t) => {
    const s = SZENARIO[t.id];
    console.log(`  ${t.name}: wird ${s.antwort} beantwortet, Selbsteinschätzung ${s.confidence}/5`);
  });

  const key = process.env.ANTHROPIC_API_KEY?.trim();

  if (key) {
    const claude = new ClaudeCoach(key);
    try {
      await durchlauf(claude, "MIT CLAUDE");
    } catch (error) {
      console.error("\nDer Aufruf an Claude ist fehlgeschlagen:");
      console.error(`  ${error instanceof Error ? error.message : String(error)}`);
      console.error("  In der App würde jetzt die regelbasierte Auswertung einspringen.\n");
    }

    if (claude.usage.length > 0) {
      console.log(trennlinie("Verbrauch"));
      let kosten = 0;
      for (const u of claude.usage) {
        const anteil = (u.inputTokens / 1e6) * PREIS_INPUT + (u.outputTokens / 1e6) * PREIS_OUTPUT;
        kosten += anteil;
        console.log(
          `  ${u.step.padEnd(11)} ${String(u.inputTokens).padStart(6)} rein, ${String(u.outputTokens).padStart(6)} raus, ${(u.durationMs / 1000).toFixed(1)}s, ${anteil.toFixed(4)} USD`,
        );
      }
      console.log(`  Summe: ${kosten.toFixed(4)} USD`);
    }
  } else {
    console.log(
      "\nKein ANTHROPIC_API_KEY hinterlegt - es läuft nur die regelbasierte Variante.\n" +
        'Für den Vergleich: ANTHROPIC_API_KEY="sk-ant-..." in die .env eintragen.',
    );
  }

  await durchlauf(new RuleCoach(), "REGELBASIERT");
  console.log("");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
