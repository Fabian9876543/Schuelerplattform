"use client";

import { useState } from "react";

import { formatDayWithWeekday, formatMinutes } from "@/lib/format";

interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  estimatedMinutes: number;
  done: boolean;
  skipped: boolean;
  topicName: string | null;
}

export function StudyPlan({ tasks }: { tasks: Task[] }) {
  // Die Aufgaben kommen aus den Props und bleiben es auch: Ein useState(tasks)
  // wuerde den ersten Stand einfrieren, sodass Aenderungen von aussen - etwa
  // weil ein Thema jetzt sitzt und Aufgaben entfallen - nie ankaemen.
  // Lokal liegt nur das eigene Abhaken, damit es sich sofort anfuehlt.
  const [eigeneHaken, setEigeneHaken] = useState<Record<string, boolean>>({});
  const state = tasks.map((task) => ({ ...task, done: eigeneHaken[task.id] ?? task.done }));

  async function toggle(id: string, done: boolean) {
    setEigeneHaken((current) => ({ ...current, [id]: done }));

    const response = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done }),
    });

    if (!response.ok) {
      // Zurueck auf den Stand, den der Server kennt.
      setEigeneHaken((current) => {
        const rest = { ...current };
        delete rest[id];
        return rest;
      });
    }
  }

  // Aufgaben nach Tag gruppieren, damit der Plan als Kalender lesbar ist.
  const byDay = new Map<string, Task[]>();
  for (const task of state) {
    const key = task.dueDate.slice(0, 10);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(task);
    else byDay.set(key, [task]);
  }

  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  const aktiv = state.filter((task) => !task.skipped);
  const doneCount = aktiv.filter((task) => task.done).length;
  const skippedCount = state.filter((task) => task.skipped).length;
  const totalMinutes = aktiv.reduce((sum, task) => sum + (task.done ? 0 : task.estimatedMinutes), 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <span>
          {doneCount} von {aktiv.length} Aufgaben erledigt
          {skippedCount > 0 ? ` · ${skippedCount} entfallen, weil das Thema sitzt` : ""}
        </span>
        <span>Noch etwa {formatMinutes(totalMinutes)} Lernzeit</span>
      </div>

      <div className="space-y-4">
        {days.map(([day, dayTasks]) => (
          <div key={day}>
            <h3 className="mb-2 text-sm font-medium text-slate-500">
              {formatDayWithWeekday(new Date(`${day}T12:00:00`))}
            </h3>
            <div className="space-y-2">
              {dayTasks.map((task) => (
                <label
                  key={task.id}
                  className={`flex gap-3 rounded-lg border p-4 transition ${
                    task.skipped
                      ? "border-dashed border-emerald-200 bg-emerald-50/40"
                      : task.done
                        ? "cursor-pointer border-slate-200 bg-slate-50"
                        : "cursor-pointer border-slate-200 bg-white hover:border-brand-200"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={task.done}
                    disabled={task.skipped}
                    onChange={(event) => toggle(task.id, event.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 accent-indigo-600 disabled:opacity-40"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`font-medium ${task.done ? "text-slate-400 line-through" : "text-slate-900"}`}
                      >
                        {task.title}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatMinutes(task.estimatedMinutes)}
                      </span>
                      {task.skipped ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          entfallen &ndash; Thema sitzt
                        </span>
                      ) : null}
                    </div>
                    <p className={`mt-1 text-sm ${task.done ? "text-slate-400" : "text-slate-600"}`}>
                      {task.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
