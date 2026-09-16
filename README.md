# Schuelerplattform

Eine Lernplattform für Schülerinnen und Schüler mit zwei Funktionen, die
aufeinander aufbauen:

1. **Lernplan mit Auswertung** – Klausurdatum, Fach und Themen eintragen, einen
   kurzen Selbsttest machen und daraus eine Auswertung plus einen auf die Tage
   bis zur Klausur verteilten Lernplan bekommen.
2. **Nachhilfe unter Mitschülern** – wo die Auswertung Lücken zeigt, schlägt die
   App Mitschüler vor, die genau in diesem Fach und Thema helfen können. Eine
   Anfrage lässt sich direkt stellen, annehmen oder ablehnen.

Der zweite Punkt hängt am ersten: Die erkannten Defizite sind der Suchbegriff
für die Tutorensuche.

## Schnellstart

```bash
npm install
cp .env.example .env
npx prisma migrate dev     # legt die SQLite-Datenbank an
npm run seed               # Beispieldaten
npm run dev                # http://localhost:3000
```

Alle Beispielkonten haben das Passwort `geheim123`:

| E-Mail | Rolle im Beispiel |
|---|---|
| `lena@schule.de` | hat eine fertig ausgewertete Mathe-Klausur mit Lernplan |
| `jonas@schule.de` | gibt Nachhilfe in Mathe und Physik, hat eine offene Anfrage |
| `mira@schule.de` | gibt Nachhilfe in Mathe bis Klasse 13 |
| `paul@schule.de` | hat eine Anfrage an Jonas gestellt |

## KI-Auswertung

Die Auswertung läuft über die Claude API (Modell `claude-opus-5`). Das
Antwortformat wird über ein Zod-Schema erzwungen (`messages.parse()` mit
`zodOutputFormat`), es wird also kein Freitext geparst.

**Ohne API-Schlüssel funktioniert die App vollständig.** Dann greift eine
regelbasierte Auswertung, und das Ergebnis wird in der Oberfläche als solches
gekennzeichnet. Dasselbe passiert, wenn ein API-Aufruf fehlschlägt – wer kurz
vor einer Klausur sitzt, soll nicht vor einer Fehlerseite stehen.

Mit Schlüssel:

```bash
echo 'ANTHROPIC_API_KEY="sk-ant-..."' >> .env
```

Der Unterschied:

| | mit Schlüssel | ohne Schlüssel |
|---|---|---|
| Fragen | fachliche Multiple-Choice- und Freitextfragen zum Thema | Reflexionsfragen pro Thema |
| Auswertung | inhaltliche Bewertung der Antworten | Selbsteinschätzung, Multiple-Choice-Quote und Bearbeitungstiefe |
| Lücken | mit fachlicher Begründung und Schwerpunkt | anhand der Selbsteinschätzung |

Die regelbasierte Variante erfindet bewusst **keine** Multiple-Choice-Fragen:
Ohne Fachwissen wären die als richtig markierten Lösungen geraten.

## Wie der Lernplan entsteht

Die KI liefert nur, **was** gelernt werden muss und wie gravierend die Lücke
ist. **Wann** gelernt wird, rechnet `lib/planning.ts` deterministisch aus:

- schwerste Lücken zuerst und früh,
- Wiederholungen im Abstand von 3 und 7 Tagen (Spaced Repetition), bei viel
  Vorlaufzeit gestreckt, damit die letzte Wiederholung nicht Wochen vor der
  Klausur liegt,
- der letzte Tag vor der Klausur bleibt für eine Generalprobe frei.

Dadurch kann kein Termin hinter dem Klausurdatum landen, und die Verteilung ist
testbar statt vom Modell abhängig.

## Aufbau

```
app/                 Seiten (App Router) und Route Handler unter app/api/
components/          gemeinsame UI-Bausteine
lib/
  ai/                Auswertung: Interface, Claude-Anbindung, regelbasierter Fallback
  planning.ts        verteilt Lernaufgaben auf Kalendertage
  matching.ts        bewertet Nachhilfe-Angebote gegen ein Defizit
  tutors.ts          Datenzugriff für die Tutorensuche
  auth.ts            E-Mail/Passwort-Anmeldung mit Session-Cookie
prisma/              Datenmodell, Migrationen, Beispieldaten
tests/               Vitest-Tests für die Logik
```

Lesende Seiten greifen als Server Components direkt auf Prisma zu, alle
Schreibzugriffe laufen über Route Handler mit Zod-Validierung.

## Tests

```bash
npm test         # 29 Tests: Terminverteilung, Matching, Fallback, KI-Schemas
npm run build    # Typprüfung und Produktionsbuild
```

Die Tests brauchen keinen API-Schlüssel.

## Hinweise zur Technik

- **Prisma 7**: Die Verbindungs-URL steht in `prisma.config.ts`, nicht im
  Schema, und der Client bekommt einen Treiber-Adapter
  (`@prisma/adapter-better-sqlite3`). `prisma` und `@prisma/client` sind bewusst
  auf `7.10.0` gepinnt, weil der `latest`-Tag der CLI derzeit auf einen
  Release Candidate zeigt.
- **SQLite**: Prisma unterstützt hier weder `enum`-Typen noch Array-Felder.
  Aufzählungen liegen als String vor, die erlaubten Werte stehen in
  `lib/constants.ts`. Listen werden als JSON-String abgelegt und nur über einen
  Zod-Parser gelesen.
- **Umstieg auf Postgres**: `provider` in `prisma/schema.prisma` ändern, den
  Adapter in `lib/db.ts` tauschen, neu migrieren.

## Was als Nächstes sinnvoll wäre

- Terminvereinbarung und Nachrichten in der App (aktuell wird nach einer Zusage
  die E-Mail-Adresse ausgetauscht)
- Rückmeldung nach der Klausur, um die Treffsicherheit der Auswertung zu prüfen
- Bewertungen für Nachhilfe, damit gute Erklärer sichtbar werden
