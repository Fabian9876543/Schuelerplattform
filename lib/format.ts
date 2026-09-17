const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const weekdayFormatter = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

/** "17.09.2026, 14:32 Uhr" - fuer einzelne Nachrichten im Verlauf. */
export function formatDateTime(date: Date): string {
  return `${dateFormatter.format(date)}, ${timeFormatter.format(date)} Uhr`;
}

export function formatDayWithWeekday(date: Date): string {
  return weekdayFormatter.format(date);
}

/** "in 5 Tagen", "morgen", "heute" - fuer den Countdown bis zur Klausur. */
export function describeCountdown(days: number): string {
  if (days < 0) return "bereits vorbei";
  if (days === 0) return "heute";
  if (days === 1) return "morgen";
  return `in ${days} Tagen`;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} Std.` : `${hours} Std. ${rest} Min.`;
}
