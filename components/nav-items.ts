/** Die Navigationspunkte für angemeldete Nutzer - genutzt von der breiten
 *  Leiste und vom ausklappbaren Menü, damit beide nicht auseinanderlaufen. */
export const NAV_ITEMS = [
  // studentOnly: Lehrkräfte haben keine Klausuren und nehmen an der Nachhilfe
  // nicht teil - diese Seiten gibt es für sie nicht.
  { href: "/", label: "Meine Klausuren", studentOnly: true },
  { href: "/kalender", label: "Kalender", studentOnly: true },
  { href: "/nachhilfe", label: "Nachhilfe finden", studentOnly: true },
  { href: "/nachhilfe/anbieten", label: "Nachhilfe geben", studentOnly: true },
  // Hier landen die Nachrichtenverläufe, deshalb hängt der Zähler an diesem
  // Punkt. Als Eigenschaft am Eintrag statt als abgefragte Adresse: Zieht der
  // Punkt um, wandert der Zähler mit.
  { href: "/anfragen", label: "Anfragen", showsUnread: true, studentOnly: true },
  // Nur für Verwalter - egal ob Schülerin oder Lehrkraft.
  { href: "/schule", label: "Schule", adminOnly: true },
] as const;

/**
 * Die Punkte, die dieses Konto sehen soll. Das ist kein Schutz, sondern
 * Aufräumen: Jede Seite weist Unbefugte selbst ab.
 */
export function sichtbareNavItems(user: { kind: string; isAdmin: boolean }) {
  return NAV_ITEMS.filter((item) => {
    if ("adminOnly" in item && !user.isAdmin) return false;
    if ("studentOnly" in item && user.kind !== "student") return false;
    return true;
  });
}
