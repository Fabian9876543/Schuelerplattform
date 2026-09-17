import { fail } from "@/lib/api";
import type { SessionUser } from "@/lib/auth";
import { isAdmin, takesPartInTutoring } from "@/lib/school";

/**
 * Die Eintrittskarte fuer alle Verwaltungs-Routen.
 *
 * Gibt eine Fehlerantwort zurueck, wenn die Person nichts zu verwalten hat -
 * sonst null. So steht die Pruefung in jeder Route in einer Zeile und kann
 * nicht mit einem `return` uebersehen werden.
 */
export function denyIfNotAdmin(user: SessionUser) {
  if (!isAdmin(user)) {
    // Keine Erklaerung, woran es liegt: Wer hier nichts verloren hat, soll
    // auch nicht erfahren, dass es diese Schnittstelle gibt.
    return fail("Das gibt es nicht.", 404);
  }
  return null;
}

/**
 * Fuer Routen, die es nur fuer Schuelerkonten gibt.
 *
 * Gibt entweder eine Fehlerantwort oder das Konto mit gesicherter
 * Klassenstufe zurueck - danach muss keine Route mehr pruefen, ob sie da ist:
 *
 *     const { deny, student } = studentOrDeny(user);
 *     if (deny) return deny;
 *     // student.gradeLevel ist jetzt eine Zahl
 *
 * Anders als bei der Verwaltung steht hier eine echte Erklaerung: Dass es
 * Klausuren und Nachhilfe gibt, ist kein Geheimnis, und eine Lehrkraft soll
 * erfahren, warum es fuer sie nicht weitergeht.
 */
export function studentOrDeny(user: SessionUser) {
  if (!takesPartInTutoring(user.kind) || user.gradeLevel === null) {
    return {
      deny: fail(
        "Das gibt es nur fuer Schuelerkonten: Klausuren, Lernplan und Nachhilfe sind fuer Schuelerinnen und Schueler.",
        403,
      ),
      student: null,
    } as const;
  }
  return { deny: null, student: user as SessionUser & { gradeLevel: number } } as const;
}
