import Link from "next/link";

import { Card, EmptyState, LinkButton, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import {
  buildMonthGrid,
  dayKey,
  monthKey,
  monthLabel,
  parseDayKey,
  parseMonthKey,
  shiftMonth,
  startOfMonth,
  WEEKDAY_LABELS,
} from "@/lib/calendar";
import { prisma } from "@/lib/db";
import { describeCountdown, formatDate, formatMinutes } from "@/lib/format";
import { daysBetween } from "@/lib/planning";

interface Klausur {
  goalId: string;
  title: string;
  subject: string;
}

interface Aufgabe {
  id: string;
  goalId: string;
  title: string;
  subject: string;
  estimatedMinutes: number;
  done: boolean;
}

/**
 * Der Pruefungskalender.
 *
 * Bewusst ohne JavaScript im Browser: Monatswechsel und Tagesauswahl sind
 * gewoehnliche Links mit ?monat= und ?tag=. Das haelt die Seite klein, macht
 * jeden Stand teilbar (ein Link zeigt immer denselben Tag) und der Zurueck-
 * Knopf tut, was man erwartet.
 */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ monat?: string; tag?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const heute = new Date();
  const monat = parseMonthKey(params.monat) ?? startOfMonth(heute);
  const raster = buildMonthGrid(monat, heute);
  // Die Grenzen umfassen den ganzen ersten und letzten Tag des Rasters.
  // Lernaufgaben liegen zwar mittags, aber die Auswahl soll nicht an einer
  // Uhrzeit haengen.
  const von = new Date(raster[0][0].date);
  von.setHours(0, 0, 0, 0);
  const bis = new Date(raster.at(-1)!.at(-1)!.date);
  bis.setHours(23, 59, 59, 999);

  const [goals, tasks] = await Promise.all([
    // Alle Klausuren, nicht nur die des Monats: Daraus entsteht unten der
    // Hinweis auf die naechste, wenn im offenen Monat keine ansteht.
    prisma.learningGoal.findMany({
      where: { userId: user.id },
      select: { id: true, title: true, subject: true, examDate: true },
      orderBy: { examDate: "asc" },
    }),
    prisma.studyTask.findMany({
      where: {
        evaluation: { assessment: { learningGoal: { userId: user.id } } },
        dueDate: { gte: von, lte: bis },
        // Entfallene Aufgaben stehen nicht im Kalender - das Thema sitzt ja.
        skipped: false,
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        estimatedMinutes: true,
        done: true,
        evaluation: {
          select: {
            assessment: {
              select: { learningGoal: { select: { id: true, subject: true } } },
            },
          },
        },
      },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  const klausurenProTag = new Map<string, Klausur[]>();
  for (const goal of goals) {
    const schluessel = dayKey(goal.examDate);
    const liste = klausurenProTag.get(schluessel) ?? [];
    liste.push({ goalId: goal.id, title: goal.title, subject: goal.subject });
    klausurenProTag.set(schluessel, liste);
  }

  const aufgabenProTag = new Map<string, Aufgabe[]>();
  for (const task of tasks) {
    const goal = task.evaluation.assessment.learningGoal;
    const schluessel = dayKey(task.dueDate);
    const liste = aufgabenProTag.get(schluessel) ?? [];
    liste.push({
      id: task.id,
      goalId: goal.id,
      title: task.title,
      subject: goal.subject,
      estimatedMinutes: task.estimatedMinutes,
      done: task.done,
    });
    aufgabenProTag.set(schluessel, liste);
  }

  // Ohne Angabe ist der heutige Tag gemeint - aber nur, wenn er im gezeigten
  // Monat liegt. Blaettert man weiter, ist zunaechst kein Tag ausgewaehlt.
  const angefragterTag = parseDayKey(params.tag);
  const gewaehlt =
    angefragterTag && monthKey(angefragterTag) === monthKey(monat)
      ? angefragterTag
      : monthKey(heute) === monthKey(monat)
        ? heute
        : null;
  const gewaehltKey = gewaehlt ? dayKey(gewaehlt) : null;

  const naechsteKlausur = goals.find((goal) => daysBetween(heute, goal.examDate) >= 0);
  const klausurenImMonat = goals.filter((goal) => monthKey(goal.examDate) === monthKey(monat));

  return (
    <div>
      <PageTitle
        title="Kalender"
        subtitle="Klausuren und Lernaufgaben auf einen Blick."
      />

      {goals.length === 0 ? (
        <EmptyState title="Noch keine Klausur eingetragen">
          <p>Sobald eine Klausur eingetragen ist, steht sie hier - und mit dem Lernplan auch
            die Aufgaben auf den Tagen davor.</p>
          <div className="mt-4">
            <LinkButton href="/lernplan/neu">Klausur eintragen</LinkButton>
          </div>
        </EmptyState>
      ) : (
        <>
          <Card className="mb-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <Link
                href={`/kalender?monat=${monthKey(shiftMonth(monat, -1))}`}
                aria-label="Voriger Monat"
                className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100"
              >
                &larr;
              </Link>

              <div className="text-center">
                <h2 className="font-semibold text-slate-900">{monthLabel(monat)}</h2>
                {monthKey(heute) === monthKey(monat) ? null : (
                  <Link href="/kalender" className="text-xs text-brand-600 hover:underline">
                    zu heute
                  </Link>
                )}
              </div>

              <Link
                href={`/kalender?monat=${monthKey(shiftMonth(monat, 1))}`}
                aria-label="Naechster Monat"
                className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100"
              >
                &rarr;
              </Link>
            </div>

            {/* Eine Tabelle, weil es eine ist: Wochentage als Spaltenkoepfe,
                eine Zeile je Woche. Vorlesegeraete koennen damit umgehen. */}
            <table className="w-full table-fixed border-collapse">
              <thead>
                <tr>
                  {WEEKDAY_LABELS.map((tag) => (
                    <th
                      key={tag}
                      scope="col"
                      className="pb-2 text-center text-xs font-medium text-slate-500"
                    >
                      {tag}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {raster.map((woche) => (
                  <tr key={woche[0].key}>
                    {woche.map((tag) => {
                      const klausuren = klausurenProTag.get(tag.key) ?? [];
                      const aufgaben = aufgabenProTag.get(tag.key) ?? [];
                      const offen = aufgaben.filter((aufgabe) => !aufgabe.done).length;
                      const istGewaehlt = tag.key === gewaehltKey;

                      return (
                        <td key={tag.key} className="p-0.5 align-top">
                          <Link
                            href={`/kalender?monat=${monthKey(monat)}&tag=${tag.key}`}
                            aria-current={istGewaehlt ? "date" : undefined}
                            className={`flex h-14 flex-col items-center justify-start gap-1 rounded-md border py-1.5 transition sm:h-16 ${
                              istGewaehlt
                                ? "border-brand-500 bg-brand-50"
                                : klausuren.length > 0
                                  ? "border-red-200 bg-red-50 hover:bg-red-100"
                                  : "border-transparent hover:bg-slate-100"
                            } ${tag.inMonth ? "" : "opacity-40"}`}
                          >
                            <span
                              className={`text-sm leading-none ${
                                tag.isToday
                                  ? "rounded-full bg-brand-600 px-1.5 py-1 font-semibold text-white"
                                  : "px-1.5 py-1 text-slate-700"
                              }`}
                            >
                              {tag.date.getDate()}
                            </span>

                            <span className="flex items-center gap-1 leading-none">
                              {klausuren.length > 0 ? (
                                <span
                                  className="h-2 w-2 rounded-full bg-red-500"
                                  aria-label={`Klausur: ${klausuren.map((k) => k.subject).join(", ")}`}
                                />
                              ) : null}
                              {offen > 0 ? (
                                <span
                                  className="rounded-full bg-brand-100 px-1.5 text-xs font-medium text-brand-700"
                                  aria-label={`${offen} offene Aufgaben`}
                                >
                                  {offen}
                                </span>
                              ) : aufgaben.length > 0 ? (
                                <span className="text-xs text-emerald-600" aria-label="alles erledigt">
                                  &#10003;
                                </span>
                              ) : null}
                            </span>
                          </Link>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" /> Klausur
              </span>
              <span className="flex items-center gap-1.5">
                <span className="rounded-full bg-brand-100 px-1.5 font-medium text-brand-700" aria-hidden="true">
                  2
                </span>
                offene Lernaufgaben
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-emerald-600" aria-hidden="true">&#10003;</span> alles erledigt
              </span>
            </div>
          </Card>

          {klausurenImMonat.length === 0 && naechsteKlausur ? (
            <p className="mb-4 text-sm text-slate-600">
              In diesem Monat steht keine Klausur an. Die naechste ist{" "}
              <Link href={`/lernplan/${naechsteKlausur.id}`} className="font-medium underline">
                {naechsteKlausur.title}
              </Link>{" "}
              am {formatDate(naechsteKlausur.examDate)} (
              {describeCountdown(daysBetween(heute, naechsteKlausur.examDate))}).
            </p>
          ) : null}

          <DayDetail
            tag={gewaehlt}
            klausuren={gewaehltKey ? (klausurenProTag.get(gewaehltKey) ?? []) : []}
            aufgaben={gewaehltKey ? (aufgabenProTag.get(gewaehltKey) ?? []) : []}
            heute={heute}
          />
        </>
      )}
    </div>
  );
}

/** Was an dem angetippten Tag ansteht. */
function DayDetail({
  tag,
  klausuren,
  aufgaben,
  heute,
}: {
  tag: Date | null;
  klausuren: Klausur[];
  aufgaben: Aufgabe[];
  heute: Date;
}) {
  if (!tag) {
    return (
      <p className="text-sm text-slate-500">
        Tippe auf einen Tag, um zu sehen, was dann ansteht.
      </p>
    );
  }

  const abstand = daysBetween(heute, tag);

  return (
    <Card>
      <h2 className="font-medium text-slate-900">
        {formatDate(tag)}
        <span className="ml-2 text-sm font-normal text-slate-500">{describeCountdown(abstand)}</span>
      </h2>

      {klausuren.length === 0 && aufgaben.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">An diesem Tag steht nichts an.</p>
      ) : null}

      {klausuren.map((klausur) => (
        <div
          key={klausur.goalId}
          className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2"
        >
          <Link href={`/lernplan/${klausur.goalId}`} className="font-medium text-red-800 underline">
            {klausur.title}
          </Link>
          <span className="ml-2 text-sm text-red-700">{klausur.subject}</span>
        </div>
      ))}

      {aufgaben.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {aufgaben.map((aufgabe) => (
            <li key={aufgabe.id} className="flex items-start gap-2">
              {/* Haken fuer erledigt, hohler Kreis fuer offen - ein blasser
                  Haken sieht aus wie ein halb erledigter. */}
              <span
                className={`mt-1 text-sm ${aufgabe.done ? "text-emerald-600" : "text-slate-400"}`}
                aria-hidden="true"
              >
                {aufgabe.done ? "\u2713" : "\u25CB"}
              </span>
              <span className="flex-1">
                <Link
                  href={`/lernplan/${aufgabe.goalId}`}
                  className={`hover:underline ${aufgabe.done ? "text-slate-500 line-through" : "text-slate-800"}`}
                >
                  {aufgabe.title}
                </Link>
                <span className="ml-2 text-xs text-slate-500">
                  {aufgabe.subject} &middot; {formatMinutes(aufgabe.estimatedMinutes)}
                  {aufgabe.done ? " · erledigt" : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
