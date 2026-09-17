import { describe, expect, it } from "vitest";

import { normalizeTopic } from "@/lib/constants";
import { findMatches, type TutorCandidate } from "@/lib/matching";

function candidate(overrides: Partial<TutorCandidate> & { userName: string }): TutorCandidate {
  return {
    offerId: `o-${overrides.userName}`,
    userId: `u-${overrides.userName}`,
    subject: "Mathematik",
    maxGradeLevel: 11,
    description: "",
    topics: [],
    acceptedRequests: 0,
    ...overrides,
  };
}

function topic(name: string) {
  return { name, normalized: normalizeTopic(name) };
}

describe("Bewertungen in der Trefferliste", () => {
  it("setzt bei gleicher Passung das besser bewertete Angebot nach vorn", () => {
    const results = findMatches(
      [
        candidate({ userName: "Ohne", topics: [topic("Bruchrechnen")] }),
        candidate({
          userName: "Gelobt",
          topics: [topic("Bruchrechnen")],
          rating: { average: 5, count: 3 },
        }),
      ],
      { subject: "Mathematik", topic: "Bruchrechnen", gradeLevel: 10 },
    );

    expect(results.map((r) => r.candidate.userName)).toEqual(["Gelobt", "Ohne"]);
  });

  it("laesst das passende Thema schwerer wiegen als gute Sterne", () => {
    // Der Punkt der Deckelung: Wer das gesuchte Thema anbietet, steht oben -
    // auch gegen ein durchweg mit fuenf Sternen bewertetes Angebot ohne Bezug.
    const results = findMatches(
      [
        candidate({ userName: "Beliebt", topics: [topic("Stochastik")], rating: { average: 5, count: 20 } }),
        candidate({ userName: "Passend", topics: [topic("Bruchrechnen")] }),
      ],
      { subject: "Mathematik", topic: "Bruchrechnen", gradeLevel: 10 },
    );

    expect(results[0].candidate.userName).toBe("Passend");
  });

  it("stellt ein unbewertetes Angebot nicht hinter ein schlecht bewertetes", () => {
    const results = findMatches(
      [
        candidate({ userName: "Schwach", rating: { average: 1, count: 5 } }),
        candidate({ userName: "Neu" }),
      ],
      { subject: "Mathematik", gradeLevel: 10 },
    );

    expect(results[0].candidate.userName).toBe("Neu");
  });
});

describe("findMatches", () => {
  it("blendet andere Faecher aus", () => {
    const results = findMatches(
      [candidate({ userName: "Anna", subject: "Physik" })],
      { subject: "Mathematik", gradeLevel: 10 },
    );
    expect(results).toHaveLength(0);
  });

  it("schlaegt einen nicht sich selbst vor", () => {
    const results = findMatches(
      [candidate({ userName: "Anna", userId: "u-self" })],
      { subject: "Mathematik", gradeLevel: 10, excludeUserId: "u-self" },
    );
    expect(results).toHaveLength(0);
  });

  it("setzt den exakten Thementreffer nach vorn", () => {
    const results = findMatches(
      [
        candidate({ userName: "Ohne", topics: [topic("Geometrie")] }),
        candidate({ userName: "Treffer", topics: [topic("Kurvendiskussion")] }),
      ],
      { subject: "Mathematik", topic: "Kurvendiskussion", gradeLevel: 10 },
    );

    expect(results[0].candidate.userName).toBe("Treffer");
    expect(results[0].matchedTopics).toContain("Kurvendiskussion");
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it("findet Themen trotz Umlauten und Schreibweise", () => {
    const results = findMatches(
      [candidate({ userName: "Anna", topics: [topic("Flächeninhalt")] })],
      { subject: "Mathematik", topic: "flaecheninhalt", gradeLevel: 9 },
    );
    expect(results[0].matchedTopics).toContain("Flächeninhalt");
  });

  it("bevorzugt, wer die Klassenstufe abdeckt", () => {
    const results = findMatches(
      [
        candidate({ userName: "Zuwenig", maxGradeLevel: 8 }),
        candidate({ userName: "Passt", maxGradeLevel: 12 }),
      ],
      { subject: "Mathematik", gradeLevel: 10 },
    );
    expect(results[0].candidate.userName).toBe("Passt");
  });

  it("verteilt die Last bei Gleichstand", () => {
    const results = findMatches(
      [
        candidate({ userName: "Vielbeschaeftigt", acceptedRequests: 5 }),
        candidate({ userName: "Frei", acceptedRequests: 0 }),
      ],
      { subject: "Mathematik", gradeLevel: 10 },
    );
    expect(results[0].candidate.userName).toBe("Frei");
  });
});
