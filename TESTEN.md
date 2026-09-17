# Einmal durch die App

Sechzehn Schritte, die jede gebaute Funktion einmal zeigen. Dauert etwa zwölf
Minuten. Passwort für **alle** Konten: `geheim123`.

Die Schritte bauen aufeinander auf – wenn du eine Anfrage stellst, brauchst du
sie im nächsten Schritt wieder.

## Vorher

```bash
npm install
cp .env.example .env       # DATABASE_URL eintragen (siehe README)
npm run db:deploy          # Tabellen anlegen
npm run seed               # Beispieldaten
npm run dev                # http://localhost:3000
```

> **Ohne API-Schlüssel** läuft die regelbasierte Auswertung. Sie erzeugt nur
> Freitextfragen und richtet sich nach der Selbsteinschätzung statt nach den
> Antworten – das ist die eingebaute Rückfallebene, kein Fehler. Dasselbe gilt
> für „Erklär's mir" in Schritt 15: Ohne Schlüssel steht dort kein Fachtext sondern
> der Weg, wie man sich ein Thema selbst erarbeitet – ausdrücklich als
> Rückfallebene gekennzeichnet. Mit Schlüssel
> (`ANTHROPIC_API_KEY` in der `.env`) übernimmt Claude Fragen, Auswertung und
> Erklärungen; ein Durchlauf kostet rund 0,16 USD, eine Erklärung grob 0,04 USD
> und beim zweiten Mal nichts mehr.

## Der Rundgang

### Lernen

**1. Anmelden als `lena@schule.de`.**
Auf der Startseite steht die Mathe-Klausur mit einem farbigen Punkt und
„0 % geschafft". Die Klausur ist in zwölf Tagen.

**2. Klausur öffnen → bei „Kurvendiskussion" auf „Sitzt" klicken.**
Zwei Lernaufgaben entfallen, der Hinweis nennt die Zahl, der Fortschritt springt
auf 33 %. Zurück auf „Sitzt noch nicht" – die Aufgaben sind wieder da. *Der Plan
rechnet mit, statt eine starre Liste zu bleiben.*

**3. „Kalender".**
Der Klausurtag hat einen roten Punkt, die Lerntage eine Zahl. Auf einen Tag
tippen: darunter steht, was ansteht. Pfeile wechseln den Monat.

**4. „Klausur eintragen" → Fach, Datum, zwei bis drei Themen → Selbsttest
ausfüllen → absenden.**
Danach: Auswertung, erkannte Lücken und ein Lernplan, der auf die Tage bis zur
Klausur verteilt ist – der letzte Tag bleibt für die Gesamtwiederholung frei.

### Nachhilfe

**5. Bei einer Lücke auf „Nachhilfe finden".**
Fach und Thema sind vorbelegt. In der Trefferliste stehen Sterne und die Zahl
der Rückmeldungen; wer noch keine hat, steht ausdrücklich als „noch keine
Rueckmeldungen" da – nicht als schlecht bewertet.

**6. Bei Jonas Weber auf „Anfragen" → kurz schreiben → absenden.**

**7. Abmelden, anmelden als `jonas@schule.de` → „Anfragen" → „Zusagen".**
Erst jetzt erscheint „Nachrichten oeffnen". *Vor der Zusage gibt es weder
Nachrichten noch Termine – eine Anfrage ist keine Eintrittskarte in ein fremdes
Postfach.*

**8. Verlauf öffnen → Nachricht schreiben → „Termin vorschlagen"** (Tag, Uhrzeit,
Dauer, optional ein Ort).
Als Jonas kannst du den eigenen Vorschlag **nicht** selbst bestätigen. Wechsle
zu Lena, sag zu – danach steht der Termin in **beiden** Kalendern.

**9. Als Lena unten im Verlauf eine Bewertung abgeben.**
Der Schnitt taucht sofort in der Trefferliste neben dem Namen auf.

**10. Als Lena in der Suche „Mathematik" wählen, ohne Thema.**
Nils und Sara bieten dieselben Themen an – und fehlen. *Die Plattform endet an
der Schulgrenze.*

### Verwaltung

**11. Anmelden als `mira@schule.de` → „Schule".**
Mira ist Schülerin **und** Verwalterin. Pauls Informatik-Angebot wartet auf
Freigabe: freigeben, dann als Lena nach „Informatik" suchen – jetzt ist es da.
Freigabe zurücknehmen, wieder suchen – wieder weg.

