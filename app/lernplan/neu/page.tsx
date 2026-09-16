import { NewGoalForm } from "@/app/lernplan/neu/new-goal-form";
import { Card, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export default async function NewGoalPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle
        title="Klausur eintragen"
        subtitle="Trage Datum, Fach und die Themen ein. Danach machst du einen kurzen Selbsttest."
      />
      <Card>
        <NewGoalForm />
      </Card>
    </div>
  );
}
