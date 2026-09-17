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
] as const;
