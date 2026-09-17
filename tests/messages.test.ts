import { describe, expect, it } from "vitest";

import { canWrite, describeUnread, participantRole } from "@/lib/messages";

const BETEILIGTE = { requesterId: "lena", tutorUserId: "jonas" };

describe("participantRole", () => {
  it("erkennt die anfragende Person", () => {
    expect(participantRole(BETEILIGTE, "lena")).toBe("requester");
  });

  it("erkennt die angefragte Person", () => {
    expect(participantRole(BETEILIGTE, "jonas")).toBe("tutor");
  });

  // Der eigentliche Punkt dieser Datei: Ein Dritter darf einen fremden
  // Verlauf nicht einmal lesen. Faellt diese Zeile um, faellt die Abschottung.
  it("laesst Unbeteiligte nicht hinein", () => {
    expect(participantRole(BETEILIGTE, "mia")).toBeNull();
  });

  it("verwechselt die Rollen nicht ueber leere IDs", () => {
    expect(participantRole({ requesterId: "", tutorUserId: "" }, "")).toBe("requester");
    expect(participantRole(BETEILIGTE, "")).toBeNull();
  });
});

describe("canWrite", () => {
  it("erlaubt Schreiben erst nach einer Zusage", () => {
    expect(canWrite("accepted")).toBe(true);
  });

  it("sperrt offene, abgelehnte und zurueckgezogene Anfragen", () => {
    expect(canWrite("open")).toBe(false);
    expect(canWrite("declined")).toBe(false);
    expect(canWrite("withdrawn")).toBe(false);
  });
});

describe("describeUnread", () => {
  it("zaehlt kurz", () => {
    expect(describeUnread(1)).toBe("1 neu");
    expect(describeUnread(7)).toBe("7 neu");
  });
});
