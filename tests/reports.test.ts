import { describe, expect, it } from "vitest";

import {
  canBlock,
  canBlockAccounts,
  describeReason,
  describeTarget,
  isBlocked,
  snapshot,
  SNAPSHOT_MAX,
} from "@/lib/reports";

const lehrerVerwaltung = { id: "baumann", kind: "teacher" as const, isAdmin: true };
const schuelerVerwaltung = { id: "mira", kind: "student" as const, isAdmin: true };
const lehrerOhneRechte = { id: "olsen", kind: "teacher" as const, isAdmin: false };

describe("canBlockAccounts", () => {
  it("laesst nur Lehrkraefte mit Verwaltungsrechten sperren", () => {
    expect(canBlockAccounts(lehrerVerwaltung)).toBe(true);
  });

  it("laesst eine Schuelerin mit Verwaltungsrechten nicht sperren", () => {
    // Sie darf die Schule mitverwalten - aber einer Mitschuelerin den Zugang
    // abzudrehen ist ein Machtmittel unter Gleichaltrigen.
    expect(canBlockAccounts(schuelerVerwaltung)).toBe(false);
  });

  it("laesst eine Lehrkraft ohne Verwaltungsrechte nicht sperren", () => {
    expect(canBlockAccounts(lehrerOhneRechte)).toBe(false);
  });
});

describe("canBlock", () => {
  const schueler = { id: "tom", isAdmin: false };

  it("erlaubt der Lehrkraft, ein Schuelerkonto zu sperren", () => {
    expect(canBlock(lehrerVerwaltung, schueler)).toBe(true);
  });

  it("laesst niemanden sich selbst sperren", () => {
    expect(canBlock(lehrerVerwaltung, { id: "baumann", isAdmin: true })).toBe(false);
  });

  it("schuetzt andere Verwalter", () => {
    // Erst aus der Verwaltung nehmen, dann sperren - sonst koennten sich
    // zwei Verwalter gegenseitig aussperren.
    expect(canBlock(lehrerVerwaltung, { id: "mira", isAdmin: true })).toBe(false);
  });

  it("nuetzt einer Schuelerin auch bei einem Schuelerkonto nichts", () => {
    expect(canBlock(schuelerVerwaltung, schueler)).toBe(false);
  });
});

describe("isBlocked", () => {
  it("haengt am Zeitpunkt", () => {
    expect(isBlocked({ blockedAt: null })).toBe(false);
    expect(isBlocked({ blockedAt: new Date() })).toBe(true);
  });
});

describe("snapshot", () => {
  it("nimmt kurzen Text unveraendert", () => {
    expect(snapshot("  Das ist gemein.  ")).toBe("Das ist gemein.");
  });

  it("kuerzt sehr langen Text und zeigt das an", () => {
    const lang = "a".repeat(SNAPSHOT_MAX + 50);
    const gekuerzt = snapshot(lang);

    expect(gekuerzt.startsWith("a".repeat(SNAPSHOT_MAX))).toBe(true);
    expect(gekuerzt.endsWith("[…]")).toBe(true);
  });
});

describe("Beschriftungen", () => {
  it("uebersetzt Grund und Art", () => {
    expect(describeReason("insult")).toBe("Beleidigend oder verletzend");
    expect(describeTarget("message")).toBe("Nachricht");
    expect(describeTarget("offer")).toBe("Nachhilfe-Angebot");
    expect(describeTarget("rating")).toBe("Bewertung");
  });
});
