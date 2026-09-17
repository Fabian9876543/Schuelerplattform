"use client";

import { useEffect, useState } from "react";

import { ErrorNote } from "@/components/ui";

/**
 * Der Schalter fuer Benachrichtigungen.
 *
 * Drei Zustaende, und der erste ist der Grund fuer diese Komponente: Auf
 * iPhone und iPad gibt es Benachrichtigungen **nur**, wenn die App vorher zum
 * Home-Bildschirm hinzugefuegt wurde. Ohne diesen Hinweis wirkt der Knopf
 * dort wie ein Defekt - man tippt, und es passiert nichts.
 */

/**
 * base64url in das Format, das `pushManager.subscribe` erwartet.
 *
 * Der Puffer wird ausdruecklich als ArrayBuffer angelegt: Ein Uint8Array
 * ueber einem SharedArrayBuffer waere hier nicht erlaubt, und der Typ
 * unterscheidet das.
 */
function schluesselAlsBytes(base64: string): Uint8Array<ArrayBuffer> {
  const gefuellt = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const roh = atob(gefuellt.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(roh.length));
  for (let i = 0; i < roh.length; i += 1) bytes[i] = roh.charCodeAt(i);
  return bytes;
}

type Lage =
  | "wird-geprueft"
  | "nicht-moeglich"
  | "installation-noetig"
  | "aus"
  | "an"
  | "abgelehnt";

export function PushToggle({
  publicKey,
  abonniert,
}: {
  /** null = auf dem Server sind keine Schluessel hinterlegt */
  publicKey: string | null;
  /** hat dieses Konto irgendein Geraet angemeldet? */
  abonniert: boolean;
}) {
  const [lage, setLage] = useState<Lage>("wird-geprueft");
  const [pending, setPending] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    if (!publicKey) {
      setLage("nicht-moeglich");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      // Safari im Tab auf iOS: Das Push-Objekt fehlt, bis die App
      // installiert ist.
      setLage(istApple() && !istInstalliert() ? "installation-noetig" : "nicht-moeglich");
      return;
    }
    if (Notification.permission === "denied") {
      setLage("abgelehnt");
      return;
    }
    // Der Server weiss, ob irgendein Geraet angemeldet ist; ob **dieses**
    // dabei ist, weiss nur der Browser.
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((abo) => setLage(abo ? "an" : abonniert ? "aus" : "aus"))
      .catch(() => setLage("aus"));
  }, [publicKey, abonniert]);

  async function einschalten() {
    setPending(true);
    setFehler(null);
    try {
      const erlaubnis = await Notification.requestPermission();
      if (erlaubnis !== "granted") {
        setLage(erlaubnis === "denied" ? "abgelehnt" : "aus");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const abo = await reg.pushManager.subscribe({
        // Pflicht: Jede Push-Nachricht muss zu einer sichtbaren
        // Benachrichtigung fuehren. Stille Pushes erlauben die Browser nicht.
        userVisibleOnly: true,
        applicationServerKey: schluesselAlsBytes(publicKey!),
      });

      const antwort = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(abo.toJSON()),
      });
      if (!antwort.ok) {
        const daten = await antwort.json().catch(() => ({ error: "Das hat nicht geklappt." }));
        setFehler(daten.error ?? "Das hat nicht geklappt.");
        return;
      }
      setLage("an");
    } catch {
      setFehler("Das hat nicht geklappt. Versuch es noch einmal.");
    } finally {
      setPending(false);
    }
  }

  async function ausschalten() {
    setPending(true);
    setFehler(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const abo = await reg.pushManager.getSubscription();
      if (abo) {
        await fetch("/api/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: abo.endpoint }),
        });
        await abo.unsubscribe();
      }
      setLage("aus");
    } catch {
      setFehler("Das hat nicht geklappt. Versuch es noch einmal.");
    } finally {
      setPending(false);
    }
  }

  if (lage === "wird-geprueft" || lage === "nicht-moeglich") return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-medium text-slate-900">Benachrichtigungen</h2>

      {fehler ? (
        <div className="mt-2">
          <ErrorNote>{fehler}</ErrorNote>
        </div>
      ) : null}

      {lage === "installation-noetig" ? (
        <p className="mt-1 text-sm text-slate-600">
          Auf dem iPhone und iPad gehen Benachrichtigungen nur, wenn die App auf dem
          Home-Bildschirm liegt: unten auf das Teilen-Symbol tippen, dann „Zum Home-Bildschirm".
          Danach kannst du sie hier einschalten.
        </p>
      ) : lage === "abgelehnt" ? (
        <p className="mt-1 text-sm text-slate-600">
          Du hast Benachrichtigungen fuer diese App abgelehnt. Das laesst sich nur in den
          Einstellungen deines Geraets zuruecknehmen, nicht von hier aus.
        </p>
      ) : lage === "an" ? (
        <>
          <p className="mt-1 text-sm text-slate-600">
            Dieses Geraet wird benachrichtigt: bei Anfragen, Zusagen, Nachrichten und Terminen.
            Zwischen 22 und 7 Uhr bleibt es still.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={ausschalten}
            className="mt-4 rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {pending ? "Wird ausgeschaltet ..." : "Ausschalten"}
          </button>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-slate-600">
            Lass dich benachrichtigen, wenn jemand antwortet oder ein Termin ansteht - statt
            selbst nachsehen zu muessen. Nachts bleibt es still.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={einschalten}
            className="mt-4 rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {pending ? "Wird eingeschaltet ..." : "Benachrichtigungen einschalten"}
          </button>
        </>
      )}
    </div>
  );
}

function istApple(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || navigator.platform === "MacIntel";
}

function istInstalliert(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari auf iOS meldet den installierten Zustand hierueber.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
