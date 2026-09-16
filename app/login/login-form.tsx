"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, ErrorNote, Field, inputClass } from "@/components/ui";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const data = Object.fromEntries(new FormData(event.currentTarget));

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: "Anmeldung fehlgeschlagen." }));
      setError(body.error ?? "Anmeldung fehlgeschlagen.");
      setPending(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form
      method="post"
      onSubmit={onSubmit}
      className="space-y-4"
    >
      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <Field label="E-Mail">
        <input name="email" type="email" required autoComplete="email" className={inputClass} />
      </Field>

      <Field label="Passwort">
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={inputClass}
        />
      </Field>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Wird geprueft ..." : "Anmelden"}
      </Button>
    </form>
  );
}
