import type { Metadata, Viewport } from "next";

import { ServiceWorker } from "@/components/service-worker";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { unreadTotal } from "@/lib/messages-db";
import { openReportCount } from "@/lib/reports-db";

import "./globals.css";

export const metadata: Metadata = {
  title: "Schuelerplattform",
  description: "Lernplan mit Auswertung und Nachhilfe von Mitschuelern",
  // Laesst iOS die App vom Home-Bildschirm im Vollbild starten. Das Manifest
  // sagt dasselbe; aeltere iOS-Fassungen lesen nur diese Angabe.
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Lernplan" },
  // Next.js schreibt daraus das standardisierte "mobile-web-app-capable".
  // iOS vor 16.4 kennt nur die Apple-Schreibweise und startet sonst mit
  // Adressleiste - in einer Schulklasse sind auch aeltere Geraete unterwegs.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4f46e5",
  // Die Seite reicht bis in die Ecken - auch unter die Notch. Damit dort
  // nichts verdeckt wird, halten die Abstaende in globals.css die
  // Sicherheitsbereiche frei.
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Eine Zaehlabfrage je Seitenaufruf - sonst faellt niemandem auf, dass eine
  // Nachricht angekommen ist, solange er nicht zufaellig die Anfragen oeffnet.
  const unread = user ? await unreadTotal(user.id) : 0;
  // Nur fuer Verwalter - sonst waere es eine Abfrage fuer eine Zahl, die
  // niemand zu sehen bekommt.
  const offeneMeldungen = user?.isAdmin ? await openReportCount(user.schoolId) : 0;

  return (
    <html lang="de">
      <body className="min-h-screen antialiased">
        <SiteHeader user={user} unread={unread} offeneMeldungen={offeneMeldungen} />
        <main className="mx-auto w-full max-w-5xl px-4 py-8">{children}</main>
        <footer className="fusszeile mx-auto w-full max-w-5xl px-4 pb-10 text-sm text-slate-500">
          Schuelerplattform &ndash; Lernplanung und Nachhilfe unter Mitschuelern.
        </footer>
        <ServiceWorker />
      </body>
    </html>
  );
}
