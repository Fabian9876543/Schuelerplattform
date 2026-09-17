import { describe, expect, it } from "vitest";

import {
  canCancel,
  describeSoon,
  canConfirm,
  canPropose,
  endOf,
  formatAppointment,
  isPast,
  overlaps,
  parseLocalDateTime,
  toLocalDateTimeValue,
} from "@/lib/appointments";

const termin = (iso: string, dauer: number) => ({
  startsAt: parseLocalDateTime(iso)!,
  durationMinutes: dauer,
});

describe("parseLocalDateTime", () => {
  it("liest den Wert eines datetime-local-Feldes", () => {
    const datum = parseLocalDateTime("2026-09-23T15:00")!;
    expect(datum.getFullYear()).toBe(2026);
    expect(datum.getMonth()).toBe(8);
    expect(datum.getDate()).toBe(23);
    expect(datum.getHours()).toBe(15);
    expect(datum.getMinutes()).toBe(0);
  });

  it("nimmt die Zeit so, wie sie eingetippt wurde", () => {
    // Der Punkt der Wanduhrzeit: Was hereingeht, kommt heraus - unabhaengig
    // davon, in welcher Zeitzone der Server laeuft.
    expect(toLocalDateTimeValue(parseLocalDateTime("2026-09-23T15:00")!)).toBe("2026-09-23T15:00");
  });

  it("weist Unsinn ab, statt ihn zurechtzubiegen", () => {
    for (const wert of [undefined, null, "", "morgen", "2026-09-23", "2026-13-01T10:00", "2026-02-30T10:00", "2026-09-23T25:00", "2026-09-23T10:70"]) {
      expect(parseLocalDateTime(wert)).toBeNull();
    }
  });
});

describe("overlaps", () => {
  const nachmittag = termin("2026-09-23T15:00", 60);

  it("erkennt eine echte Ueberschneidung", () => {
    expect(overlaps(nachmittag, termin("2026-09-23T15:30", 60))).toBe(true);
    expect(overlaps(termin("2026-09-23T14:30", 60), nachmittag)).toBe(true);
  });

  it("erkennt den umschlossenen Termin", () => {
    expect(overlaps(nachmittag, termin("2026-09-23T15:15", 15))).toBe(true);
  });

  it("laesst zwei Termine aneinander anschliessen", () => {
    // 15:00-16:00 und 16:00-17:00 gehen nacheinander; wuerde das als
    // Ueberschneidung gelten, liesse sich kein Doppelblock legen.
    expect(overlaps(nachmittag, termin("2026-09-23T16:00", 60))).toBe(false);
  });

  it("sieht an anderen Tagen keine Ueberschneidung", () => {
    expect(overlaps(nachmittag, termin("2026-09-24T15:00", 60))).toBe(false);
  });
});

describe("endOf und formatAppointment", () => {
  it("rechnet das Ende aus der Dauer", () => {
    expect(toLocalDateTimeValue(endOf(termin("2026-09-23T15:00", 90)))).toBe("2026-09-23T16:30");
  });

  it("schreibt Tag und Zeitspanne aus", () => {
    expect(formatAppointment(termin("2026-09-23T15:00", 60))).toBe(
      "Mi., 23.09.2026, 15:00–16:00 Uhr",
    );
  });
});

describe("isPast", () => {
  it("vergleicht mit dem uebergebenen Jetzt", () => {
    const jetzt = parseLocalDateTime("2026-09-23T15:00")!;
    expect(isPast(parseLocalDateTime("2026-09-23T14:59")!, jetzt)).toBe(true);
    expect(isPast(parseLocalDateTime("2026-09-23T15:01")!, jetzt)).toBe(false);
  });
});

describe("Wer darf was", () => {
  it("laesst Termine erst nach einer Zusage zu", () => {
    expect(canPropose("accepted")).toBe(true);
    expect(canPropose("open")).toBe(false);
    expect(canPropose("declined")).toBe(false);
    expect(canPropose("withdrawn")).toBe(false);
  });

  it("laesst nur die andere Seite zusagen", () => {
    const vorschlag = { status: "proposed" as const, proposedById: "lena" };
    expect(canConfirm(vorschlag, "jonas")).toBe(true);
    // Sonst waere der Termin einseitig gesetzt und die Zusage ein leeres Wort.
    expect(canConfirm(vorschlag, "lena")).toBe(false);
  });

  it("laesst einen bereits zugesagten Termin nicht noch einmal zusagen", () => {
    expect(canConfirm({ status: "confirmed", proposedById: "lena" }, "jonas")).toBe(false);
    expect(canConfirm({ status: "cancelled", proposedById: "lena" }, "jonas")).toBe(false);
  });

  it("laesst absagen, solange der Termin steht", () => {
    expect(canCancel({ status: "proposed" })).toBe(true);
    expect(canCancel({ status: "confirmed" })).toBe(true);
    expect(canCancel({ status: "cancelled" })).toBe(false);
  });
});

describe("describeSoon", () => {
  const jetzt = parseLocalDateTime("2026-09-23T10:00")!;

  it("sagt heute und morgen statt eines Datums", () => {
    // In einer Benachrichtigung ist "morgen 15:00" sofort verstaendlich.
    expect(describeSoon(parseLocalDateTime("2026-09-23T16:00")!, jetzt)).toBe("heute 16:00");
    expect(describeSoon(parseLocalDateTime("2026-09-24T15:00")!, jetzt)).toBe("morgen 15:00");
  });

  it("nennt weiter entfernte Termine mit Datum", () => {
    expect(describeSoon(parseLocalDateTime("2026-09-26T15:00")!, jetzt)).toBe("Sa., 26.09.2026, 15:00");
  });

  it("zaehlt in Kalendertagen, nicht in Stunden", () => {
    // 23:30 heute und 00:30 morgen liegen eine Stunde auseinander, aber an
    // verschiedenen Tagen - und genau das interessiert.
    expect(describeSoon(parseLocalDateTime("2026-09-23T23:30")!, jetzt)).toBe("heute 23:30");
    expect(describeSoon(parseLocalDateTime("2026-09-24T00:30")!, jetzt)).toBe("morgen 00:30");
  });
});
