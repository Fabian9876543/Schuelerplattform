import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { unreadTotal } from "@/lib/messages-db";

import "./globals.css";

export const metadata: Metadata = {
  title: "Schuelerplattform",
  description: "Lernplan mit Auswertung und Nachhilfe von Mitschuelern",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Eine Zaehlabfrage je Seitenaufruf - sonst faellt niemandem auf, dass eine
  // Nachricht angekommen ist, solange er nicht zufaellig die Anfragen oeffnet.
  const unread = user ? await unreadTotal(user.id) : 0;

  return (
    <html lang="de">
      <body className="min-h-screen antialiased">
        <SiteHeader user={user} unread={unread} />
        <main className="mx-auto w-full max-w-5xl px-4 py-8">{children}</main>
        <footer className="mx-auto w-full max-w-5xl px-4 pb-10 text-sm text-slate-500">
          Schuelerplattform &ndash; Lernplanung und Nachhilfe unter Mitschuelern.
        </footer>
      </body>
    </html>
  );
}
