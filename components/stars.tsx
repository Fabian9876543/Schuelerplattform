import { formatStars, STAR_MAX } from "@/lib/ratings";

/**
 * Sterne zum Ansehen, nicht zum Klicken.
 *
 * Die gefuellten Sterne sind gerundet - daneben steht der genaue Wert, damit
 * aus 4,4 und 4,6 nicht dasselbe Bild wird. Fuer Vorlesegeraete steht der
 * Wert im aria-label; die Sternzeichen selbst bleiben ausgeblendet, sonst
 * liest das Geraet fuenfmal "Stern".
 */
export function Stars({ value, count }: { value: number; count?: number }) {
  const gefuellt = Math.round(value);

  return (
    <span
      className="inline-flex items-center gap-1.5 text-sm"
      aria-label={`${formatStars(value)} von ${STAR_MAX} Sternen${
        count === undefined ? "" : `, ${count} Rueckmeldungen`
      }`}
    >
      <span className="text-amber-500" aria-hidden="true">
        {"★".repeat(gefuellt)}
        {"☆".repeat(STAR_MAX - gefuellt)}
      </span>
      <span className="font-medium text-slate-700">{formatStars(value)}</span>
      {count === undefined ? null : <span className="text-slate-500">({count})</span>}
    </span>
  );
}
