import { cn } from "@/lib/utils";

interface SpinnerProps {
  /**
   * Pixel size of the spinner. Controls the box directly — pass utility
   * classes via `className` for spacing (`mr-1.5`) or colour (`text-white`,
   * `text-muted-foreground`) only, not sizing.
   */
  size?: number;
  className?: string;
}

/**
 * The app's loading indicator. Colour is `currentColor` — it always matches
 * whatever text colour the surrounding element already has, so it reads as
 * on-brand inside a filled button, an outline one, or a plain page loading
 * state without a colour prop. Decorative: pair with visible loading text or
 * a disabled state on the control it sits in, same as the icon it replaces.
 */
export function Spinner({ size = 16, className }: SpinnerProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("spinner shrink-0", className)}
      style={{ "--spinner-size": `${size}px` } as React.CSSProperties}
    />
  );
}
