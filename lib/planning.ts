/**
 * Verteilt die Lernaufgaben auf echte Kalendertage.
 *
 * Diese Logik liegt bewusst im Code und nicht bei der KI: Die KI liefert nur,
 * WAS gelernt werden muss und wie gravierend die Luecke ist. WANN gelernt wird,
 * rechnet diese Datei aus - dadurch kann kein Termin nach dem Klausurdatum
 * entstehen und das Ergebnis ist testbar.
 *
 * Prinzip: schwerste Luecken zuerst und frueh, danach Wiederholungen im
 * Abstand von 3 und 7 Tagen (Spaced Repetition). Der letzte Lerntag vor der
 * Klausur bleibt fuer eine Gesamtwiederholung frei.
 */

export interface PlanDeficit {
  topicId: string;
  topicName: string;
  /** 1 = leicht, 2 = deutlich, 3 = gravierend */
  severity: number;
  /** Was konkret geuebt werden soll - kommt aus der Auswertung */
  focus?: string;
}

export interface PlannedTask {
  topicId: string | null;
  dueDate: Date;
  title: string;
  description: string;
  estimatedMinutes: number;
}

/** Mittags, damit Zeitzonen-Verschiebungen nie den Kalendertag kippen. */
export function atNoon(date: Date): Date {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = atNoon(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Ganze Kalendertage zwischen zwei Daten (b - a). */
export function daysBetween(a: Date, b: Date): number {
  const ms = atNoon(b).getTime() - atNoon(a).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Wie viele Wiederholungen ein Thema je nach Schwere verdient, in Tagen nach
 * der ersten Einheit. Die Abstaende folgen dem Spaced-Repetition-Gedanken.
 */
function baseOffsets(severity: number): number[] {
  if (severity >= 3) return [0, 3, 7];
  if (severity === 2) return [0, 4];
  return [0];
}

/**
 * Bei viel Vorlaufzeit werden die Abstaende gestreckt, damit die letzte
 * Wiederholung nicht Wochen vor der Klausur liegt. Bei knapper Zeit bleibt es
 * bei den engen Abstaenden.
 */
function sessionOffsets(severity: number, availableDays: number): number[] {
  const scale = Math.min(3, Math.max(1, availableDays / 10));
  return baseOffsets(severity).map((offset) => Math.round(offset * scale));
}

function minutesFor(severity: number, isRepetition: boolean): number {
  const base = severity >= 3 ? 60 : severity === 2 ? 45 : 30;
  if (!isRepetition) return base;
  // Auf 5 Minuten runden - "23 Min." liest sich wie ein Rechenfehler.
  return Math.max(15, Math.round((base * 0.5) / 5) * 5);
}

function describe(
  topicName: string,
  round: number,
  severity: number,
  focus?: string,
): { title: string; description: string } {
  if (round === 0) {
    // Wenn die Auswertung einen konkreten Schwerpunkt genannt hat, steht der
    // hier - er ist immer fachlich genauer als eine allgemeine Vorlage.
    const base =
      severity >= 3
        ? `Arbeite ${topicName} von Grund auf durch: im Heft oder Buch nachlesen, ein Beispiel Schritt fuer Schritt nachvollziehen und anschliessend zwei Aufgaben allein bearbeiten.`
        : `Wiederhole die Grundlagen zu ${topicName} und bearbeite zwei bis drei Uebungsaufgaben.`;
    return {
      title: `${topicName}: Grundlagen aufarbeiten`,
      description: focus ? `Schwerpunkt: ${focus}. ${base}` : base,
    };
  }
  if (round === 1) {
    return {
      title: `${topicName}: ueben`,
      description: focus
        ? `Bearbeite Aufgaben zu ${topicName} ohne Hilfsmittel, besonders zu: ${focus}. Notiere dir, an welcher Stelle du haengen bleibst.`
        : `Bearbeite Aufgaben zu ${topicName} ohne Hilfsmittel. Notiere dir, an welcher Stelle du haengen bleibst.`,
    };
  }
  return {
    title: `${topicName}: kurz auffrischen`,
    description: `Gehe deine Notizen zu ${topicName} durch und bearbeite eine Aufgabe zur Kontrolle.`,
  };
}

/**
 * @param deficits  erkannte Luecken, beliebige Reihenfolge
 * @param examDate  Tag der Klausur (an diesem Tag wird nicht mehr geplant)
 * @param today     Bezugstag, in Tests fest vorgebbar
 */
export function buildStudyPlan(
  deficits: PlanDeficit[],
  examDate: Date,
  today: Date = new Date(),
): PlannedTask[] {
  const start = atNoon(today);
  const exam = atNoon(examDate);

  // Gelernt wird von heute bis einschliesslich dem Tag vor der Klausur.
  const learningDays = daysBetween(start, exam);
  if (deficits.length === 0 || learningDays < 1) return [];

  const lastDayOffset = learningDays - 1;

  // Schwerste Luecke zuerst; bei Gleichstand alphabetisch, damit die
  // Reihenfolge reproduzierbar bleibt.
  const ordered = [...deficits].sort(
    (a, b) => b.severity - a.severity || a.topicName.localeCompare(b.topicName),
  );

  // Startpunkte ueber die erste Haelfte der Zeit staffeln, damit nicht alles
  // auf denselben Tag faellt. Bei sehr wenig Zeit ruecken alle zusammen.
  const spread = Math.max(1, Math.floor(lastDayOffset / 2));
  const tasks: PlannedTask[] = [];
  const seen = new Set<string>();

  ordered.forEach((deficit, index) => {
    const startOffset = ordered.length > 1 ? Math.min(Math.round((index * spread) / ordered.length), lastDayOffset) : 0;

    sessionOffsets(deficit.severity, lastDayOffset).forEach((offset, round) => {
      const dayOffset = startOffset + offset;
      // Was hinter den letzten Lerntag fiele, wird nicht erfunden - ausser der
      // ersten Einheit, die zur Not auf den letzten Tag rutscht.
      if (dayOffset > lastDayOffset && round > 0) return;
      const finalOffset = Math.min(dayOffset, lastDayOffset);

      // Pro Thema nicht zweimal am selben Tag.
      const key = `${deficit.topicId}:${finalOffset}`;
      if (seen.has(key)) return;
      seen.add(key);

      const { title, description } = describe(deficit.topicName, round, deficit.severity, deficit.focus);
      tasks.push({
        topicId: deficit.topicId,
        dueDate: addDays(start, finalOffset),
        title,
        description,
        estimatedMinutes: minutesFor(deficit.severity, round > 0),
      });
    });
  });

  // Der letzte Lerntag gehoert der Gesamtwiederholung.
  const topicList = ordered.map((d) => d.topicName).join(", ");
  tasks.push({
    topicId: null,
    dueDate: addDays(start, lastDayOffset),
    title: "Generalprobe vor der Klausur",
    description: `Gehe alle Themen noch einmal im Schnelldurchlauf durch: ${topicList}. Bearbeite zu jedem Thema eine Aufgabe und schau dir gezielt an, was dir noch schwerfaellt.`,
    estimatedMinutes: 45,
  });

  return tasks.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

// --- Neuplanung ------------------------------------------------------------

/**
 * Der Lernplan ist kein einmaliger Wurf: Sitzt ein Thema, sollen die Aufgaben
 * dazu entfallen; wackelt es wieder, leben sie auf. Und was liegen geblieben
 * ist, rutscht nach vorn statt in der Vergangenheit zu verstauben.
 *
 * Auch das rechnet bewusst der Code und nicht die KI - es ist reine Terminlogik
 * und soll nachvollziehbar und testbar bleiben.
 */

export type Mastery = "weak" | "medium" | "strong";

export interface ReplanTask {
  id: string;
  topicId: string | null;
  dueDate: Date;
  done: boolean;
  skipped: boolean;
}

export interface ReplanResult {
  /** Aufgaben, die entfallen, weil das Thema jetzt sitzt */
  skip: string[];
  /** Aufgaben, die wieder gebraucht werden, weil das Thema wackelt */
  unskip: string[];
  /** Liegengebliebene Aufgaben mit ihrem neuen Termin */
  move: { id: string; dueDate: Date }[];
}

/** Wie viele offene Aufgaben an einem Tag zumutbar sind. */
const MAX_PRO_TAG = 2;

/** Punkte je Ampelstufe - Grundlage fuer den Fortschritt in Prozent. */
const PUNKTE: Record<Mastery, number> = { weak: 0, medium: 50, strong: 100 };

/**
 * Fortschritt ueber alle Teilthemen, 0 bis 100.
 * Ohne Themen ist er 0 und nicht etwa 100 - nichts gelernt ist nicht fertig.
 */
export function progressPercent(masteries: Mastery[]): number {
  if (masteries.length === 0) return 0;
  const summe = masteries.reduce((s, m) => s + PUNKTE[m], 0);
  return Math.round(summe / masteries.length);
}

export function replan(
  tasks: ReplanTask[],
  masteryByTopic: Map<string, Mastery>,
  examDate: Date,
  today: Date = new Date(),
): ReplanResult {
  const heute = atNoon(today);
  const exam = atNoon(examDate);
  const result: ReplanResult = { skip: [], unskip: [], move: [] };

  const sitzt = (topicId: string | null) =>
    topicId !== null && masteryByTopic.get(topicId) === "strong";

  // Was entfaellt, was lebt wieder auf?
  for (const task of tasks) {
    if (task.done) continue;
    if (!task.skipped && sitzt(task.topicId)) result.skip.push(task.id);
    else if (task.skipped && !sitzt(task.topicId)) result.unskip.push(task.id);
  }

  const entfaellt = new Set(result.skip);
  const lebtAuf = new Set(result.unskip);
  const bleibtAktiv = (task: ReplanTask) =>
    !task.done && !entfaellt.has(task.id) && (!task.skipped || lebtAuf.has(task.id));

  // Belegung der kommenden Tage zaehlen, damit nichts uebereinandergestapelt
  // wird. Gelernt wird bis zum Tag vor der Klausur.
  const letzterTag = Math.max(0, daysBetween(heute, exam) - 1);
  const belegung = new Map<number, number>();
  for (const task of tasks) {
    if (!bleibtAktiv(task)) continue;
    const offset = daysBetween(heute, task.dueDate);
    if (offset >= 0) belegung.set(offset, (belegung.get(offset) ?? 0) + 1);
  }

  // Liegengebliebenes nach vorn holen, aelteste zuerst.
  const ueberfaellig = tasks
    .filter((task) => bleibtAktiv(task) && daysBetween(heute, task.dueDate) < 0)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  for (const task of ueberfaellig) {
    let ziel = letzterTag;
    for (let offset = 0; offset <= letzterTag; offset++) {
      if ((belegung.get(offset) ?? 0) < MAX_PRO_TAG) {
        ziel = offset;
        break;
      }
    }
    belegung.set(ziel, (belegung.get(ziel) ?? 0) + 1);
    result.move.push({ id: task.id, dueDate: addDays(heute, ziel) });
  }

  return result;
}
