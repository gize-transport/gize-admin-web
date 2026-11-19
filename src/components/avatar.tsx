import { cn } from "@/lib/utils";

let graphemes: Intl.Segmenter | null | undefined;

/** A word's first letter with its marks (e + ´ stays é); just the first character in browsers without `Intl.Segmenter`. */
function firstLetter(word: string) {
  if (graphemes === undefined) {
    graphemes =
      typeof Intl.Segmenter === "function"
        ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
        : null;
  }
  const first = graphemes
    ? Array.from(graphemes.segment(word))[0]?.segment
    : Array.from(word)[0];
  return first ?? "";
}

/**
 * The first letters of the first two words ("Abebe Kebede Tesfaye" → "AK": given and father's
 * name). Words that don't start with a letter ("(Driver)") are skipped.
 */
export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter((word) => /^\p{L}/u.test(word))
    .slice(0, 2)
    .map(firstLetter)
    .join("")
    .toLocaleUpperCase();
}

/**
 * A person's initials in a circle. For sight only: always put the name beside it, so screen
 * readers hear the name once.
 */
export function Avatar({
  name,
  className,
}: {
  name: string;
  /** Colours for where it sits, e.g. on the navy sidebar. */
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full bg-ice font-display text-meta font-semibold text-navy",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
