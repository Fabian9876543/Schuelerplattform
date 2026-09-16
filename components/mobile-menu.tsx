"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { NAV_ITEMS } from "@/components/nav-items";
import type { SessionUser } from "@/lib/auth";

/**
 * Das ausklappbare Menü für schmale Displays.
 *
 * Bewusst als <details> statt mit React-State: So klappt das Menü auch dann
 * auf, wenn das JavaScript nicht geladen hat - der Browser kann das von sich
 * aus. Das JavaScript sorgt nur dafür, dass sich das Menü nach einer
 * Navigation wieder schliesst; ohne JavaScript erledigt das der Seitenwechsel.
 */
export function MobileMenu({ user }: { user: SessionUser }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);

  return (
    <details ref={ref} className="group ml-auto md:hidden">
      <summary
        aria-label="Menü öffnen"
        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-600 select-none hover:bg-slate-50 list-none [&::-webkit-details-marker]:hidden"
      >
        {/* Drei Striche, die im geöffneten Zustand zum Kreuz werden */}
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <line x1="4" y1="7" x2="20" y2="7" className="group-open:hidden" />
          <line x1="4" y1="12" x2="20" y2="12" className="group-open:hidden" />
          <line x1="4" y1="17" x2="20" y2="17" className="group-open:hidden" />
          <line x1="6" y1="6" x2="18" y2="18" className="hidden group-open:block" />
          <line x1="18" y1="6" x2="6" y2="18" className="hidden group-open:block" />
        </svg>
        Menü
      </summary>

      {/* Klappt unter der Leiste auf, über dem Seiteninhalt */}
      <div className="absolute inset-x-0 top-full z-20 border-b border-slate-200 bg-white shadow-lg">
        <nav className="mx-auto flex w-full max-w-5xl flex-col px-4 py-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`border-b border-slate-100 py-3 last:border-0 ${
                pathname === item.href ? "font-medium text-brand-600" : "text-slate-700"
              }`}
            >
              {item.label}
            </Link>
          ))}

          <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-3 pb-1 text-sm">
            <span className="text-slate-500">
              {user.name} &middot; Klasse {user.gradeLevel}
            </span>
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="px-2 py-1 text-slate-600 underline hover:text-slate-900">
                Abmelden
              </button>
            </form>
          </div>
        </nav>
      </div>
    </details>
  );
}
