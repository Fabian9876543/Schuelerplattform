/*
 * Service Worker der Schuelerplattform - absichtlich minimal.
 *
 * Aufgabe: eine verstaendliche Seite zeigen, wenn jemand die App ohne Netz
 * oeffnet. Sonst nichts. Insbesondere werden weder Skripte noch Antworten
 * der Schnittstellen zwischengespeichert: Ein Zwischenspeicher, der eine
 * Fassung zu lange haelt, zeigt nach dem naechsten Update alte Inhalte, und
 * das ist schwerer zu finden als es wert ist.
 */
const CACHE = "schuelerplattform-offline-v1";
const OFFLINE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([OFFLINE])).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  // Aeltere Fassungen dieses Zwischenspeichers aufraeumen.
  event.waitUntil(
    caches
      .keys()
      .then((namen) => Promise.all(namen.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Nur echte Seitenaufrufe abfangen. Alles andere - Skripte, Bilder,
  // Schnittstellen - geht unveraendert ins Netz.
  if (request.method !== "GET" || request.mode !== "navigate") return;

  event.respondWith(
    fetch(request).catch(() => caches.match(OFFLINE).then((antwort) => antwort ?? Response.error())),
  );
});
