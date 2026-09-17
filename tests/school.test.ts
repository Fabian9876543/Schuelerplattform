import { describe, expect, it } from "vitest";

import { SUBJECTS } from "@/lib/constants";
import {
  allowedSubjects,
  canChangeRole,
  canOfferSubject,
  isAdmin,
  offerVisible,
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
  it("unterscheidet die Rollen", () => {
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("student")).toBe(false);
  });
});
