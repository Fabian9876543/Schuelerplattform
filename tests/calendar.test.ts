import { describe, expect, it } from "vitest";

import {
  buildMonthGrid,
  dayKey,
  monthKey,
  monthLabel,
  parseDayKey,
  parseMonthKey,
  shiftMonth,
  startOfMonth,
} from "@/lib/calendar";

describe("dayKey", () => {
  it("nimmt die oertlichen Bestandteile, nicht UTC", () => {
    // Spaet am Abend: toISOString() wuerde in Mitteleuropa schon den
    // naechsten Tag liefern und der Termin landete im Kalender einen Tag
    // zu spaet.
    const spaetabends = new Date(2026, 8, 17, 23, 30);
    expect(dayKey(spaetabends)).toBe("2026-09-17");
  });

  it("fuellt einstellige Zahlen auf", () => {
    expect(dayKey(new Date(2026, 0, 5, 12))).toBe("2026-01-05");
    expect(monthKey(new Date(2026, 0, 5, 12))).toBe("2026-01");
  });
});

describe("shiftMonth", () => {
  it("springt vom 31. nicht ueber den Februar hinweg", () => {
    // Vom 31. Januar aus wuerde ein naives +1 Monat im Maerz landen.
    const januar31 = new Date(2026, 0, 31, 12);
    expect(monthKey(shiftMonth(januar31, 1))).toBe("2026-02");
  });

  it("geht ueber den Jahreswechsel", () => {
    expect(monthKey(shiftMonth(new Date(2026, 11, 15, 12), 1))).toBe("2027-01");
    expect(monthKey(shiftMonth(new Date(2026, 0, 15, 12), -1))).toBe("2025-12");
  });
});

describe("parseMonthKey / parseDayKey", () => {
  it("liest gueltige Schluessel", () => {
    expect(monthKey(parseMonthKey("2026-09")!)).toBe("2026-09");
    expect(dayKey(parseDayKey("2026-09-17")!)).toBe("2026-09-17");
  });

  it("weist Unsinn aus der Adresszeile ab", () => {
    for (const wert of [undefined, "", "September", "2026-13", "2026-9", "2026-09-31", "2026-02-30"]) {
      expect(parseMonthKey(wert)).toBeNull();
    }
    for (const wert of [undefined, "", "heute", "2026-09", "2026-02-30", "2026-04-31"]) {
      expect(parseDayKey(wert)).toBeNull();
    }
  });
});

describe("buildMonthGrid", () => {
  const raster = buildMonthGrid(new Date(2026, 8, 1, 12), new Date(2026, 8, 17, 12));

  it("liefert volle Wochen", () => {
    expect(raster.every((woche) => woche.length === 7)).toBe(true);
  });

  it("beginnt montags", () => {
    // 1. September 2026 ist ein Dienstag - davor steht Montag, der 31. August.
    expect(raster[0][0].key).toBe("2026-08-31");
    expect(raster[0][0].inMonth).toBe(false);
    expect(raster[0][1].key).toBe("2026-09-01");
    expect(raster[0][1].inMonth).toBe(true);
  });

  it("enthaelt jeden Tag des Monats genau einmal", () => {
    const eigene = raster.flat().filter((tag) => tag.inMonth);
    expect(eigene).toHaveLength(30);
    expect(new Set(eigene.map((tag) => tag.key)).size).toBe(30);
    expect(eigene[0].key).toBe("2026-09-01");
    expect(eigene.at(-1)!.key).toBe("2026-09-30");
  });

  it("markiert genau einen Tag als heute", () => {
    const heute = raster.flat().filter((tag) => tag.isToday);
    expect(heute).toHaveLength(1);
    expect(heute[0].key).toBe("2026-09-17");
  });

  it("kommt auch mit einem Februar zurecht, der montags beginnt", () => {
    // Februar 2027 beginnt an einem Montag und hat 28 Tage: genau vier Wochen,
    // ohne einen einzigen Tag aus dem Nachbarmonat.
    const februar = buildMonthGrid(new Date(2027, 1, 1, 12), new Date(2027, 1, 1, 12));
    expect(februar).toHaveLength(4);
    expect(februar.flat().every((tag) => tag.inMonth)).toBe(true);
  });

  it("braucht sechs Wochen, wenn ein langer Monat sonntags beginnt", () => {
    // August 2026 beginnt samstags und hat 31 Tage -> sechs Zeilen.
    expect(buildMonthGrid(new Date(2026, 7, 1, 12))).toHaveLength(6);
  });

  it("zeigt heute nirgends an, wenn ein anderer Monat offen ist", () => {
    const anderer = buildMonthGrid(new Date(2026, 2, 1, 12), new Date(2026, 8, 17, 12));
    expect(anderer.flat().some((tag) => tag.isToday)).toBe(false);
  });
});

describe("monthLabel", () => {
  it("schreibt Monat und Jahr aus", () => {
    expect(monthLabel(startOfMonth(new Date(2026, 8, 17, 12)))).toBe("September 2026");
  });
});
