"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ErrorNote, Field, inputClass } from "@/components/ui";
import { LIMITS } from "@/lib/limits";
import { hostOf, isSafeUrl } from "@/lib/links";

/**
 * Die Videos und Erklaerseiten, die eine Schule ihren Schuelern empfiehlt.
 *
 * Verlinkt, nicht eingebettet: Ein eingebettetes Video laedt beim Schueler
 * Daten beim fremden Anbieter, bevor er ueberhaupt auf Abspielen geklickt hat.
 * Deshalb steht hier nur, wohin es geht - und die Zieladresse ist immer
 * sichtbar, damit niemand blind klickt.
 */

export interface VerwalteterLink {
  id: string;
  subject: string;
  topic: string;
  title: string;
  url: string;
  note: string | null;
  addedBy: { name: string } | null;
}

export function LinkManager({
  links,
  faecher,
  darfPflegen,
}: {
  links: VerwalteterLink[];
  faecher: readonly string[];
  darfPflegen: boolean;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState(faecher[0] ?? "");
  const [topic, setTopic] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function anlegen(event: React.FormEvent) {
    event.preventDefault();
    setFehler(null);

    // Dieselbe Pruefung wie auf dem Server, nur frueher: So steht die Meldung
    // am Feld, statt nach einem Rundweg zum Server.
    if (!isSafeUrl(url)) {
      setFehler("Bitte eine vollstaendige https-Adresse angeben, zum Beispiel https://...");
      return;
    }

    setLaeuft(true);
    try {
      const response = await fetch("/api/school/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, topic, title, url, note: note.trim() || null }),
      });
      if (!response.ok) {
        const daten = await response.json().catch(() => ({ error: "Das hat nicht geklappt." }));
        setFehler(daten.error ?? "Das hat nicht geklappt.");
        return;
      }
      setTopic("");
      setTitle("");
      setUrl("");
      setNote("");
      router.refresh();
    } catch {
      setFehler("Das ist nicht angekommen. Pruef deine Verbindung und versuch es noch einmal.");
    } finally {
      setLaeuft(false);
    }
  }

  async function loeschen(id: string) {
    setFehler(null);
    try {
      const response = await fetch(`/api/school/links/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const daten = await response.json().catch(() => ({ error: "Das hat nicht geklappt." }));
        setFehler(daten.error ?? "Das hat nicht geklappt.");
        return;
      }
      router.refresh();
    } catch {
      setFehler("Das ist nicht angekommen. Pruef deine Verbindung und versuch es noch einmal.");
    }
  }

  return (
    <div className="space-y-4">
      {fehler ? <ErrorNote>{fehler}</ErrorNote> : null}

      {darfPflegen ? (
        <form onSubmit={anlegen} className="space-y-3 rounded-lg border border-slate-200 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Fach">
              <select
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className={inputClass}
                required
              >
                {faecher.map((fach) => (
                  <option key={fach} value={fach}>
                    {fach}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Thema" hint="So, wie Schueler es eintragen wuerden">
              <input
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                maxLength={LIMITS.topicLength}
                className={inputClass}
                placeholder="Kurvendiskussion"
                required
              />
            </Field>
          </div>

          <Field label="Titel">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={LIMITS.linkTitleLength}
              className={inputClass}
              placeholder="Kurvendiskussion Schritt fuer Schritt"
              required
            />
          </Field>

          <Field label="Adresse" hint="Nur https. Das Video wird verlinkt, nicht eingebettet.">
            <input
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              maxLength={LIMITS.linkUrlLength}
              className={inputClass}
              placeholder="https://..."
              required
            />
          </Field>

          <Field label="Notiz (freiwillig)" hint="zum Beispiel: ab Minute 3, oder nur Teil 1">
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={LIMITS.descriptionLength}
              className={inputClass}
            />
          </Field>

          <button
            type="submit"
            disabled={laeuft}
            className="rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {laeuft ? "Wird gespeichert ..." : "Link hinterlegen"}
          </button>
        </form>
      ) : (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Links hinterlegen duerfen Lehrkraefte. Wer eine Klasse auf fremde Seiten schickt, steht
          dafuer gerade - das gehoert nicht unter Mitschueler.
        </p>
      )}

      {links.length === 0 ? (
        <p className="text-sm text-slate-500">
          Noch nichts hinterlegt. Solange hier nichts steht, bekommen Schueler bei einer Luecke
          eine gewoehnliche Suche angeboten - mit dem Hinweis, dass die niemand geprueft hat.
        </p>
      ) : (
        <ul className="space-y-2">
          {links.map((link) => (
            <li
              key={link.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">
                    {link.subject} &middot; {link.topic}
                  </span>
                </div>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                  className="mt-1 block font-medium text-brand-700 underline underline-offset-2"
                >
                  {link.title}
                </a>
                <p className="text-xs text-slate-500">
                  {hostOf(link.url)}
                  {link.addedBy ? ` · eingetragen von ${link.addedBy.name}` : ""}
                </p>
                {link.note ? <p className="mt-1 text-sm text-slate-600">{link.note}</p> : null}
              </div>

              {darfPflegen ? (
                <button
                  type="button"
                  onClick={() => loeschen(link.id)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Entfernen
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
