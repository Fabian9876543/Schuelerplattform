"use client";

import { useState } from "react";

import { ErrorNote } from "@/components/ui";
import { LIMITS } from "@/lib/limits";
import { STAR_MAX } from "@/lib/ratings";

const BEDEUTUNG = [
  "",
  "hat mir nicht geholfen",
  "war eher schwierig",
  "ganz in Ordnung",
  "hat mir geholfen",
  "hat es richtig gut erklaert",
];

/**
 * Die Rueckmeldung nach der Nachhilfe.
 *
 * Nur die anfragende Person sieht dieses Formular, und erst nach einer Zusage
 * - die Seite blendet es sonst gar nicht ein, der Server weist es zusaetzlich
 * ab. Wer schon bewertet hat, kann seine Bewertung hier aendern; es bleibt
 * eine Stimme, keine zweite kommt dazu.
 */
export function RatingForm({
  requestId,
  tutorName,
  initialStars,
  initialComment,
}: {
  requestId: string;
  tutorName: string;
  initialStars: number | null;
  initialComment: string | null;
}) {
  const [stars, setStars] = useState<number | null>(initialStars);
  const [comment, setComment] = useState(initialComment ?? "");
  const [gespeichert, setGespeichert] = useState(initialStars !== null);
  const [pending, setPending] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function speichern(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stars === null || pending) return;

    setPending(true);
    setFehler(null);

    try {
      const response = await fetch(`/api/tutoring-requests/${requestId}/rating`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stars, comment: comment.trim() || null }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: "Das hat nicht geklappt." }));
        setFehler(body.error ?? "Das hat nicht geklappt.");
        return;
      }

      setGespeichert(true);
    } catch {
      setFehler("Die Bewertung ist nicht angekommen. Pruef deine Verbindung und versuch es noch einmal.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={speichern} method="post" className="space-y-3">
      {fehler ? <ErrorNote>{fehler}</ErrorNote> : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1" role="group" aria-label={`Bewertung fuer ${tutorName}`}>
          {Array.from({ length: STAR_MAX }, (_, index) => index + 1).map((wert) => (
            <button
              key={wert}
              type="button"
              aria-label={`${wert} von ${STAR_MAX} Sternen - ${BEDEUTUNG[wert]}`}
              aria-pressed={stars === wert}
              title={BEDEUTUNG[wert]}
              onClick={() => {
                setStars(wert);
                setGespeichert(false);
              }}
              className={`text-2xl leading-none transition ${
                stars !== null && wert <= stars ? "text-amber-500" : "text-slate-300 hover:text-amber-300"
              }`}
            >
              {stars !== null && wert <= stars ? "★" : "☆"}
            </button>
          ))}
        </div>
        {stars ? <span className="text-sm text-slate-600">{BEDEUTUNG[stars]}</span> : null}
      </div>

      <textarea
        name="comment"
        value={comment}
        onChange={(event) => {
          setComment(event.target.value);
          setGespeichert(false);
        }}
        rows={3}
        maxLength={LIMITS.commentLength}
        placeholder={`Was hat dir bei ${tutorName} geholfen? (freiwillig)`}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-slate-500">
          {tutorName} sieht deine Bewertung mit deinem Namen.
        </span>
        <div className="flex items-center gap-3">
          {gespeichert && !pending ? (
            <span className="text-sm text-emerald-700">gespeichert</span>
          ) : null}
          <button
            type="submit"
            disabled={pending || stars === null || gespeichert}
            className="rounded-md bg-brand-600 px-4 py-2 font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {initialStars === null ? "Bewertung abgeben" : "Bewertung aendern"}
          </button>
        </div>
      </div>
    </form>
  );
}
