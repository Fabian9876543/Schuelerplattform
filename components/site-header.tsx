import Link from "next/link";

import { MobileMenu } from "@/components/mobile-menu";
import { NAV_ITEMS } from "@/components/nav-items";
import type { SessionUser } from "@/lib/auth";

/**
 * Auf breiten Displays steht alles in einer Zeile. Auf dem Handy bleibt nur
 * Logo und Menü-Knopf stehen; die Navigation klappt darunter auf (MobileMenu).
 */
export function SiteHeader({ user }: { user: SessionUser | null }) {
  return (
    <header className="relative border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="text-lg font-semibold text-slate-900">
          Schuelerplattform
        </Link>

        {user ? (
          <>
            <nav className="hidden items-center gap-x-5 text-sm text-slate-600 md:flex">
              {NAV_ITEMS.map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-brand-600">
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="ml-auto hidden items-center gap-3 text-sm md:flex">
              <span className="text-slate-500">
                {user.name} &middot; Klasse {user.gradeLevel}
              </span>
              <form action="/api/auth/logout" method="post">
                <button type="submit" className="text-slate-600 underline hover:text-slate-900">
                  Abmelden
                </button>
              </form>
            </div>

            <MobileMenu user={user} />
          </>
        ) : (
          <div className="ml-auto flex items-center gap-4 text-sm">
            <Link href="/login" className="text-slate-600 hover:text-brand-600">
              Anmelden
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700"
            >
              Registrieren
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
