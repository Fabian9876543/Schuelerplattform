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
