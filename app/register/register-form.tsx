"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, ErrorNote, Field, inputClass } from "@/components/ui";
import { MAX_GRADE_LEVEL, MIN_GRADE_LEVEL } from "@/lib/constants";

const GRADES = Array.from(
  { length: MAX_GRADE_LEVEL - MIN_GRADE_LEVEL + 1 },
  (_, index) => MIN_GRADE_LEVEL + index,
);

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const data = Object.fromEntries(new FormData(event.currentTarget));

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: "Registrierung fehlgeschlagen." }));
      setError(body.error ?? "Registrierung fehlgeschlagen.");
      setPending(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form
      method="post"
      onSubmit={onSubmit}
      className="space-y-4"
    >
      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <Field
        label="Beitrittscode deiner Schule"
        hint="Den bekommst du von deiner Schule. Er entscheidet, in wessen Bereich du landest."
      >
        <input
          name="joinCode"
          required
          placeholder="z. B. BEISPIEL"
          className={`${inputClass} uppercase`}
        />
      </Field>

      <Field label="Name">
        <input name="name" required autoComplete="name" className={inputClass} />
      </Field>

      <Field label="E-Mail">
        <input name="email" type="email" required autoComplete="email" className={inputClass} />
      </Field>

      <Field label="Klassenstufe">
        <select name="gradeLevel" required defaultValue="10" className={inputClass}>
          {GRADES.map((grade) => (
            <option key={grade} value={grade}>
              Klasse {grade}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Passwort" hint="Mindestens 8 Zeichen.">
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
        />
      </Field>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Wird angelegt ..." : "Konto anlegen"}
      </Button>
    </form>
  );
}
