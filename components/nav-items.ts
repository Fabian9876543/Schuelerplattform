/** Die Navigationspunkte für angemeldete Nutzer - genutzt von der breiten
 *  Leiste und vom ausklappbaren Menü, damit beide nicht auseinanderlaufen. */
export const NAV_ITEMS = [
  { href: "/", label: "Meine Klausuren" },
  { href: "/nachhilfe", label: "Nachhilfe finden" },
  { href: "/nachhilfe/anbieten", label: "Nachhilfe geben" },
  { href: "/anfragen", label: "Anfragen" },
] as const;
