import { describe, expect, it } from "vitest";

import { LIMITS, loginWindowStart, minutesUntilUnlocked, startOfDay } from "@/lib/limits";

describe("Zeitfenster der Grenzwerte", () => {
  it("setzt den Tagesbeginn auf Mitternacht", () => {
    const mittags = new Date("2026-03-01T14:37:12");
    const beginn = startOfDay(mittags);

    expect(beginn.getHours()).toBe(0);
    expect(beginn.getMinutes()).toBe(0);
    expect(beginn.getDate()).toBe(mittags.getDate());
  });

  it("legt das Anmeldefenster genau so weit zurueck wie konfiguriert", () => {
    const jetzt = new Date("2026-03-01T12:00:00");
    const start = loginWindowStart(jetzt);

    expect((jetzt.getTime() - start.getTime()) / 60_000).toBe(LIMITS.loginWindowMinutes);
  });
});

describe("minutesUntilUnlocked", () => {
  it("rechnet vom aeltesten Versuch, nicht vom neuesten", () => {
    const jetzt = new Date("2026-03-01T12:00:00");
    // Der aelteste Versuch liegt 5 Minuten zurueck, das Fenster sind 15
    // Minuten - es bleiben also 10 Minuten.
    const aeltester = new Date(jetzt.getTime() - 5 * 60_000);

    expect(minutesUntilUnlocked(aeltester, jetzt)).toBe(LIMITS.loginWindowMinutes - 5);
  });

  it("meldet nie weniger als eine Minute", () => {
    const jetzt = new Date("2026-03-01T12:00:00");
    // Fast abgelaufen - darf nicht 0 oder negativ werden, sonst sagt die
    // Meldung "warte 0 Minuten".
    const fastFrei = new Date(jetzt.getTime() - (LIMITS.loginWindowMinutes * 60_000 - 1000));

    expect(minutesUntilUnlocked(fastFrei, jetzt)).toBeGreaterThanOrEqual(1);
  });

  it("wandert mit: ein neuerer aeltester Versuch verlaengert die Sperre", () => {
    const jetzt = new Date("2026-03-01T12:00:00");
    const frueh = minutesUntilUnlocked(new Date(jetzt.getTime() - 10 * 60_000), jetzt);
    const spaet = minutesUntilUnlocked(new Date(jetzt.getTime() - 2 * 60_000), jetzt);

    expect(spaet).toBeGreaterThan(frueh);
  });
});

describe("Grenzwerte selbst", () => {
  it("deckelt die Tageskosten auf einen vertretbaren Betrag", () => {
    // Gemessen: ~0,09 USD je Selbsttest, ~0,07 USD je Auswertung.
    const proTag = LIMITS.assessmentsPerDay * (0.09 + 0.07);
    expect(proTag).toBeLessThanOrEqual(2);
  });

  it("laesst normales Tippen beim Anmelden zu", () => {
    // Wer sich dreimal vertippt, darf nicht ausgesperrt werden.
    expect(LIMITS.loginAttempts).toBeGreaterThanOrEqual(5);
  });

  it("begrenzt alles, was in einen KI-Prompt gelangt", () => {
    expect(LIMITS.answerLength).toBeLessThanOrEqual(10_000);
    expect(LIMITS.topicLength).toBeLessThanOrEqual(200);
    expect(LIMITS.titleLength).toBeLessThanOrEqual(500);
  });
});
