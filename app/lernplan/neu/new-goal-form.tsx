"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, ErrorNote, Field, inputClass } from "@/components/ui";
import { SUBJECTS } from "@/lib/constants";

/** Morgen als frueheste sinnvolle Vorgabe - heute lohnt kein Lernplan mehr. */
function tomorrow(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function NewGoalForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const data = Object.fromEntries(new FormData(event.currentTarget));

    const response = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const body = await response.json().catch(() => ({ error: "Speichern fehlgeschlagen." }));
    if (!response.ok) {
      setError(body.error ?? "Speichern fehlgeschlagen.");
      setPending(false);
      return;
    }

    router.push(`/lernplan/${body.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <Field label="Titel" hint="Zum Beispiel: Mathe-Klausur Analysis">
        <input name="title" required minLength={3} className={inputClass} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fach">
          <select name="subject" required defaultValue="Mathematik" className={inputClass}>
            {SUBJECTS.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Datum der Klausur">
          <input name="examDate" type="date" required defaultValue={tomorrow()} className={inputClass} />
        </Field>
      </div>

      <Field label="Themen" hint="Ein Thema pro Zeile. Je genauer, desto besser der Lernplan.">
        <textarea
          name="topics"
          required
          rows={6}
          placeholder={"Ableitungsregeln\nKurvendiskussion\nExtremwertaufgaben"}
          className={inputClass}
        />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? "Wird gespeichert ..." : "Weiter zum Selbsttest"}
      </Button>
    </form>
  );
}
