"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ErrorNote } from "@/components/ui";
import { SUBJECTS, type Subject } from "@/lib/constants";
import { LIMITS } from "@/lib/limits";

/**
 * Die Schalter der Verwaltungsseite.
 *
 * Alle schicken dasselbe: eine Aenderung an den Server, danach die Seite neu
 * vom Server holen. Kein eigener Zustand fuer die Daten - was angezeigt wird,
 * steht in der Datenbank, nicht im Browser.
 */
function useAenderung() {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  async function schicken(url: string, body: unknown, marke: string) {
    setPending(marke);
    setFehler(null);
    try {
      const response = await fetch(url, {
        method: "PATCH",
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

  return { schicken, pending, fehler };
}

export function ApprovalToggle({ requiresApproval }: { requiresApproval: boolean }) {
  const { schicken, pending, fehler } = useAenderung();

  return (
    <div className="space-y-2">
      {fehler ? <ErrorNote>{fehler}</ErrorNote> : null}
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={requiresApproval}
          disabled={pending !== null}
          onChange={(event) => schicken("/api/school", { requiresApproval: event.target.checked }, "pflicht")}
          className="mt-1 h-4 w-4 rounded border-slate-300"
        />
        <span>
          <span className="block font-medium text-slate-800">
            Angebote erst nach Freigabe anzeigen
          </span>
          <span className="block text-sm text-slate-600">
            Ist der Haken gesetzt, taucht ein neues Nachhilfe-Angebot erst in der Suche auf,
            wenn die Schule es freigegeben hat. Ohne Haken sind alle Angebote sofort sichtbar -
            auch die bereits freigegebenen bleiben es.
          </span>
        </span>
      </label>
    </div>
  );
}

export function OfferApproval({ offerId, approved }: { offerId: string; approved: boolean }) {
  const { schicken, pending, fehler } = useAenderung();

  return (
    <div className="text-right">
      {fehler ? <ErrorNote>{fehler}</ErrorNote> : null}
      <button
        type="button"
        disabled={pending !== null}
        onClick={() => schicken(`/api/school/offers/${offerId}`, { approved: !approved }, offerId)}
        className={
          approved
            ? "rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            : "rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        }
      >
        {approved ? "Freigabe zuruecknehmen" : "Freigeben"}
      </button>
    </div>
  );
}

export function MemberRole({
  userId,
  isAdmin,
  name,
  self,
}: {
  userId: string;
  isAdmin: boolean;
  name: string;
  self: boolean;
}) {
  const { schicken, pending, fehler } = useAenderung();

  if (self) {
    // Die eigene Rolle laesst sich nicht aendern - der Server weist es auch
    // ab, aber ein Knopf, der nie funktioniert, gehoert gar nicht erst hin.
    return <span className="text-xs text-slate-500">das bist du</span>;
  }

  return (
    <div className="text-right">
      {fehler ? <ErrorNote>{fehler}</ErrorNote> : null}
      <button
        type="button"
        disabled={pending !== null}
        onClick={() =>
          schicken(
            `/api/school/members/${userId}`,
            { isAdmin: !isAdmin },
            userId,
          )
        }
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        title={
          isAdmin
            ? `${name} verwaltet die Schule nicht mehr`
            : `${name} darf die Schule mitverwalten`
        }
      >
        {isAdmin ? "Verwaltung entziehen" : "Zum Verwalter machen"}
      </button>
    </div>
  );
}

export function SubjectPicker({ gewaehlt }: { gewaehlt: string[] }) {
  const { schicken, pending, fehler } = useAenderung();
  const [auswahl, setAuswahl] = useState<string[]>(gewaehlt);

  const umschalten = (fach: Subject) =>
    setAuswahl((bisher) =>
      bisher.includes(fach) ? bisher.filter((eintrag) => eintrag !== fach) : [...bisher, fach],
    );

  const unveraendert =
    auswahl.length === gewaehlt.length && auswahl.every((fach) => gewaehlt.includes(fach));

  return (
    <div className="space-y-3">
      {fehler ? <ErrorNote>{fehler}</ErrorNote> : null}

      <p className="text-sm text-slate-600">
        {auswahl.length === 0
          ? "Kein Fach ausgewaehlt - dann sind alle Faecher erlaubt."
          : `${auswahl.length} von ${SUBJECTS.length} Faechern erlaubt.`}
      </p>

      <div className="flex flex-wrap gap-2">
        {SUBJECTS.map((fach) => {
          const an = auswahl.includes(fach);
          return (
            <button
              key={fach}
              type="button"
              aria-pressed={an}
              onClick={() => umschalten(fach)}
              className={`rounded-full px-3 py-1 text-sm transition ${
                an
                  ? "bg-brand-600 text-white"
                  : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {fach}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending !== null || unveraendert}
          onClick={() => schicken("/api/school", { subjects: auswahl }, "faecher")}
          className="rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Faecherliste speichern
        </button>
        {auswahl.length > 0 ? (
          <button
            type="button"
            onClick={() => setAuswahl([])}
            className="text-sm text-slate-600 underline hover:text-slate-900"
          >
            alle Faecher erlauben
          </button>
        ) : null}
        {unveraendert ? null : <span className="text-sm text-amber-700">noch nicht gespeichert</span>}
      </div>
    </div>
  );
}

/**
 * Eine Meldung abschliessen.
 *
 * Zwei Wege: erledigt (es war etwas dran) oder unbegruendet. Beides mit einer
 * kurzen Notiz, damit spaeter nachvollziehbar ist, was entschieden wurde.
 */
export function ReportActions({ reportId }: { reportId: string }) {
  const { schicken, pending, fehler } = useAenderung();
  const [notiz, setNotiz] = useState("");

  const abschliessen = (status: "resolved" | "rejected") =>
    schicken(`/api/reports/${reportId}`, { status, resolution: notiz.trim() || null }, reportId);

  return (
    <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
      {fehler ? <ErrorNote>{fehler}</ErrorNote> : null}
      <input
        value={notiz}
        onChange={(event) => setNotiz(event.target.value)}
        maxLength={LIMITS.reportNoteLength}
        placeholder="Notiz zur Entscheidung (freiwillig)"
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => abschliessen("resolved")}
          className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-60"
        >
          Erledigt
        </button>
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => abschliessen("rejected")}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          Unbegruendet
        </button>
      </div>
    </div>
  );
}

/**
 * Zugang sperren oder wieder freigeben.
 *
 * Steht nur Lehrkraeften zur Verfuegung - die Seite zeigt den Knopf sonst
 * gar nicht, und der Server weist es zusaetzlich ab.
 */
export function BlockButton({
  userId,
  name,
  blocked,
}: {
  userId: string;
  name: string;
  blocked: boolean;
}) {
  const { schicken, pending, fehler } = useAenderung();

  return (
    <div className="text-right">
      {fehler ? <ErrorNote>{fehler}</ErrorNote> : null}
      <button
        type="button"
        disabled={pending !== null}
        onClick={() => schicken(`/api/school/members/${userId}`, { blocked: !blocked }, userId)}
        title={blocked ? `${name} kann sich wieder anmelden` : `${name} kann sich nicht mehr anmelden`}
        className={
          blocked
            ? "rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            : "rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
        }
      >
        {blocked ? "Sperre aufheben" : "Zugang sperren"}
      </button>
    </div>
  );
}
