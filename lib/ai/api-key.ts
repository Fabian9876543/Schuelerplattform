/**
 * Findet den API-Schlüssel für die Auswertung.
 *
 * Zwei Namen werden akzeptiert, in dieser Reihenfolge:
 *
 *   SCHUELERPLATTFORM_ANTHROPIC_KEY  - nur für diese App
 *   ANTHROPIC_API_KEY                - der übliche Name
 *
 * Der eigene Name existiert wegen einer Falle: Claude Code selbst bevorzugt
 * ANTHROPIC_API_KEY gegenüber der Anmeldung über das Abo. Wer den Schlüssel
 * unter diesem Namen in einer Cloud-Umgebung hinterlegt, bezahlt damit
 * unbeabsichtigt auch die eigene Claude-Code-Nutzung aus dem API-Guthaben.
 * Unter dem eigenen Namen kann das nicht passieren.
 */
export function findApiKey(): string | undefined {
  const eigener = process.env.SCHUELERPLATTFORM_ANTHROPIC_KEY?.trim();
  if (eigener) return eigener;

  const ueblicher = process.env.ANTHROPIC_API_KEY?.trim();
  return ueblicher || undefined;
}

/** Unter welchem Namen der Schlüssel gefunden wurde - für Meldungen. */
export function apiKeySource(): string | null {
  if (process.env.SCHUELERPLATTFORM_ANTHROPIC_KEY?.trim()) return "SCHUELERPLATTFORM_ANTHROPIC_KEY";
  if (process.env.ANTHROPIC_API_KEY?.trim()) return "ANTHROPIC_API_KEY";
  return null;
}
