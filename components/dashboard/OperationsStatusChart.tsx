"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface StatusDatum {
  label: string;
  count: number;
}

/** Two-line axis tick — status labels are too long to sit on one line. */
function AxisTick({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
}) {
  const words = String(payload?.value ?? "").split(" ");
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if ((current + " " + w).trim().length > 12 && current) {
      lines.push(current);
      current = w;
    } else {
      current = (current + " " + w).trim();
    }
  }
  if (current) lines.push(current);

  return (
    <g transform={`translate(${x ?? 0},${(y ?? 0) + 12})`}>
      {lines.slice(0, 2).map((line, i) => (
        <text
          key={i}
          x={0}
          y={i * 12}
          textAnchor="middle"
          fill="currentColor"
          className="fill-muted-foreground text-[10.5px] font-medium"
        >
          {line}
        </text>
      ))}
    </g>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value?: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const value = payload[0].value ?? 0;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="text-sm font-bold tabular-nums text-foreground">
        {value} operation{value === 1 ? "" : "s"}
      </p>
    </div>
  );
}

export function OperationsStatusChart({ data }: { data: StatusDatum[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-65 flex-col items-center justify-center gap-1 text-center">
        <p className="text-sm font-medium text-foreground">No operations in this range</p>
        <p className="text-xs text-muted-foreground">
          Try a wider date range or a different operation type.
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 24, right: 8, bottom: 18, left: -18 }}>
        <defs>
          {/* Brand azure → brand deep. The peak bar leans lighter at the top so
              it reads as the high value without introducing a second hue. */}
          <linearGradient id="ops-bar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-500)" />
            <stop offset="100%" stopColor="var(--brand-800)" />
          </linearGradient>
          <linearGradient id="ops-bar-peak" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-400)" />
            <stop offset="100%" stopColor="var(--brand-700)" />
          </linearGradient>
        </defs>
        <CartesianGrid
          vertical={false}
          stroke="currentColor"
          className="text-border"
          strokeDasharray="4 6"
        />
        <XAxis
          dataKey="label"
          interval={0}
          axisLine={false}
          tickLine={false}
          height={40}
          tick={<AxisTick />}
        />
        <YAxis
          allowDecimals={false}
          axisLine={false}
          tickLine={false}
          width={44}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          domain={[0, (max: number) => Math.max(1, Math.ceil(max * 1.3))]}
        />
        <Tooltip
          content={<ChartTooltip />}
          cursor={{ fill: "rgba(148,163,184,0.14)", radius: 8 }}
        />
        <Bar dataKey="count" radius={[7, 7, 0, 0]} maxBarSize={44}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={
                d.count === Math.max(...data.map((x) => x.count))
                  ? "url(#ops-bar-peak)"
                  : "url(#ops-bar)"
              }
            />
          ))}
          <LabelList
            dataKey="count"
            position="top"
            offset={10}
            className="fill-foreground text-[11px] font-bold"
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
