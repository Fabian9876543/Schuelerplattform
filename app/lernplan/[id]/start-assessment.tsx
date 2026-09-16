"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, ErrorNote } from "@/components/ui";

export function StartAssessment({ goalId }: { goalId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setPending(true);
    setError(null);

    const response = await fetch(`/api/goals/${goalId}/assessment`, { method: "POST" });
    const body = await response.json().catch(() => ({ error: "Der Selbsttest konnte nicht erstellt werden." }));

    if (!response.ok) {
      setError(body.error ?? "Der Selbsttest konnte nicht erstellt werden.");
      setPending(false);
      return;
    }

    router.push(`/lernplan/${goalId}/selbsttest`);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <Button onClick={start} disabled={pending}>
        {pending ? "Fragen werden erstellt ..." : "Selbsttest starten"}
      </Button>
      {pending ? (
        // Gemessen: die Fragengenerierung braucht rund 40 Sekunden. Eine vage
        // Formulierung laesst die Seite kaputt wirken, bevor sie fertig ist.
        <p className="text-xs text-slate-500">
          Die Fragen werden eigens fuer deine Themen erstellt - das dauert etwa
          eine halbe Minute. Lass die Seite offen.
        </p>
      ) : null}
    </div>
  );
}
