"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface JourneyStep {
  label: string;
  /** Completed when every non-cancelled receiving vessel has reached it. */
  done: boolean;
  /** Timestamp line, or the "2/3" fleet count for the repeating stages. */
  detail?: string;
}

/**
 * The spec's six-stage vessel journey, rendered as a horizontal stepper.
 * Loading (1–2) happens once on the barge run; delivery (3–6) repeats per
 * receiving vessel, so those steps carry a fleet count rather than a time.
 */
export function JourneyStepper({
  steps,
  title = "Vessel Journey",
}: {
  steps: JourneyStep[];
  title?: string;
}) {
  if (steps.length === 0) return null;
  const firstPending = steps.findIndex((s) => !s.done);

  return (
    <section
      className={cn(
        "animate-rise overflow-hidden rounded-2xl border border-navy-100 bg-card px-4 py-4 lg:px-5",
        "shadow-[0_1px_2px_rgb(16_36_71/0.04)] dark:border-border"
      )}
      aria-label={title}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </p>

      <ol className="mt-4 flex min-w-max items-start gap-0 overflow-x-auto pb-1 lg:min-w-0">
        {steps.map((step, i) => {
          const current = i === firstPending;
          return (
            <li
              key={step.label}
              className="flex flex-1 items-start"
              aria-current={current ? "step" : undefined}
            >
              {/* Connector into this node */}
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-4 h-0.5 min-w-8 flex-1 rounded-full",
                    steps[i - 1].done ? "bg-emerald-500" : "bg-border"
                  )}
                />
              )}
              <div className="flex min-w-28 flex-col items-center px-2 text-center">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    step.done
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : current
                        ? "border-brand-500 bg-card text-brand-600"
                        : "border-border bg-card text-muted-foreground/50"
                  )}
                >
                  {step.done ? (
                    <Check className="h-4 w-4" strokeWidth={3} />
                  ) : (
                    <span className="text-[11px] font-bold tabular-nums">{i + 1}</span>
                  )}
                </span>
                <span
                  className={cn(
                    "mt-2 text-[12px] font-semibold leading-tight",
                    step.done || current ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
                {step.detail && (
                  <span className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                    {step.detail}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
