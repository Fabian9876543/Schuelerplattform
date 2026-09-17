import { describe, expect, it } from "vitest";

import type { ExplanationBody } from "@/lib/ai/types";
import {
  explanationKey,
  parseExplanationBody,
  serializeExplanationBody,
} from "@/lib/explanations";

const body: ExplanationBody = {
  summary: "Worum es geht.",
  steps: [
    { title: "Erst das", body: "So geht der erste Schritt." },
    { title: "Dann das", body: "Und so der zweite." },
  ],
  example: "Ein durchgerechnetes Beispiel.",
  pitfalls: ["Der haeufigste Fehler."],
  checkQuestion: "Kannst du es erklaeren?",
};

describe("explanationKey", () => {
  it("vereinheitlicht Grossschreibung und Leerzeichen", () => {
    expect(explanationKey("Mathematik", "Kurvendiskussion", 11).topicKey).toBe(
      explanationKey("Mathematik", "  KURVENDISKUSSION ", 11).topicKey,
    );
  });

  it("behandelt einen Bindestrich als Wortgrenze", () => {
    // Dieselbe Regel wie beim Nachhilfe-Matching: "pq-Formel" und "pq Formel"
    // sind dasselbe, "kurven-diskussion" und "Kurvendiskussion" nicht. Wer den
    // Strich mitten ins Wort setzt, meint zwei Woerter.
    expect(explanationKey("Mathematik", "pq-Formel", 10).topicKey).toBe("pq formel");
    expect(explanationKey("Mathematik", "Kurvendiskussion", 11).topicKey).toBe("kurvendiskussion");
  });

  it("haelt Klassenstufen auseinander", () => {
    // "Ableitungen" in Klasse 10 ist etwas anderes als in Klasse 12.
    const zehn = explanationKey("Mathematik", "Ableitungen", 10);
    const zwoelf = explanationKey("Mathematik", "Ableitungen", 12);
    expect(zehn.gradeLevel).not.toBe(zwoelf.gradeLevel);
  });

  it("haelt Faecher auseinander", () => {
    expect(explanationKey("Deutsch", "Analyse", 11).subject).toBe("Deutsch");
    expect(explanationKey("Mathematik", "Analyse", 11).subject).toBe("Mathematik");
  });

  it("gleicht Umlaute an", () => {
    expect(explanationKey("Biologie", "Zellkörper", 9).topicKey).toBe(
      explanationKey("Biologie", "Zellkoerper", 9).topicKey,
    );
  });
});

describe("parseExplanationBody", () => {
  it("liest, was serialisiert wurde", () => {
    expect(parseExplanationBody(serializeExplanationBody(body))).toEqual(body);
  });

  it("gibt null bei kaputtem JSON", () => {
    expect(parseExplanationBody("{ das ist kein JSON")).toBeNull();
  });

  it("gibt null, wenn der Aufbau nicht mehr passt", () => {
    // Ein Eintrag aus einer frueheren Fassung darf keine Seite mitnehmen -
    // er wird behandelt, als laege nichts vor, und neu erzeugt.
    expect(parseExplanationBody(JSON.stringify({ summary: "nur das" }))).toBeNull();
  });

  it("gibt null, wenn zu wenige Schritte drinstehen", () => {
    const zuKurz = { ...body, steps: [body.steps[0]] };
    expect(parseExplanationBody(JSON.stringify(zuKurz))).toBeNull();
  });

  it("nimmt eine Erklaerung ohne Stolperfallen an", () => {
    const ohne = { ...body, pitfalls: [] };
    expect(parseExplanationBody(JSON.stringify(ohne))?.pitfalls).toEqual([]);
  });
});
