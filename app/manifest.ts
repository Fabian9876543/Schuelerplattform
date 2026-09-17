import type { MetadataRoute } from "next";

/**
 * Das Manifest macht aus der Webseite eine App, die sich auf den
 * Home-Bildschirm legen laesst: eigenes Symbol, eigener Eintrag im
 * App-Umschalter, Start im Vollbild ohne Adressleiste.
 *
 * Next.js liefert diese Datei als /manifest.webmanifest aus und verlinkt sie
 * selbst im <head> - deshalb steht hier nur der Inhalt.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Schuelerplattform",
    // Steht unter dem Symbol auf dem Home-Bildschirm. iOS kuerzt nach etwa
    // zwoelf Zeichen, deshalb absichtlich kurz.
    short_name: "Lernplan",
    description:
      "Lernplan mit Auswertung und Nachhilfe unter Mitschuelern derselben Schule.",
    lang: "de",
    start_url: "/",
    // standalone = ohne Browserleiste, wie eine installierte App
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#4f46e5",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android schneidet Symbole in seine eigene Form. Dafuer braucht es
      // eine randlose Fassung, sonst sitzt das Motiv in einem weissen Kaestchen.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
