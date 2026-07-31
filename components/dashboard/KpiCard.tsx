"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowRight, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sparkline } from "./Sparkline";
import type { AccentTone } from "./tones";

/** `navy` is the dark hero surface; `rose` signals alerts; `slate` is neutral. */
export type KpiTone = AccentTone | "navy" | "rose" | "slate";

/**
 * Two card families:
 *  - `hero`  — the tinted gradient cards in the primary KPI row.
 *  - `plain` — white cards with a tinted icon tile, for the secondary row.
 */
type KpiVariant = "hero" | "plain";

interface ToneStyle {
  /** Card surface (hero variant only). */
  surface: string;
  /** Icon tile. */
  tile: string;
  /** Icon glyph. */
  glyph: string;
  /** Title text. */
  title: string;
  /** Big value. */
  value: string;
  /** Subtitle / caption text. */
  caption: string;
  /** Footnote text (the derived ratio line). */
  note: string;
  /** Ambient glow blob. */
  glow: string;
  /** Sparkline colour. */
  spark: string;
}

const HERO_TONES: Record<KpiTone, ToneStyle> = {
  navy: {
    surface:
      "brand-grad-hero border-white/10 shadow-[0_18px_38px_-18px_rgb(16_36_71/0.75)]",
    tile: "bg-white/15 ring-1 ring-inset ring-white/20",
    glyph: "text-brand-200",
    title: "text-white/80",
    value: "text-white",
    caption: "text-white/55",
    note: "text-emerald-300",
    glow: "bg-brand-400/25",
    spark: "var(--brand-300)",
  },
  // `blue` and `sky` are both the brand azure — near-identical by design, so
  // the brand reads as one colour wherever a KPI card lands.
  blue: {
    surface: "brand-grad-tint border-brand-200/70",
    tile: "bg-white ring-1 ring-inset ring-brand-100 shadow-sm",
    glyph: "text-brand-600",
    title: "text-navy-900/70",
    value: "text-navy-900",
    caption: "text-navy-900/50",
    note: "text-brand-700",
    glow: "bg-brand-300/40",
    spark: "var(--brand-500)",
  },
  emerald: {
    surface:
      "bg-[linear-gradient(140deg,#eefbf5_0%,#dcf6ec_55%,#cdf1e4_100%)] border-emerald-200/70",
    tile: "bg-white ring-1 ring-inset ring-emerald-100 shadow-sm",
    glyph: "text-emerald-600",
    title: "text-emerald-950/70",
    value: "text-emerald-950",
    caption: "text-emerald-900/50",
    note: "text-emerald-700",
    glow: "bg-emerald-300/40",
    spark: "rgb(16 185 129)",
  },
  amber: {
    surface:
      "bg-[linear-gradient(140deg,#fef8e7_0%,#fdefcd_55%,#fce7b6_100%)] border-amber-200/70",
    tile: "bg-white ring-1 ring-inset ring-amber-100 shadow-sm",
    glyph: "text-amber-600",
    title: "text-amber-950/70",
    value: "text-amber-950",
    caption: "text-amber-900/50",
    note: "text-amber-700",
    glow: "bg-amber-300/40",
    spark: "rgb(245 158 11)",
  },
  violet: {
    surface:
      "bg-[linear-gradient(140deg,#f2eefe_0%,#e7dffc_55%,#ddd3fa_100%)] border-violet-200/70",
    tile: "bg-white ring-1 ring-inset ring-violet-100 shadow-sm",
    glyph: "text-violet-600",
    title: "text-violet-950/70",
    value: "text-violet-950",
    caption: "text-violet-900/50",
    note: "text-violet-700",
    glow: "bg-violet-300/40",
    spark: "rgb(139 92 246)",
  },
  sky: {
    surface: "brand-grad-tint border-brand-200/70",
    tile: "bg-white ring-1 ring-inset ring-brand-100 shadow-sm",
    glyph: "text-brand-500",
    title: "text-navy-900/70",
    value: "text-navy-900",
    caption: "text-navy-900/50",
    note: "text-brand-600",
    glow: "bg-brand-300/40",
    spark: "var(--brand-400)",
  },
  rose: {
    surface:
      "bg-[linear-gradient(140deg,#fef1f2_0%,#fde3e5_55%,#fbd3d7_100%)] border-rose-200/70",
    tile: "bg-white ring-1 ring-inset ring-rose-100 shadow-sm",
    glyph: "text-rose-600",
    title: "text-rose-950/70",
    value: "text-rose-950",
    caption: "text-rose-900/50",
    note: "text-rose-700",
    glow: "bg-rose-300/40",
    spark: "rgb(244 63 94)",
  },
  slate: {
    surface:
      "bg-[linear-gradient(140deg,#f4f6fb_0%,#eaeef6_55%,#e0e6f1_100%)] border-slate-200",
    tile: "bg-white ring-1 ring-inset ring-slate-100 shadow-sm",
    glyph: "text-slate-600",
    title: "text-slate-900/70",
    value: "text-slate-900",
    caption: "text-slate-500",
    note: "text-slate-600",
    glow: "bg-slate-300/40",
    spark: "rgb(100 116 139)",
  },
};

