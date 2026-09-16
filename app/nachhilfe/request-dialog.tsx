"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, ErrorNote, inputClass } from "@/components/ui";

export function RequestDialog({
  offerId,
  tutorName,
  topic,
  deficitId,
}: {
  offerId: string;
  tutorName: string;
  topic: string;
  deficitId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);

    const response = await fetch("/api/tutoring-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tutorOfferId: offerId,
        topic: String(form.get("topic") ?? ""),
        message: String(form.get("message") ?? ""),
        deficitId,
      }),
    });

    const body = await response.json().catch(() => ({ error: "Die Anfrage konnte nicht gesendet werden." }));
    if (!response.ok) {
      setError(body.error ?? "Die Anfrage konnte nicht gesendet werden.");
      setPending(false);
      return;
    }

    setSent(true);
    setOpen(false);
    setPending(false);
    router.refresh();
  }

  if (sent) {
    return (
      <span className="rounded-md bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
        Anfrage gesendet
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100"
      >
        Anfragen
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="w-full space-y-3 border-t border-slate-200 pt-4">
      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Worum geht es?</span>
        <input name="topic" defaultValue={topic} required className={inputClass} />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">
          Nachricht an {tutorName}
        </span>
        <textarea
          name="message"
          rows={3}
          required
          minLength={10}
          defaultValue={
            topic ? `Hallo ${tutorName}, ich tue mich bei ${topic} schwer. Haettest du Zeit, mir das zu erklaeren?` : ""
          }
          className={inputClass}
        />
      </label>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Wird gesendet ..." : "Anfrage senden"}
        </Button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
