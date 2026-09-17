"use client";

import Link from "next/link";
import { useState } from "react";

import { RULE_HINT } from "@/lib/explanations";

/**
 * "Erklaer's mir" - die Stufe vor der Nachhilfe.
 *
 * Der Trichter: erst die Erklaerung, darunter die Links, die Lehrkraefte
 * geprueft haben, und ganz unten die Frage, ob es geholfen hat. Ein "Nein"
 * fuehrt direkt in die Nachhilfesuche mit vorbelegtem Fach und Thema - denn
 * genau dann braucht es einen Menschen.
 *
 * Bewusst eine Klappe und kein Dialog: Wer eine Luecke nachliest, soll sehen,
 * zu welcher Luecke die Erklaerung gehoert.
 */

interface GeprueferLink {
  id: string;
  title: string;
  url: string;
  host: string;
  note: string | null;
  topic: string;
}

interface Erklaerung {
  explanationId: string | null;
  source: "ai" | "rule";
  body: {
    summary: string;
    steps: { title: string; body: string }[];
    example: string;
    pitfalls: string[];
    checkQuestion: string;
  };
  links: GeprueferLink[];
  search: { url: string; hint: string } | null;
}

/** Fremde Ziele immer mit sichtbarem Host und ohne Verweis auf unsere Seite. */
function AussenLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
    >
      {children}
    </a>
  );
}

export function ExplainPanel({
  subject,
  topic,
  deficitId,
  label = "Erklaer's mir",
}: {
  subject: string;
  topic: string;
  deficitId?: string;
  label?: string;
}) {
  const [offen, setOffen] = useState(false);
  const [laedt, setLaedt] = useState(false);
  const [daten, setDaten] = useState<Erklaerung | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [rueckmeldung, setRueckmeldung] = useState<"ja" | "nein" | null>(null);

  async function oeffnen() {
    setOffen(true);
    // Einmal geholt, bleibt es stehen - jeder Klick auf "zuklappen" und
    // wieder auf laesst sonst die KI erneut laufen.
    if (daten || laedt) return;

    setLaedt(true);
    setFehler(null);
    try {
      const antwort = await fetch("/api/explanations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, topic }),
      });
      const inhalt = await antwort.json();
      if (!antwort.ok) {
        setFehler(inhalt.error ?? "Das hat nicht geklappt.");
        return;
      }
      setDaten(inhalt as Erklaerung);
    } catch {
      setFehler("Keine Verbindung. Versuch es gleich noch einmal.");
    } finally {
      setLaedt(false);
    }
  }

  async function antworten(hilfreich: boolean) {
    setRueckmeldung(hilfreich ? "ja" : "nein");
    // Ohne gespeicherte Erklaerung (Rueckfallebene) gibt es nichts zu melden.
    if (!daten?.explanationId) return;
    try {
      await fetch(`/api/explanations/${daten.explanationId}/feedback`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ helpful: hilfreich }),
      });
    } catch {
      // Die Rueckmeldung ist Beiwerk. Wenn sie nicht ankommt, soll das
      // niemandem den Weg zur Nachhilfe verstellen.
    }
  }

  const nachhilfe = `/nachhilfe?subject=${encodeURIComponent(subject)}&topic=${encodeURIComponent(topic)}${
    deficitId ? `&deficit=${encodeURIComponent(deficitId)}` : ""
  }`;

  if (!offen) {
    return (
      <button
        type="button"
        onClick={oeffnen}
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
      >
        {label}
      </button>
    );
  }

  return (
    <div className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h4 className="font-medium text-slate-900">Erklaerung: {topic}</h4>
        <button
          type="button"
          onClick={() => setOffen(false)}
          className="shrink-0 text-sm text-slate-500 underline hover:text-slate-700"
        >
          zuklappen
        </button>
      </div>

      {laedt ? <p className="text-sm text-slate-600">Einen Moment, ich schreibe das auf &hellip;</p> : null}

      {fehler ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {fehler}
        </p>
      ) : null}

      {daten ? (
        <div className="space-y-4 text-sm">
          <p className="text-slate-700">{daten.body.summary}</p>

          <ol className="space-y-2">
            {daten.body.steps.map((schritt, index) => (
              <li key={index} className="rounded-md border border-slate-200 bg-white p-3">
                <span className="font-medium text-slate-900">
                  {index + 1}. {schritt.title}
                </span>
                <p className="mt-0.5 text-slate-600">{schritt.body}</p>
              </li>
            ))}
          </ol>

          <div className="rounded-md border border-brand-100 bg-brand-50 p-3">
            <p className="mb-1 font-medium text-brand-800">Beispiel</p>
            <p className="whitespace-pre-line text-slate-700">{daten.body.example}</p>
          </div>

          {daten.body.pitfalls.length > 0 ? (
            <div>
              <p className="mb-1 font-medium text-slate-900">Worauf du achten musst</p>
              <ul className="list-disc space-y-1 pl-5 text-slate-600">
                {daten.body.pitfalls.map((fehler, index) => (
                  <li key={index}>{fehler}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="text-slate-700">
            <span className="font-medium text-slate-900">Frag dich selbst:</span>{" "}
            {daten.body.checkQuestion}
          </p>

          {daten.source === "rule" ? (
            <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
              {RULE_HINT}
            </p>
          ) : null}

          {daten.links.length > 0 ? (
            <div>
              <p className="mb-1 font-medium text-slate-900">Von deiner Schule geprueft</p>
              <ul className="space-y-2">
                {daten.links.map((link) => (
                  <li key={link.id} className="rounded-md border border-slate-200 bg-white p-3">
                    <AussenLink href={link.url}>{link.title}</AussenLink>
                    <span className="ml-2 text-xs text-slate-500">{link.host}</span>
                    {link.note ? <p className="mt-0.5 text-slate-600">{link.note}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : daten.search ? (
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <AussenLink href={daten.search.url}>Videos zum Thema suchen</AussenLink>
              <p className="mt-0.5 text-xs text-slate-500">{daten.search.hint}</p>
            </div>
          ) : null}

          <div className="border-t border-slate-200 pt-3">
            {rueckmeldung === null ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-700">Hat das geholfen?</span>
                <button
                  type="button"
                  onClick={() => antworten(true)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
                >
                  Ja
                </button>
                <button
                  type="button"
                  onClick={() => antworten(false)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
                >
                  Nein
                </button>
              </div>
            ) : rueckmeldung === "ja" ? (
              <p className="text-slate-600">
                Gut. Hak die Aufgabe ab, wenn du sie geuebt hast &ndash; dann rechnet der Plan mit.
              </p>
            ) : (
              <div className="rounded-md border border-brand-200 bg-brand-50 p-3">
                <p className="text-slate-700">
                  Dann hol dir jemanden dazu. Erklaeren kann auch, wer es selbst gerade gelernt hat
                  &ndash; oft sogar besser.
                </p>
                <Link
                  href={nachhilfe}
                  className="mt-2 inline-block rounded-md bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700"
                >
                  Nachhilfe zu {topic} finden
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
