import { describe, expect, it } from "vitest";

import {
  inQuietHours,
  notificationFor,
  QUIET_FROM,
  QUIET_UNTIL,
  shouldSend,
  withoutActor,
} from "@/lib/push";

const um = (stunde: number, minute = 0) => new Date(2026, 8, 17, stunde, minute);

describe("notificationFor", () => {
  it("nennt bei einer Nachricht den Absender, aber nicht den Inhalt", () => {
    // Der Kern der Entscheidung: Eine Benachrichtigung liest jeder mit, der
    // auf das liegende Handy schaut.
    const inhalt = notificationFor({ art: "nachricht", von: "Mira Sahin", requestId: "r1" });

    expect(inhalt.body).toBe("Mira Sahin hat dir geschrieben.");
    expect(inhalt.url).toBe("/anfragen/r1");
  });

  it("fuehrt bei einer Zusage in den Verlauf, bei einer Absage in die Suche", () => {
    const zu = notificationFor({ art: "beantwortet", von: "Jonas", zugesagt: true, requestId: "r1" });
    const ab = notificationFor({ art: "beantwortet", von: "Jonas", zugesagt: false, requestId: "r1" });

    expect(zu.url).toBe("/anfragen/r1");
    // Nach einer Absage hilft der Verlauf nicht weiter - die Suche schon.
    expect(ab.url).toBe("/nachhilfe");
  });

  it("verraet bei einer Meldung nichts ueber Inhalt oder Beteiligte", () => {
    const inhalt = notificationFor({ art: "meldung" });

    expect(inhalt.body).not.toMatch(/[A-Z][a-z]+ [A-Z][a-z]+/); // kein Name
    expect(inhalt.url).toBe("/schule");
  });

  it("fasst Nachrichten aus demselben Verlauf zusammen", () => {
    // Gleiche Marke = die zweite Benachrichtigung ersetzt die erste, statt
    // sich daneben zu legen.
    const a = notificationFor({ art: "nachricht", von: "Mira", requestId: "r1" });
    const b = notificationFor({ art: "nachricht", von: "Mira", requestId: "r1" });
    const anderer = notificationFor({ art: "nachricht", von: "Tom", requestId: "r2" });

    expect(a.tag).toBe(b.tag);
    expect(a.tag).not.toBe(anderer.tag);
  });

  it("legt Terminvorschlag und Entscheidung auf dieselbe Marke", () => {
    // Der zugesagte Termin ersetzt den Vorschlag - beides gleichzeitig
    // anzuzeigen waere widerspruechlich.
    const vorschlag = notificationFor({ art: "terminvorschlag", von: "Mira", wann: "Mi, 15:00", requestId: "r1" });
    const zusage = notificationFor({ art: "terminentschieden", von: "Mira", wann: "Mi, 15:00", zugesagt: true, requestId: "r1" });

    expect(vorschlag.tag).toBe(zusage.tag);
  });

  describe("Erinnerung", () => {
    it("zaehlt Aufgaben und nennt den naechsten Termin", () => {
      const inhalt = notificationFor({ art: "erinnerung", offeneAufgaben: 2, naechsterTermin: "morgen 15:00" });
      expect(inhalt.body).toBe("2 Lernaufgaben offen · Termin morgen 15:00");
    });

    it("beugt bei einer einzelnen Aufgabe", () => {
      const inhalt = notificationFor({ art: "erinnerung", offeneAufgaben: 1, naechsterTermin: null });
      expect(inhalt.body).toBe("1 Lernaufgabe offen");
    });

    it("nennt einen Termin auch ohne offene Aufgaben", () => {
      const inhalt = notificationFor({ art: "erinnerung", offeneAufgaben: 0, naechsterTermin: "heute 16:00" });
      expect(inhalt.body).toBe("Termin heute 16:00");
    });
  });
});

describe("inQuietHours", () => {
  it("schweigt von 22 bis 7 Uhr", () => {
    expect(inQuietHours(um(QUIET_FROM - 1, 59))).toBe(false);
    expect(inQuietHours(um(QUIET_FROM))).toBe(true);
    expect(inQuietHours(um(3))).toBe(true);
    expect(inQuietHours(um(QUIET_UNTIL - 1, 59))).toBe(true);
    expect(inQuietHours(um(QUIET_UNTIL))).toBe(false);
  });
});

describe("shouldSend", () => {
  const nachricht = { art: "nachricht", von: "Mira", requestId: "r1" } as const;

  it("haelt Ereignisse in der Nachtruhe zurueck", () => {
    expect(shouldSend(nachricht, um(15))).toBe(true);
    expect(shouldSend(nachricht, um(23))).toBe(false);
  });

  it("laesst die Erinnerung immer durch", () => {
    // Sie kommt vom Zeitplan und liegt ohnehin am Nachmittag; eine
    // Sonderpruefung waere nur eine zweite Stelle, die falsch sein kann.
    expect(shouldSend({ art: "erinnerung", offeneAufgaben: 1, naechsterTermin: null }, um(23))).toBe(true);
  });
});

describe("withoutActor", () => {
  it("laesst die handelnde Person aus", () => {
    // Wer etwas tut, braucht darueber keine Benachrichtigung.
    expect(withoutActor(["mira", "baumann"], "mira")).toEqual(["baumann"]);
  });

  it("entfernt Doppelte", () => {
    expect(withoutActor(["a", "a", "b"], "c")).toEqual(["a", "b"]);
  });

  it("kann leer ausgehen", () => {
    expect(withoutActor(["mira"], "mira")).toEqual([]);
  });
});
