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
  topicName: string | null;
}

export function StudyPlan({ tasks }: { tasks: Task[] }) {
  const [state, setState] = useState(tasks);

  async function toggle(id: string, done: boolean) {
    // Sofort umschalten, damit sich das Abhaken direkt anfuehlt; bei einem
    // Fehler wird zurueckgesetzt.
    setState((current) => current.map((task) => (task.id === id ? { ...task, done } : task)));

    const response = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done }),
    });

    if (!response.ok) {
      setState((current) => current.map((task) => (task.id === id ? { ...task, done: !done } : task)));
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
  const doneCount = state.filter((task) => task.done).length;
  const totalMinutes = state.reduce((sum, task) => sum + (task.done ? 0 : task.estimatedMinutes), 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <span>
          {doneCount} von {state.length} Aufgaben erledigt
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
                  className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition ${
                    task.done
                      ? "border-slate-200 bg-slate-50"
                      : "border-slate-200 bg-white hover:border-brand-200"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={(event) => toggle(task.id, event.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 accent-indigo-600"
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
