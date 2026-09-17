"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ErrorNote } from "@/components/ui";
import { DURATIONS } from "@/lib/appointments";
import type { AppointmentStatus } from "@/lib/constants";
import { LIMITS } from "@/lib/limits";

export interface TerminAnzeige {
  id: string;
  /** fertig formatiert vom Server - siehe Hinweis unten */
  label: string;
  place: string | null;
  status: AppointmentStatus;
  /** von mir vorgeschlagen? */
  mine: boolean;
  proposerName: string;
  past: boolean;
}

const STATUS_STIL: Record<AppointmentStatus, string> = {
  proposed: "border-amber-200 bg-amber-50",
  confirmed: "border-emerald-200 bg-emerald-50",
  cancelled: "border-slate-200 bg-slate-50 text-slate-500",
};

/**
 * Termine zu einer Anfrage: vorschlagen, zusagen, absagen.
 *
 * Die Zeiten kommen fertig formatiert vom Server herein. Das ist Absicht:
 * Wuerde der Browser formatieren, zeigte er sie in der Zeitzone des Geraets -
 * und damit womoeglich eine andere Uhrzeit, als vereinbart wurde.
 *
 * Nach jeder Aenderung wird die Seite neu vom Server geholt, statt die Liste
 * hier nachzufuehren. So kann die Anzeige nicht auseinanderlaufen, wenn die
 * andere Seite zwischendurch etwas geaendert hat.
 */
export function AppointmentsPanel({
  requestId,
  termine,
  defaultStart,
  minStart,
  partnerName,
}: {
  requestId: string;
  termine: TerminAnzeige[];
  defaultStart: string;
  minStart: string;
  partnerName: string;
}) {
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  async function schicken(url: string, method: "POST" | "PATCH", body: unknown, marke: string) {
    setPending(marke);
    setFehler(null);
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const daten = await response.json().catch(() => ({ error: "Das hat nicht geklappt." }));
        setFehler(daten.error ?? "Das hat nicht geklappt.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setFehler("Das ist nicht angekommen. Pruef deine Verbindung und versuch es noch einmal.");
      return false;
    } finally {
      setPending(null);
    }
  }

  async function vorschlagen(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const daten = new FormData(event.currentTarget);
    const erfolg = await schicken(
      `/api/tutoring-requests/${requestId}/appointments`,
      "POST",
      {
        startsAt: String(daten.get("startsAt") ?? ""),
        durationMinutes: Number(daten.get("durationMinutes")),
        place: String(daten.get("place") ?? "") || null,
      },
      "neu",
    );
    if (erfolg) setOffen(false);
  }

  const antworten = (terminId: string, status: "confirmed" | "cancelled") =>
    schicken(`/api/appointments/${terminId}`, "PATCH", { status }, terminId);

  return (
    <div className="space-y-3">
      {fehler ? <ErrorNote>{fehler}</ErrorNote> : null}

      {termine.length === 0 ? (
        <p className="text-sm text-slate-500">
          Noch kein Termin ausgemacht. Schlag einen vor - {partnerName} muss ihn dann bestaetigen.
        </p>
      ) : (
        <ul className="space-y-2">
          {termine.map((termin) => (
            <li key={termin.id} className={`rounded-md border px-3 py-2 ${STATUS_STIL[termin.status]}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className={`font-medium ${termin.status === "cancelled" ? "line-through" : "text-slate-800"}`}>
                    {termin.label}
                  </p>
                  <p className="text-xs text-slate-600">
                    {termin.place ? `${termin.place} · ` : ""}
                    {termin.status === "confirmed"
                      ? "zugesagt"
                      : termin.status === "cancelled"
                        ? "abgesagt"
                        : termin.mine
                          ? `wartet auf ${partnerName}`
                          : `${termin.proposerName} schlaegt vor`}
                    {termin.past && termin.status !== "cancelled" ? " · vorbei" : ""}
                  </p>
                </div>

                <div className="flex gap-2">
                  {termin.status === "proposed" && !termin.mine ? (
                    <button
                      type="button"
                      disabled={pending === termin.id}
                      onClick={() => antworten(termin.id, "confirmed")}
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      Passt
                    </button>
                  ) : null}

                  {termin.status !== "cancelled" ? (
                    <button
                      type="button"
                      disabled={pending === termin.id}
                      onClick={() => antworten(termin.id, "cancelled")}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {termin.status === "proposed" && termin.mine ? "Zurueckziehen" : "Absagen"}
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {offen ? (
        <form onSubmit={vorschlagen} method="post" className="space-y-3 rounded-md border border-slate-200 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Wann?</span>
              <input
                type="datetime-local"
                name="startsAt"
                required
                defaultValue={defaultStart}
                min={minStart}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Wie lange?</span>
              <select
                name="durationMinutes"
                defaultValue={60}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-brand-500"
              >
                {DURATIONS.map((dauer) => (
                  <option key={dauer} value={dauer}>
                    {dauer} Minuten
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Wo? (freiwillig)</span>
            <input
              name="place"
              maxLength={LIMITS.topicLength}
              placeholder="z. B. Bibliothek, Raum 204"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending === "neu"}
              className="rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {pending === "neu" ? "Wird vorgeschlagen ..." : "Termin vorschlagen"}
            </button>
            <button
              type="button"
              onClick={() => setOffen(false)}
              className="rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
            >
              Abbrechen
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOffen(true)}
          className="rounded-md border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100"
        >
          Termin vorschlagen
        </button>
      )}
    </div>
  );
}
