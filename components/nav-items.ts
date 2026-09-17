/** Die Navigationspunkte für angemeldete Nutzer - genutzt von der breiten
 *  Leiste und vom ausklappbaren Menü, damit beide nicht auseinanderlaufen. */
export const NAV_ITEMS = [
  { href: "/", label: "Meine Klausuren" },
  { href: "/kalender", label: "Kalender" },
  { href: "/nachhilfe", label: "Nachhilfe finden" },
  { href: "/nachhilfe/anbieten", label: "Nachhilfe geben" },
  // Hier landen die Nachrichtenverläufe, deshalb hängt der Zähler an diesem
  // Punkt. Als Eigenschaft am Eintrag statt als abgefragte Adresse: Zieht der
  // Punkt um, wandert der Zähler mit.
  { href: "/anfragen", label: "Anfragen", showsUnread: true },
  // Nur fuer Verwalter; die Kopfzeile blendet den Punkt sonst aus.
  { href: "/schule", label: "Schule", adminOnly: true },
] as const;

/**
 * Die Punkte, die dieses Konto sehen soll. Der Verwaltungspunkt ist kein
 * Schutz, sondern Aufraeumen: Die Seite selbst weist Unbefugte ab.
 */
export function sichtbareNavItems(user: { role: string }) {
  return NAV_ITEMS.filter((item) => !("adminOnly" in item) || user.role === "admin");
}