/** The `plain` variant keeps a white surface — only the accent bits are toned. */
const PLAIN_TILES: Record<KpiTone, { tile: string; glyph: string; glow: string; spark: string }> = {
  navy:    { tile: "bg-brand-50",   glyph: "text-navy-700",    glow: "bg-brand-200/45",   spark: "var(--navy-600)" },
  blue:    { tile: "bg-brand-50",   glyph: "text-brand-600",   glow: "bg-brand-200/45",   spark: "var(--brand-500)" },
  emerald: { tile: "bg-emerald-50", glyph: "text-emerald-600", glow: "bg-emerald-200/45", spark: "rgb(16 185 129)" },
  amber:   { tile: "bg-amber-50",   glyph: "text-amber-600",   glow: "bg-amber-200/45",   spark: "rgb(245 158 11)" },
  violet:  { tile: "bg-violet-50",  glyph: "text-violet-600",  glow: "bg-violet-200/45",  spark: "rgb(139 92 246)" },
  sky:     { tile: "bg-brand-50",   glyph: "text-brand-500",   glow: "bg-brand-200/45",   spark: "var(--brand-400)" },
  rose:    { tile: "bg-rose-50",    glyph: "text-rose-600",    glow: "bg-rose-200/45",    spark: "rgb(244 63 94)" },
  slate:   { tile: "bg-slate-100",  glyph: "text-slate-600",   glow: "bg-slate-200/45",   spark: "rgb(100 116 139)" },
};

export interface KpiCardProps {
  title: string;
  value: string | number;
  /** Small line under the value. */
  caption?: string;
  /** Footnote — a derived, factual ratio (e.g. "100% fleet ready"). */
  note?: string;
  /** Renders a ↑ before the note when the footnote is a positive movement. */
  noteTrend?: "up" | "flat";
  icon: LucideIcon;
  tone?: KpiTone;
  variant?: KpiVariant;
  /** Optional real series. Omitted cards fall back to the ambient glow alone. */
  series?: number[];
  className?: string;
}

export function KpiCard({
  title,
  value,
  caption,
  note,
  noteTrend = "up",
  icon: Icon,
  tone = "navy",
  variant = "hero",
  series,
  className,
}: KpiCardProps) {
  const hero = variant === "hero";
  const t = HERO_TONES[tone];
  const plain = PLAIN_TILES[tone];

  const tile = hero ? t.tile : plain.tile;
  const glyph = hero ? t.glyph : plain.glyph;
  const glow = hero ? t.glow : plain.glow;
  const spark = hero ? t.spark : plain.spark;

  return (
    <div
      className={cn(
        "group relative isolate overflow-hidden rounded-2xl border p-4 lg:p-5",
        "transition-shadow duration-300",
        hero
          ? t.surface
          : "border-slate-200/80 bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-border",
        "hover:shadow-[0_16px_34px_-20px_rgba(16,24,40,0.45)]",
        className
      )}
    >
      {/* Ambient wash — sits behind everything, never implies a data trend. */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -bottom-10 -right-8 -z-10 h-28 w-40 rounded-full blur-3xl",
          glow
        )}
      />

      {series && series.length > 1 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-8 right-0 -z-10 h-10 w-[52%] opacity-70"
        >
          <Sparkline data={series} color={spark} className="h-full w-full" />
        </div>
      )}

      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            tile
          )}
        >
          <Icon className={cn("h-4.5 w-4.5", glyph)} strokeWidth={2} />
        </span>
        <p
          className={cn(
            "min-w-0 truncate text-[13px] font-semibold leading-tight",
            hero ? t.title : "text-foreground/75"
          )}
          title={title}
        >
          {title}
        </p>
      </div>

      <p
        className={cn(
          "mt-4 text-3xl font-bold leading-none tracking-tight tabular-nums lg:text-[32px]",
          hero ? t.value : "text-foreground"
        )}
      >
        {value}
      </p>

      {caption && (
        <p
          className={cn(
            "mt-1.5 truncate text-xs",
            hero ? t.caption : "text-muted-foreground"
          )}
        >
          {caption}
        </p>
      )}

      {note && (
        <p
          className={cn(
            "mt-3 flex items-center gap-1.5 text-[11px] font-semibold",
            noteTrend === "flat"
              ? hero
                ? t.caption
                : "text-muted-foreground"
              : hero
                ? t.note
                : "text-emerald-600"
          )}
        >
          {noteTrend === "up" ? (
            <TrendingUp className="h-3 w-3 shrink-0" strokeWidth={2.5} />
          ) : (
            <ArrowRight className="h-3 w-3 shrink-0" strokeWidth={2.5} />
          )}
          <span className="truncate">{note}</span>
        </p>
      )}
    </div>
  );
}
