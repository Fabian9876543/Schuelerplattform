"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ErrorNote } from "@/components/ui";
import type { Mastery } from "@/lib/planning";

interface Topic {
  id: string;
  name: string;
  mastery: Mastery;
}

const STUFEN: { wert: Mastery; farbe: string; aktiv: string; titel: string }[] = [
  {
    wert: "weak",
    farbe: "bg-red-100 text-red-700 hover:bg-red-200",
    aktiv: "bg-red-500 text-white",
    titel: "Sitzt noch nicht",
  },
  {
    wert: "medium",
    farbe: "bg-amber-100 text-amber-700 hover:bg-amber-200",
    aktiv: "bg-amber-500 text-white",
    titel: "Wird langsam",
  },
  {
    wert: "strong",
    farbe: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
    aktiv: "bg-emerald-600 text-white",
    titel: "Sitzt",
  },
];

/**
 * Die Ampel je Teilthema. Ein Klick auf Gruen laesst die offenen Aufgaben zu
 * diesem Thema entfallen, ein Klick zurueck weckt sie wieder - die Rechnung
 * dazu macht der Server und schickt die Zahlen zurueck, damit sichtbar ist,
 * was der Klick bewirkt hat.
 */
export function TopicMastery({ topics }: { topics: Topic[] }) {
  const router = useRouter();
  const [stand, setStand] = useState<Record<string, Mastery>>(
    Object.fromEntries(topics.map((t) => [t.id, t.mastery])),
  );
  const [pending, setPending] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  async function setzen(topicId: string, mastery: Mastery) {
    const vorher = stand[topicId];
    if (vorher === mastery) return;

    setStand((s) => ({ ...s, [topicId]: mastery }));
    setPending(topicId);
    setFehler(null);
    setHinweis(null);

    const response = await fetch(`/api/topics/${topicId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mastery }),
    });

    if (!response.ok) {
      setStand((s) => ({ ...s, [topicId]: vorher }));
      const body = await response.json().catch(() => ({ error: "Das hat nicht geklappt." }));
      setFehler(body.error ?? "Das hat nicht geklappt.");
      setPending(null);
      return;
    }

    const body = await response.json();
    const teile: string[] = [];
    if (body.entfallen) teile.push(`${body.entfallen} Aufgabe${body.entfallen === 1 ? "" : "n"} entfallen`);
    if (body.wiederAktiv) teile.push(`${body.wiederAktiv} wieder eingeplant`);
    if (body.verschoben) teile.push(`${body.verschoben} nachgeholt`);
    setHinweis(teile.length ? `Lernplan angepasst: ${teile.join(", ")}.` : null);

    setPending(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {fehler ? <ErrorNote>{fehler}</ErrorNote> : null}
      {hinweis ? (
        <p className="rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700">
          {hinweis}
        </p>
      ) : null}

      {topics.map((topic) => (
        <div key={topic.id} className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-slate-800">{topic.name}</span>
          <div className="flex gap-1" role="group" aria-label={`Lernstand ${topic.name}`}>
            {STUFEN.map((stufe) => {
              const gewaehlt = stand[topic.id] === stufe.wert;
              return (
                <button
                  key={stufe.wert}
                  type="button"
                  title={stufe.titel}
                  aria-pressed={gewaehlt}
                  disabled={pending === topic.id}
                  onClick={() => setzen(topic.id, stufe.wert)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                    gewaehlt ? stufe.aktiv : stufe.farbe
                  }`}
                >
                  {stufe.titel}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
