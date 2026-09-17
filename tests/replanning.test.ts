import { describe, expect, it } from "vitest";

import {
  addDays,
  daysBetween,
  progressPercent,
  replan,
  type Mastery,
  type ReplanTask,
} from "@/lib/planning";

const heute = new Date("2026-03-01T12:00:00");
const klausur = addDays(heute, 10);

function task(over: Partial<ReplanTask> & { id: string }): ReplanTask {
  return { topicId: "t1", dueDate: heute, done: false, skipped: false, ...over };
}

function stand(...paare: [string, Mastery][]): Map<string, Mastery> {
  return new Map(paare);
}

describe("progressPercent", () => {
  it("zaehlt die Ampelstufen zusammen", () => {
    expect(progressPercent(["strong", "strong"])).toBe(100);
    expect(progressPercent(["weak", "weak"])).toBe(0);
    expect(progressPercent(["weak", "strong"])).toBe(50);
    expect(progressPercent(["weak", "medium", "strong"])).toBe(50);
  });

  it("ist ohne Themen 0 und nicht 100", () => {
    // "nichts zu tun" darf nicht als "alles geschafft" durchgehen.
    expect(progressPercent([])).toBe(0);
  });
});

describe("replan: was entfaellt und was auflebt", () => {
  it("laesst Aufgaben entfallen, sobald das Thema sitzt", () => {
    const result = replan([task({ id: "a" })], stand(["t1", "strong"]), klausur, heute);
    expect(result.skip).toEqual(["a"]);
  });

  it("weckt sie wieder, wenn das Thema erneut wackelt", () => {
    const result = replan(
      [task({ id: "a", skipped: true })],
      stand(["t1", "weak"]),
      klausur,
      heute,
    );
    expect(result.unskip).toEqual(["a"]);
  });

  it("laesst erledigte Aufgaben in Ruhe", () => {
    const result = replan(
      [task({ id: "a", done: true })],
      stand(["t1", "strong"]),
      klausur,
      heute,
    );
    expect(result.skip).toEqual([]);
    expect(result.move).toEqual([]);
  });

  it("ruehrt die Generalprobe ohne Thema nicht an", () => {
    const result = replan([task({ id: "a", topicId: null })], stand(["t1", "strong"]), klausur, heute);
    expect(result.skip).toEqual([]);
  });
});

describe("replan: Liegengebliebenes", () => {
  it("holt eine ueberfaellige Aufgabe nach vorn", () => {
    const result = replan(
      [task({ id: "a", dueDate: addDays(heute, -3) })],
      stand(["t1", "weak"]),
      klausur,
      heute,
    );
    expect(result.move).toHaveLength(1);
    expect(daysBetween(heute, result.move[0].dueDate)).toBe(0);
  });

  it("stapelt nicht alles auf denselben Tag", () => {
    const tasks = [1, 2, 3, 4, 5].map((n) =>
      task({ id: `a${n}`, dueDate: addDays(heute, -n) }),
    );
    const result = replan(tasks, stand(["t1", "weak"]), klausur, heute);

    const proTag = new Map<number, number>();
    for (const m of result.move) {
      const offset = daysBetween(heute, m.dueDate);
      proTag.set(offset, (proTag.get(offset) ?? 0) + 1);
    }
    for (const anzahl of proTag.values()) expect(anzahl).toBeLessThanOrEqual(2);
  });

  it("beruecksichtigt, was an den Tagen schon liegt", () => {
    const tasks = [
      task({ id: "heute1", dueDate: heute }),
      task({ id: "heute2", dueDate: heute }),
      task({ id: "alt", dueDate: addDays(heute, -2) }),
    ];
    const result = replan(tasks, stand(["t1", "weak"]), klausur, heute);

    // Heute liegen schon zwei - die alte Aufgabe muss weiter nach hinten.
    expect(daysBetween(heute, result.move[0].dueDate)).toBeGreaterThan(0);
  });

  it("schiebt nie auf oder hinter den Klausurtag", () => {
    const eng = addDays(heute, 2);
    const tasks = [1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
      task({ id: `a${n}`, dueDate: addDays(heute, -n) }),
    );
    const result = replan(tasks, stand(["t1", "weak"]), eng, heute);

    for (const m of result.move) {
      expect(m.dueDate.getTime()).toBeLessThan(eng.getTime());
    }
  });

  it("verschiebt nichts, was ohnehin entfaellt", () => {
    const result = replan(
      [task({ id: "a", dueDate: addDays(heute, -3) })],
      stand(["t1", "strong"]),
      klausur,
      heute,
    );
    expect(result.skip).toEqual(["a"]);
    expect(result.move).toEqual([]);
  });
});
