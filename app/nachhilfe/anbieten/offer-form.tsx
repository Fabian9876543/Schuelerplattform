"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, ErrorNote, Field, inputClass } from "@/components/ui";
import { MAX_GRADE_LEVEL, MIN_GRADE_LEVEL, type Subject } from "@/lib/constants";

const GRADES = Array.from(
  { length: MAX_GRADE_LEVEL - MIN_GRADE_LEVEL + 1 },
  (_, index) => MIN_GRADE_LEVEL + index,
);

export function OfferForm({ subjects }: { subjects: readonly Subject[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));

    const response = await fetch("/api/tutors/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: "Speichern fehlgeschlagen." }));
      setError(body.error ?? "Speichern fehlgeschlagen.");
      setPending(false);
      return;
    }

    form.reset();
    setPending(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fach">
          <select
            name="subject"
            required
            defaultValue={subjects.includes("Mathematik") ? "Mathematik" : subjects[0]}
            className={inputClass}
          >
            {subjects.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Ich helfe bis Klasse" hint="Bis zu welcher Klassenstufe traust du dir das zu?">
          <select name="maxGradeLevel" required defaultValue="10" className={inputClass}>
            {GRADES.map((grade) => (
              <option key={grade} value={grade}>
                Klasse {grade}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Themen" hint="Ein Thema pro Zeile. Danach wird gesucht.">
        <textarea
          name="topics"
          required
          rows={5}
          placeholder={"Ableitungsregeln\nKurvendiskussion\nTextaufgaben"}
          className={inputClass}
        />
      </Field>

      <Field label="Kurze Beschreibung" hint="Wie hilfst du? Zum Beispiel erklaeren, ueben, Aufgaben durchgehen.">
        <textarea name="description" required rows={3} minLength={10} className={inputClass} />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? "Wird gespeichert ..." : "Angebot speichern"}
      </Button>
    </form>
  );
}
