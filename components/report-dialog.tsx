"use client";

import { useState } from "react";

import { ErrorNote } from "@/components/ui";
import type { ReportTargetType } from "@/lib/constants";
import { LIMITS } from "@/lib/limits";
import { REPORT_REASONS } from "@/lib/reports";

/**
 * Der Melde-Knopf mit dem kleinen Formular dahinter.
 *
 * Nach dem Absenden steht nur "Gemeldet" da - was aus der Meldung wird,
 * erfaehrt die meldende Person nicht. Alles andere verriete etwas ueber die
 * gemeldete Person.
 */
export function ReportDialog({
  targetType,
  targetId,
  was,
  className = "",
}: {
  targetType: ReportTargetType;
  targetId: string;
  /** wie der gemeldete Inhalt im Text heisst, z. B. "diese Nachricht" */
  was: string;
  className?: string;
}) {
  const [offen, setOffen] = useState(false);
  const [fertig, setFertig] = useState(false);
  const [pending, setPending] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  if (fertig) {
    return <span className={`text-xs text-slate-500 ${className}`}>Gemeldet</span>;
  }

  if (!offen) {
    return (
      <button
        type="button"
        onClick={() => setOffen(true)}
        className={`text-xs text-slate-400 underline hover:text-slate-700 ${className}`}
      >
        Melden
      </button>
    );
  }

  async function absenden(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const daten = new FormData(event.currentTarget);

    setPending(true);
    setFehler(null);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId,
          reason: String(daten.get("reason")),
          note: String(daten.get("note") ?? "") || null,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: "Das hat nicht geklappt." }));
        setFehler(body.error ?? "Das hat nicht geklappt.");
        return;
      }
      setFertig(true);
    } catch {
      setFehler("Die Meldung ist nicht angekommen. Pruef deine Verbindung und versuch es noch einmal.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={absenden}
      method="post"
      className={`mt-2 space-y-2 rounded-md border border-slate-200 bg-white p-3 text-left ${className}`}
    >
      {fehler ? <ErrorNote>{fehler}</ErrorNote> : null}

      <p className="text-sm font-medium text-slate-800">{was} melden</p>
      <p className="text-xs text-slate-500">
        Die Schulverwaltung sieht den gemeldeten Text und deinen Namen. Die gemeldete Person
        erfaehrt nicht, wer gemeldet hat.
      </p>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-700">Warum?</span>
        <select
          name="reason"
          required
          defaultValue="insult"
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500"
        >
          {REPORT_REASONS.map((grund) => (
            <option key={grund.wert} value={grund.wert}>
              {grund.label}
            </option>
          ))}
        </select>
      </label>

      <textarea
        name="note"
        rows={2}
        maxLength={LIMITS.reportNoteLength}
        placeholder="Was ist passiert? (freiwillig)"
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-60"
        >
          {pending ? "Wird gemeldet ..." : "Melden"}
        </button>
        <button
          type="button"
          onClick={() => setOffen(false)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
