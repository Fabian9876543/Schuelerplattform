import { describe, expect, it } from "vitest";

import { addDays, buildStudyPlan, daysBetween, type PlanDeficit } from "@/lib/planning";

const today = new Date("2026-03-01T12:00:00");

function deficit(name: string, severity: number): PlanDeficit {
  return { topicId: `t-${name}`, topicName: name, severity };
}

describe("buildStudyPlan", () => {
  it("legt keine Aufgabe auf oder nach den Klausurtag", () => {
    const exam = addDays(today, 10);
    const tasks = buildStudyPlan([deficit("Ableitungen", 3), deficit("Integrale", 2)], exam, today);

    expect(tasks.length).toBeGreaterThan(0);
    for (const task of tasks) {
      expect(task.dueDate.getTime()).toBeLessThan(exam.getTime());
      expect(task.dueDate.getTime()).toBeGreaterThanOrEqual(today.getTime());
    }
  });

  it("nimmt die schwerste Luecke zuerst dran", () => {
    const exam = addDays(today, 14);
    const tasks = buildStudyPlan([deficit("Leicht", 1), deficit("Schwer", 3)], exam, today);

    const firstSchwer = tasks.find((t) => t.title.startsWith("Schwer"))!;
    const firstLeicht = tasks.find((t) => t.title.startsWith("Leicht"))!;
    expect(firstSchwer.dueDate.getTime()).toBeLessThanOrEqual(firstLeicht.dueDate.getTime());
  });

  it("gibt gravierenden Luecken mehr Einheiten als leichten", () => {
    const exam = addDays(today, 14);
    const tasks = buildStudyPlan([deficit("Schwer", 3), deficit("Leicht", 1)], exam, today);

    const schwer = tasks.filter((t) => t.topicId === "t-Schwer");
    const leicht = tasks.filter((t) => t.topicId === "t-Leicht");
    expect(schwer.length).toBeGreaterThan(leicht.length);
  });

  it("endet mit einer Generalprobe am letzten Lerntag", () => {
    const exam = addDays(today, 7);
    const tasks = buildStudyPlan([deficit("Ableitungen", 2)], exam, today);

    const last = tasks[tasks.length - 1];
    expect(last.title).toBe("Generalprobe vor der Klausur");
    expect(daysBetween(last.dueDate, exam)).toBe(1);
  });

  it("kommt mit sehr wenig Zeit zurecht", () => {
    const exam = addDays(today, 1);
    const tasks = buildStudyPlan([deficit("Ableitungen", 3), deficit("Integrale", 3)], exam, today);

    expect(tasks.length).toBeGreaterThan(0);
    for (const task of tasks) {
      expect(daysBetween(today, task.dueDate)).toBe(0);
    }
  });

  it("plant nichts, wenn die Klausur schon vorbei ist", () => {
    expect(buildStudyPlan([deficit("Ableitungen", 3)], addDays(today, -2), today)).toEqual([]);
  });

  it("plant nichts ohne erkannte Luecken", () => {
    expect(buildStudyPlan([], addDays(today, 10), today)).toEqual([]);
  });

  it("uebernimmt den Schwerpunkt aus der Auswertung in die Aufgabe", () => {
    const exam = addDays(today, 10);
    const tasks = buildStudyPlan(
      [{ topicId: "t1", topicName: "Ableitungen", severity: 3, focus: "Kettenregel" }],
      exam,
      today,
    );

    expect(tasks[0].description).toContain("Kettenregel");
  });
});
