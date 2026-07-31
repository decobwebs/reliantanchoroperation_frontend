"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  X,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { cn, formatDate, OP_TYPE_LABELS } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type {
  ApiResponse,
  PaginatedData,
  Operation,
  OperationStatus,
} from "@/types";

/**
 * Command Center search. Backed by the existing `/operations?search=` endpoint —
 * no new API surface — with ⌘K / Ctrl+K to focus and full keyboard navigation
 * over the results.
 */
export function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [value, setValue] = useState("");
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  // Debounce so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setTerm(value.trim()), 250);
    return () => clearTimeout(id);
  }, [value]);

  // ⌘K / Ctrl+K focuses the field from anywhere on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Dismiss on outside click.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["global-search", term],
    enabled: term.length >= 2,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await api.get<ApiResponse<PaginatedData<Operation>>>(
        `/operations?search=${encodeURIComponent(term)}&per_page=6`
      );
      return res.data.data.items;
    },
  });

  // Results can shrink between renders — clamp rather than resetting from an
  // effect, which would cost an extra render pass on every keystroke.
  const activeIndex = results.length ? Math.min(active, results.length - 1) : 0;

  const go = (op: Operation) => {
    setOpen(false);
    setValue("");
    router.push(`/operations/${op.id}`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (Math.min(i, results.length - 1) + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (Math.min(i, results.length - 1) - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[activeIndex]);
    }
  };

  const showPanel = open && term.length >= 2;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="Search operations"
        placeholder="Search operations, vessels, trucks, documents…"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className={cn(
          "h-11 w-full rounded-xl border border-transparent bg-muted/70 pl-10 pr-16 text-sm",
          "text-foreground placeholder:text-muted-foreground/80",
          "transition-colors focus:border-primary/25 focus:bg-card focus:outline-none",
          "focus:ring-4 focus:ring-primary/10",
          "[&::-webkit-search-cancel-button]:hidden"
        )}
      />

      <div className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
        {isFetching && term.length >= 2 && (
          <Spinner size={14} className="text-muted-foreground" />
        )}
        {value ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setValue("");
              inputRef.current?.focus();
            }}
            className="pointer-events-auto rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <kbd className="hidden rounded-md border border-border bg-card px-1.5 py-0.5 font-sans text-[10px] font-semibold text-muted-foreground sm:block">
            ⌘K
          </kbd>
        )}
      </div>

      {showPanel && (
        <div
          id={listId}
          role="listbox"
          className={cn(
            "absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-xl",
            "border border-border bg-popover shadow-[0_24px_48px_-24px_rgba(16,24,40,0.45)]"
          )}
        >
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              {isFetching ? "Searching…" : `No operations match “${term}”`}
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((op, i) => (
                <li key={op.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(op)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors",
                      i === activeIndex ? "bg-muted" : "hover:bg-muted/60"
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-[13px] font-semibold text-foreground">
                        {op.operation_number}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {OP_TYPE_LABELS[op.type] ?? op.type} · {formatDate(op.created_at)}
                      </span>
                    </span>
                    <StatusBadge status={op.status as OperationStatus} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
