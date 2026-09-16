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

/** Wie viele Wiederholungen ein Thema je nach Schwere verdient. */
function sessionOffsets(severity: number): number[] {
  if (severity >= 3) return [0, 3, 7];
  if (severity === 2) return [0, 4];
  return [0];
}

function minutesFor(severity: number, isRepetition: boolean): number {
  const base = severity >= 3 ? 60 : severity === 2 ? 45 : 30;
  return isRepetition ? Math.round(base * 0.5) : base;
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
        ? `Arbeite ${topicName} von Grund auf durch: Regeln im Heft nachlesen, ein Beispiel Schritt fuer Schritt nachrechnen und anschliessend zwei Aufgaben allein loesen.`
        : `Wiederhole die Regeln zu ${topicName} und rechne zwei bis drei Uebungsaufgaben.`;
    return {
      title: `${topicName}: Grundlagen aufarbeiten`,
      description: focus ? `Schwerpunkt: ${focus}. ${base}` : base,
    };
  }
  if (round === 1) {
    return {
      title: `${topicName}: ueben`,
      description: focus
        ? `Loese Aufgaben zu ${topicName} ohne Hilfsmittel, besonders zu: ${focus}. Notiere dir, an welcher Stelle du haengen bleibst.`
        : `Loese Aufgaben zu ${topicName} ohne Hilfsmittel. Notiere dir, an welcher Stelle du haengen bleibst.`,
    };
  }
  return {
    title: `${topicName}: kurz auffrischen`,
    description: `Gehe deine Notizen zu ${topicName} durch und rechne eine Aufgabe zur Kontrolle.`,
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

    sessionOffsets(deficit.severity).forEach((offset, round) => {
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
    description: `Gehe alle Themen noch einmal im Schnelldurchlauf durch: ${topicList}. Rechne zu jedem Thema eine Aufgabe und schau dir gezielt an, was dir noch schwerfaellt.`,
    estimatedMinutes: 45,
  });

  return tasks.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}
