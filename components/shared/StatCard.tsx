import { KpiCard, type KpiTone } from "@/components/dashboard/KpiCard";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  color?: "blue" | "amber" | "emerald" | "red" | "purple";
  className?: string;
}

const COLOR_TO_TONE: Record<NonNullable<StatCardProps["color"]>, KpiTone> = {
  blue: "blue",
  amber: "amber",
  emerald: "emerald",
  red: "rose",
  purple: "violet",
};

/**
 * Legacy stat tile kept for the inner pages that still call it. It now renders
 * the Command Center `KpiCard` so every surface shares one visual language —
 * the prop signature is unchanged, so no call site needs touching.
 */
export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = "blue",
  className,
}: StatCardProps) {
  return (
    <KpiCard
      variant="plain"
      tone={COLOR_TO_TONE[color]}
      icon={icon}
      title={title}
      value={value}
      caption={subtitle}
      note={
        trend
          ? `${trend.value > 0 ? "+" : ""}${trend.value}% ${trend.label}`
          : undefined
      }
      noteTrend={trend && trend.value > 0 ? "up" : "flat"}
      className={className}
    />
  );
}
