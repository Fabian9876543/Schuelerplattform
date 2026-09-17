"use client";

import { useEffect } from "react";

/**
 * Meldet den Service Worker an.
 *
 * Er tut absichtlich fast nichts: Er legt nur eine Offline-Seite beiseite und
 * zeigt sie, wenn ein Seitenaufruf ohne Netz scheitert. Bewusst **kein**
 * Zwischenspeichern von Skripten oder Daten - das ist die haeufigste Ursache
 * dafuer, dass eine installierte App nach einem Update alte Inhalte zeigt.
 *
 * Gebraucht wird er trotzdem: Ohne Service Worker bietet Android das
 * Installieren nicht an.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Nach dem Laden anmelden, damit die Anmeldung den ersten Aufbau der
    // Seite nicht aufhaelt.
    const anmelden = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Kein Grund, die App zu stoeren - ohne Service Worker laeuft alles,
        // nur das Installieren auf Android faellt weg.
      });
    };
    if (document.readyState === "complete") anmelden();
    else window.addEventListener("load", anmelden, { once: true });
  }, []);

  return null;
}
