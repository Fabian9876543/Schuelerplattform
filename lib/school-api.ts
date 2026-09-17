import { fail } from "@/lib/api";
import type { SessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/school";

/**
 * Die Eintrittskarte fuer alle Verwaltungs-Routen.
 *
 * Gibt eine Fehlerantwort zurueck, wenn die Person nichts zu verwalten hat -
 * sonst null. So steht die Pruefung in jeder Route in einer Zeile und kann
 * nicht mit einem `return` uebersehen werden.
 */
export function denyIfNotAdmin(user: SessionUser) {
  if (!isAdmin(user.role)) {
    // Keine Erklaerung, woran es liegt: Wer hier nichts verloren hat, soll
    // auch nicht erfahren, dass es diese Schnittstelle gibt.
    return fail("Das gibt es nicht.", 404);
  }
  return null;
}
