"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ErrorNote } from "@/components/ui";

export function RequestActions({
  requestId,
  role,
}: {
  requestId: string;
  role: "tutor" | "requester";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function respond(status: "accepted" | "declined" | "withdrawn") {
    setPending(true);
    setError(null);

    const response = await fetch(`/api/tutoring-requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: "Das hat nicht geklappt." }));
      setError(body.error ?? "Das hat nicht geklappt.");
      setPending(false);
      return;
    }

    setPending(false);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {role === "tutor" ? (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => respond("accepted")}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            Zusagen
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => respond("declined")}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Ablehnen
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => respond("withdrawn")}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          Zurueckziehen
        </button>
      )}
    </div>
  );
}
