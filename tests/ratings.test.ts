import { describe, expect, it } from "vitest";

import {
  averageStars,
  canRate,
  describeRatingCount,
  formatStars,
  ratingBonus,
} from "@/lib/ratings";

describe("averageStars", () => {
  it("gibt null zurueck, solange niemand bewertet hat", () => {
    // Wichtig, damit "noch nicht bewertet" nicht als 0 durchgeht.
    expect(averageStars([])).toBeNull();
  });

  it("rechnet den Schnitt", () => {
    expect(averageStars([5, 4])).toBe(4.5);
    expect(averageStars([3])).toBe(3);
  });
});

describe("formatStars", () => {
  it("zeigt eine Nachkommastelle mit Komma", () => {
    expect(formatStars(4.5)).toBe("4,5");
    expect(formatStars(4)).toBe("4,0");
    expect(formatStars(4.666)).toBe("4,7");
  });
});

describe("ratingBonus", () => {
  it("benachteiligt nicht, wer noch keine Rueckmeldung hat", () => {
    // Sonst kaeme nie jemand zu seiner ersten Anfrage.
    expect(ratingBonus(null, 0)).toBe(0);
  });

  it("gibt durchschnittlichen Bewertungen keinen Ausschlag", () => {
    expect(ratingBonus(3, 5)).toBe(0);
  });

  it("bleibt zwischen -1 und +1", () => {
    expect(ratingBonus(5, 50)).toBe(1);
    expect(ratingBonus(1, 50)).toBe(-1);
  });

  it("gewichtet wenige Stimmen schwaecher als viele", () => {
    const eineStimme = ratingBonus(5, 1);
    const dreiStimmen = ratingBonus(5, 3);

    expect(eineStimme).toBeLessThan(dreiStimmen);
    expect(eineStimme).toBeCloseTo(1 / 3, 10);
    expect(dreiStimmen).toBe(1);
  });
});

describe("canRate", () => {
  it("laesst die anfragende Person nach einer Zusage bewerten", () => {
    expect(canRate("accepted", true)).toBe(true);
  });

  it("laesst die Gegenrichtung nicht zu", () => {
    // Sichtbar werden sollen gute Erklaerer, nicht "gute" Hilfesuchende.
    expect(canRate("accepted", false)).toBe(false);
  });

  it("verlangt eine Zusage", () => {
    expect(canRate("open", true)).toBe(false);
    expect(canRate("declined", true)).toBe(false);
    expect(canRate("withdrawn", true)).toBe(false);
  });
});

describe("describeRatingCount", () => {
  it("beugt", () => {
    expect(describeRatingCount(1)).toBe("1 Rueckmeldung");
    expect(describeRatingCount(4)).toBe("4 Rueckmeldungen");
  });
});