**12. Anmelden als `baumann@schule.de`.**
Eine Lehrkraft: keine Klausuren, keine Nachhilfe, dafür die Verwaltung. In der
Kontenliste hat sie „Zugang sperren" – bei Mira gibt es diesen Knopf nicht.
*Sperren ist Sache einer Lehrkraft, nicht einer Mitschülerin.*

**13. Anmelden als `tom@schule.de` → Verlauf mit Mira → unter ihrer Nachricht
auf „Melden".**
Als Frau Baumann erscheint die Meldung unter „Meldungen" – mit dem Wortlaut der
Nachricht, aber ohne den Rest des Verlaufs. Die Zahl offener Meldungen steht
oben in der Navigation.

### Dranbleiben und Hilfe holen

**14. Als `lena@schule.de` im Lernplan eine Aufgabe abhaken → zurück auf die
Startseite.**
Oben steht „1 Tag in Folge" und „Diese Woche 1 Aufgabe geschafft". Haken wieder
zurücknehmen, Startseite neu laden: Die Karte ist weg. *Sie erscheint nur, wenn
es etwas zu zeigen gibt – „0 Tage in Folge" wäre ein Vorwurf.*

**15. Bei einer Lücke auf „Erklär's mir".**
Es klappt eine Erklärung auf, darunter ein Link auf eine vorbereitete Suche mit
dem Hinweis, dass die niemand geprüft hat. Ganz unten: „Hat das geholfen?" →
**Nein** → der Weg führt direkt in die Nachhilfesuche, Fach und Thema schon
ausgefüllt. *Das „Nein" ist kein Rückschritt, sondern der vorgesehene nächste
Schritt.*

**16. Als `baumann@schule.de` → „Schule" → „Erklärseiten und Videos".**
Fach `Mathematik`, Thema `Kurvendiskussion`, einen Titel und eine Adresse
eintragen – **nimm einen Link, den du selbst geöffnet hast.** Eine
`http://`-Adresse lehnt das Formular ab. Danach als Lena bei „Kurvendiskussion"
wieder auf „Erklär's mir": Jetzt steht dort „Von deiner Schule geprüft" mit
deinem Link statt der Suche. Als `mira@schule.de` (Schülerin mit
Verwaltungsrechten): Liste sichtbar, aber kein Formular. *Wer eine Klasse auf
fremde Seiten schickt, steht dafür gerade – das ist Sache einer Lehrkraft.*

## Auf dem Handy

`npm run dev` zeigt beim Start zwei Adressen. Die hinter `Network:` im
Handy-Browser öffnen, Handy im selben WLAN. Lohnt sich vor allem für die
Schritte 1–3, 8 und 15 – die Oberfläche ist für 390 px Breite gebaut.

## Für die Präsentation: die Grenze vorführen

Dass die Suche nur die eigene Schule zeigt, ist Anzeige. Der eigentliche Riegel
sitzt in der API. Als Lena angemeldet, mit der Angebots-ID eines
Humboldt-Kontos:

```bash
curl -X POST http://localhost:3000/api/tutoring-requests \
  -H 'Content-Type: application/json' -b cookies.txt \
  -d '{"tutorOfferId":"<ID aus der anderen Schule>","topic":"Test","message":"Geht das?"}'
```

Antwort: `404` mit „Dieses Angebot gibt es nicht mehr." – dieselbe Meldung wie
bei einem gelöschten Angebot, damit sie nicht verrät, dass es anderswo existiert.

## Wenn etwas klemmt

| Symptom | Ursache |
|---|---|
| `process.loadEnvFile is not a function` | Node älter als 20.12 |
| `DATABASE_URL fehlt.` | `.env` nicht angelegt oder Zeile leer |
| Verbindung zur Datenbank scheitert | bei Neon `&channel_binding=require` aus der Zeichenfolge entfernen |
| Tabellen fehlen | `npm run db:deploy` vergessen |
| Handy zeigt die Seite, aber nichts reagiert | `DEV_ORIGIN="<Network-Adresse>"` in die `.env` (siehe README) |
| Handy erreicht die Seite gar nicht | Firewall-Abfrage abgelehnt oder Gäste-WLAN mit Geräte-Isolation |
