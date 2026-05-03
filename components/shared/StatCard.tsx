import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
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

const COLOR_MAP = {
  blue: {
    icon: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    trend: "text-blue-600",
  },
  amber: {
    icon: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
    trend: "text-amber-600",
  },
  emerald: {
    icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
    trend: "text-emerald-600",
  },
  red: {
    icon: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    trend: "text-red-600",
  },
  purple: {
    icon: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
    trend: "text-purple-600",
  },
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = "blue",
  className,
}: StatCardProps) {
  const colors = COLOR_MAP[color];

  return (
    <Card className={cn("border-0 shadow-sm", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground truncate">
              {title}
            </p>
            <p className="text-3xl font-bold mt-1 text-foreground">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
            {trend && (
              <p className={cn("text-xs font-medium mt-2", colors.trend)}>
                {trend.value > 0 ? "+" : ""}
                {trend.value}% {trend.label}
              </p>
            )}
          </div>
          <div
            className={cn(
              "flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center",
              colors.icon
            )}
          >
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
