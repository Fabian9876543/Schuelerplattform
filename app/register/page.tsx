import Link from "next/link";
import { redirect } from "next/navigation";

import { RegisterForm } from "@/app/register/register-form";
import { Card, PageTitle } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/");

  return (
    <div className="mx-auto max-w-md">
      <PageTitle
        title="Konto anlegen"
        subtitle="Danach kannst du Klausuren eintragen und Nachhilfe finden."
      />
      <Card>
        <RegisterForm />
      </Card>
      <p className="mt-4 text-center text-sm text-slate-600">
        Schon ein Konto?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Anmelden
        </Link>
      </p>
    </div>
  );
}
