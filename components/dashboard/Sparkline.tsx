"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

interface SparklineProps {
  /** Real series to plot. Nothing renders for fewer than two points. */
  data: number[];
  className?: string;
  /** Stroke/fill colour — any CSS colour, defaults to `currentColor`. */
  color?: string;
  strokeWidth?: number;
}

/**
 * Tiny smoothed area chart. Hand-rolled SVG rather than recharts: these render
 * a dozen at a time inside stat cards, where a full chart runtime per card is
 * wasted weight. Decorative only — always paired with the real number beside it,
 * and hidden from assistive tech.
 */
export function Sparkline({
  data,
  className,
  color = "currentColor",
  strokeWidth = 2,
}: SparklineProps) {
  const id = useId();
  if (data.length < 2) return null;

  const W = 100;
  const H = 32;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;

  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * W,
    // Leave 3px of headroom top and bottom so the stroke never clips.
    y: H - 3 - ((v - min) / span) * (H - 6),
  }));

  // Catmull-Rom → cubic bezier, for a soft curve instead of a jagged polyline.
  let line = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    line += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cn("overflow-visible", className)}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L ${W} ${H} L 0 ${H} Z`} fill={`url(#spark-${id})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
