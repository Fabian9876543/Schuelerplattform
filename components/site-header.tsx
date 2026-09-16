import Link from "next/link";

import type { SessionUser } from "@/lib/auth";

export function SiteHeader({ user }: { user: SessionUser | null }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4">
        <Link href="/" className="text-lg font-semibold text-slate-900">
          Schuelerplattform
        </Link>

        {user ? (
          <>
            <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
              <Link href="/" className="hover:text-brand-600">
                Meine Klausuren
              </Link>
              <Link href="/nachhilfe" className="hover:text-brand-600">
                Nachhilfe finden
              </Link>
              <Link href="/nachhilfe/anbieten" className="hover:text-brand-600">
                Nachhilfe geben
              </Link>
              <Link href="/anfragen" className="hover:text-brand-600">
                Anfragen
              </Link>
            </nav>
            <div className="ml-auto flex items-center gap-3 text-sm">
              <span className="text-slate-500">
                {user.name} &middot; Klasse {user.gradeLevel}
              </span>
              <form action="/api/auth/logout" method="post">
                <button type="submit" className="text-slate-600 underline hover:text-slate-900">
                  Abmelden
                </button>
              </form>
            </div>
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
