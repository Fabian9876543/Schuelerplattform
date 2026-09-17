import { describe, expect, it } from "vitest";

import {
  activeDays,
  currentStreak,
  describeStreak,
  doneThisWeek,
  startOfWeek,
} from "@/lib/streak";

/** Donnerstag, 17.09.2026 */
const heute = new Date(2026, 8, 17, 14, 0);
const tagVor = (tage: number, stunde = 14) => new Date(2026, 8, 17 - tage, stunde, 0);

describe("activeDays", () => {
  it("fasst mehrere Aufgaben am selben Tag zu einem Tag zusammen", () => {
    const tage = activeDays([tagVor(0, 9), tagVor(0, 18), tagVor(1)]);
    expect(tage.size).toBe(2);
  });

  it("zaehlt ueber Mitternacht als zwei Tage", () => {
    // 23:50 und 00:10 liegen zwanzig Minuten auseinander, aber an zwei Tagen -
    // und genau das ist gemeint.
    const tage = activeDays([new Date(2026, 8, 16, 23, 50), new Date(2026, 8, 17, 0, 10)]);
    expect(tage.size).toBe(2);
  });
});

describe("currentStreak", () => {
  it("zaehlt zusammenhaengende Tage bis heute", () => {
    expect(currentStreak(activeDays([tagVor(0), tagVor(1), tagVor(2)]), heute)).toBe(3);
  });

  it("laesst die Serie stehen, wenn heute noch nichts war", () => {
    // Der wichtigste Fall: Um neun Uhr morgens hat noch niemand etwas
    // geschafft. Die Serie von gestern deshalb auf null zu setzen waere eine
    // Uhr, die einem die Arbeit von fuenf Tagen wegnimmt.
    expect(currentStreak(activeDays([tagVor(1), tagVor(2), tagVor(3)]), heute)).toBe(3);
  });

  it("endet, wenn auch gestern nichts war", () => {
    expect(currentStreak(activeDays([tagVor(2), tagVor(3)]), heute)).toBe(0);
  });

  it("zaehlt nur bis zur ersten Luecke", () => {
    expect(currentStreak(activeDays([tagVor(0), tagVor(1), tagVor(3), tagVor(4)]), heute)).toBe(2);
  });

  it("kommt mit gar keiner Aktivitaet zurecht", () => {
    expect(currentStreak(activeDays([]), heute)).toBe(0);
  });

  it("zaehlt ueber einen Monatswechsel hinweg", () => {
    const anfangOktober = new Date(2026, 9, 1, 12);
    const tage = activeDays([
      new Date(2026, 9, 1, 12),
      new Date(2026, 8, 30, 12),
      new Date(2026, 8, 29, 12),
    ]);
    expect(currentStreak(tage, anfangOktober)).toBe(3);
  });
});

describe("startOfWeek", () => {
  it("beginnt am Montag", () => {
    // 17.09.2026 ist ein Donnerstag, der Montag davor der 14.
    expect(startOfWeek(heute).getDate()).toBe(14);
    expect(startOfWeek(heute).getHours()).toBe(0);
  });

  it("rechnet am Sonntag noch zur laufenden Woche", () => {
    const sonntag = new Date(2026, 8, 20, 10);
    expect(startOfWeek(sonntag).getDate()).toBe(14);
  });
});

describe("doneThisWeek", () => {
  it("zaehlt ab Montag", () => {
    const zeitpunkte = [tagVor(0), tagVor(1), tagVor(3), tagVor(4)]; // Do, Mi, Mo, So (Vorwoche)
    expect(doneThisWeek(zeitpunkte, heute)).toBe(3);
  });

  it("zaehlt nichts aus der Zukunft", () => {
    expect(doneThisWeek([new Date(2026, 8, 18, 12)], heute)).toBe(0);
  });
});

describe("describeStreak", () => {
  it("beugt und schweigt bei null", () => {
    expect(describeStreak(1)).toBe("1 Tag in Folge");
    expect(describeStreak(5)).toBe("5 Tage in Folge");
    expect(describeStreak(0)).toBeNull();
  });
});
