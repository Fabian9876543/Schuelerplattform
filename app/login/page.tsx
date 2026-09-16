import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login/login-form";
import { Card, PageTitle } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");

  return (
    <div className="mx-auto max-w-md">
      <PageTitle title="Anmelden" subtitle="Melde dich an, um deine Lernplaene zu sehen." />
      <Card>
        <LoginForm />
      </Card>
      <p className="mt-4 text-center text-sm text-slate-600">
        Noch kein Konto?{" "}
        <Link href="/register" className="font-medium text-brand-600 hover:underline">
          Jetzt registrieren
        </Link>
      </p>
    </div>
  );
}
