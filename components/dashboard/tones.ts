/**
 * Accent tones shared by every icon tile in the product.
 *
 * `blue` and `sky` are both the brand azure — they exist as two names only so
 * neighbouring panels can differ by a single step without leaving the brand.
 * `emerald` / `amber` / `violet` are reserved for *meaning* (healthy, pending,
 * secondary category), never for decoration. `slate` is the neutral sixth —
 * for a category that isn't good/bad/pending, just "another kind" (e.g. a
 * role or entity type with no inherent status), never for anything that
 * could be read as an error state (that's `rose`/destructive, kept out of
 * this decorative set on purpose).
 */
export type AccentTone = "blue" | "emerald" | "amber" | "violet" | "sky" | "slate";

export const TONE_TILE_CLASSES: Record<AccentTone, string> = {
  blue: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
  sky: "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
};
