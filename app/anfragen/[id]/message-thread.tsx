"use client";

import { useEffect, useRef, useState } from "react";

import { ReportDialog } from "@/components/report-dialog";
import { ErrorNote } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { LIMITS } from "@/lib/limits";

export interface ThreadMessage {
  id: string;
  body: string;
  /** ISO-Zeichenkette: kommt einmal vom Server gerendert und einmal aus fetch */
  createdAt: string;
  senderName: string;
  mine: boolean;
}

/** Wie oft nachgesehen wird, ob etwas Neues da ist. */
const NACHLADEN_MS = 8_000;

/**
 * Der Verlauf mit Eingabefeld.
 *
 * Die Nachrichten kommen serverseitig gerendert herein und stehen damit auch
 * ohne JavaScript da. Danach uebernimmt dieser Zustand: Gesendetes haengt sich
 * sofort an, und alle acht Sekunden wird nachgesehen, ob die Gegenseite
 * geschrieben hat. Ruht der Tab im Hintergrund, wird nicht nachgeladen - das
 * spart Anfragen, waehrend niemand hinsieht.
 */
export function MessageThread({
  requestId,
  initial,
  canWrite,
}: {
  requestId: string;
  initial: ThreadMessage[];
  canWrite: boolean;
}) {
  const [messages, setMessages] = useState<ThreadMessage[]>(initial);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const ende = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(async () => {
      if (document.hidden) return;
      try {
        const response = await fetch(`/api/tutoring-requests/${requestId}/messages`);
        if (!response.ok) return;
        const body = await response.json();
        setMessages(body.messages);
      } catch {
        // Kurz kein Netz: beim naechsten Durchlauf wieder versuchen.
      }
    }, NACHLADEN_MS);
    return () => clearInterval(timer);
  }, [requestId]);

  async function senden(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const inhalt = text.trim();
    if (!inhalt || pending) return;

    setPending(true);
    setFehler(null);

    // Der Knopf ist waehrend des Sendens gesperrt, deshalb muss "pending"
    // unter allen Umstaenden wieder zurueckgehen - sonst bliebe er nach einem
    // abgerissenen Funkloch-Versuch dauerhaft grau, ohne dass jemand erfaehrt,
    // warum. Der geschriebene Text bleibt in diesem Fall stehen.
    try {
      const response = await fetch(`/api/tutoring-requests/${requestId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: inhalt }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: "Das hat nicht geklappt." }));
        setFehler(body.error ?? "Das hat nicht geklappt.");
        return;
      }

      const body = await response.json();
      setMessages((bisher) => [...bisher, body.message]);
      setText("");
      ende.current?.scrollIntoView({ behavior: "smooth" });
    } catch {
      setFehler("Die Nachricht ist nicht angekommen. Pruef deine Verbindung und versuch es noch einmal.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500">
            Noch keine Nachrichten. Schreib die erste - zum Beispiel, wann ihr Zeit habt.
          </p>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={message.mine ? "flex justify-end" : "flex"}>
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 ${
                  message.mine ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-800"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{message.body}</p>
                <p className={`mt-1 text-xs ${message.mine ? "text-brand-100" : "text-slate-500"}`}>
                  {message.mine ? "Du" : message.senderName} &middot;{" "}
                  {formatDateTime(new Date(message.createdAt))}
                </p>
                {message.mine ? null : (
                  <ReportDialog targetType="message" targetId={message.id} was="Diese Nachricht" />
                )}
              </div>
            </div>
          ))
        )}
        <div ref={ende} />
      </div>

      {canWrite ? (
        <form onSubmit={senden} method="post" className="space-y-2">
          {fehler ? <ErrorNote>{fehler}</ErrorNote> : null}
          <textarea
            name="body"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            maxLength={LIMITS.messageLength}
            placeholder="Nachricht schreiben ..."
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              {text.length}/{LIMITS.messageLength} Zeichen
            </span>
            <button
              type="submit"
              disabled={pending || text.trim().length === 0}
              className="rounded-md bg-brand-600 px-4 py-2 font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Senden ..." : "Senden"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
