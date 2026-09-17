import { describe, expect, it } from "vitest";

import { SUBJECTS } from "@/lib/constants";
import {
  allowedSubjects,
  canChangeRole,
  canOfferSubject,
  describeGrade,
  isAdmin,
  kindForJoinCode,
  offerVisible,
  takesPartInTutoring,
} from "@/lib/school";

describe("allowedSubjects", () => {
  it("laesst ohne Liste alle Faecher zu", () => {
    // Der wichtigste Fall: Eine leere Liste heisst "keine Einschraenkung".
    // Andersherum waere jede Schule stillgelegt, bis jemand eine pflegt.
    expect(allowedSubjects([])).toEqual(SUBJECTS);
  });

  it("beschraenkt auf die gewaehlten Faecher", () => {
    expect(allowedSubjects(["Mathematik", "Physik"])).toEqual(["Mathematik", "Physik"]);
  });

  it("uebernimmt keine erfundenen Faecher aus der Liste", () => {
    // Auch wenn in der Datenbank Unsinn steht: Angeboten wird nur, was es gibt.
    expect(allowedSubjects(["Mathematik", "Zaubern"])).toEqual(["Mathematik"]);
  });

  it("behaelt die Reihenfolge aus der Faecherliste bei", () => {
    expect(allowedSubjects(["Physik", "Deutsch"])).toEqual(["Deutsch", "Physik"]);
  });
});

describe("canOfferSubject", () => {
  it("erlaubt ohne Liste jedes bekannte Fach", () => {
    expect(canOfferSubject("Chemie", [])).toBe(true);
    expect(canOfferSubject("Zaubern", [])).toBe(false);
  });

  it("haelt sich an die Liste der Schule", () => {
    expect(canOfferSubject("Mathematik", ["Mathematik"])).toBe(true);
    expect(canOfferSubject("Chemie", ["Mathematik"])).toBe(false);
  });
});

describe("offerVisible", () => {
  const freigegeben = { active: true, approved: true };
  const wartend = { active: true, approved: false };

  it("zeigt ohne Freigabepflicht auch unfreigegebene Angebote", () => {
    expect(offerVisible(wartend, false)).toBe(true);
  });

  it("verlangt mit Pflicht die Freigabe", () => {
    expect(offerVisible(wartend, true)).toBe(false);
    expect(offerVisible(freigegeben, true)).toBe(true);
  });

  it("zeigt pausierte Angebote nie", () => {
    expect(offerVisible({ active: false, approved: true }, false)).toBe(false);
    expect(offerVisible({ active: false, approved: true }, true)).toBe(false);
  });
});

describe("canChangeRole", () => {
  it("laesst niemanden sich selbst die Verwaltung entziehen", () => {
    // Sonst stuende die Schule ohne Verwaltung da und koennte keine neue
    // mehr ernennen.
    expect(canChangeRole("admin-1", "admin-1")).toBe(false);
    expect(canChangeRole("admin-1", "schueler-2")).toBe(true);
  });
});

describe("isAdmin", () => {
  it("haengt an den Rechten, nicht an der Kontoart", () => {
    // Eine Schuelerin darf verwalten, eine Lehrkraft muss nicht.
    expect(isAdmin({ isAdmin: true })).toBe(true);
    expect(isAdmin({ isAdmin: false })).toBe(false);
  });
});

describe("takesPartInTutoring", () => {
  it("laesst Lehrkraefte aussen vor", () => {
    // Die Plattform vermittelt Nachhilfe unter Mitschuelern. Eine Lehrkraft
    // in der Trefferliste waere etwas anderes.
    expect(takesPartInTutoring("student")).toBe(true);
    expect(takesPartInTutoring("teacher")).toBe(false);
  });
});

describe("describeGrade", () => {
  it("nennt die Klasse oder die Lehrkraft", () => {
    expect(describeGrade({ kind: "student", gradeLevel: 11 })).toBe("Klasse 11");
    expect(describeGrade({ kind: "teacher", gradeLevel: null })).toBe("Lehrkraft");
  });

  it("faellt bei fehlender Klasse nicht auf 'Klasse null' zurueck", () => {
    expect(describeGrade({ kind: "student", gradeLevel: null })).toBe("Lehrkraft");
  });
});

describe("kindForJoinCode", () => {
  const schule = { joinCode: "GOETHE", teacherJoinCode: "GOETHE-LEHR" };

  it("unterscheidet die beiden Codes", () => {
    expect(kindForJoinCode(schule, "GOETHE")).toBe("student");
    expect(kindForJoinCode(schule, "GOETHE-LEHR")).toBe("teacher");
  });

  it("nimmt es mit Gross- und Kleinschreibung und Leerzeichen nicht genau", () => {
    expect(kindForJoinCode(schule, "  goethe-lehr ")).toBe("teacher");
  });

  it("weist unbekannte Codes ab", () => {
    expect(kindForJoinCode(schule, "HUMBOLDT")).toBeNull();
    expect(kindForJoinCode(schule, "GOETHE-LEHRER")).toBeNull();
  });

  it("laesst eine leere Eingabe nie durchgehen", () => {
    // Sonst kaeme man mit einem leeren Feld in eine Schule, deren Code
    // versehentlich leer ist.
    expect(kindForJoinCode(schule, "")).toBeNull();
    expect(kindForJoinCode({ joinCode: "", teacherJoinCode: "" }, "")).toBeNull();
  });
});
