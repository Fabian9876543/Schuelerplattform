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

/*
 * Benachrichtigungen.
 *
 * Der Server schickt den fertigen Text (siehe lib/push.ts) - hier wird nichts
 * zusammengebaut, nur angezeigt. `tag` sorgt dafuer, dass eine zweite
 * Nachricht aus demselben Verlauf die erste ersetzt statt sich daneben zu
 * legen.
 */
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let inhalt;
  try {
    inhalt = event.data.json();
  } catch {
    return; // Nichts Lesbares - dann auch keine Benachrichtigung.
  }

  event.waitUntil(
    self.registration.showNotification(inhalt.title ?? "Schuelerplattform", {
      body: inhalt.body ?? "",
      tag: inhalt.tag,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: inhalt.url ?? "/" },
    }),
  );
});

/*
 * Klick auf die Benachrichtigung: Ein schon offenes Fenster der App wird
 * benutzt und auf die Zielseite geschickt. Nur wenn keines offen ist, wird
 * eines geoeffnet - sonst haette man die App zweimal.
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const ziel = event.notification.data?.url ?? "/";

  event.waitUntil(
    (async () => {
      const fenster = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of fenster) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(ziel);
          return;
        }
      }
      await self.clients.openWindow(ziel);
    })(),
  );
});
