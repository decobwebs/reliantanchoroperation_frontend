"use client";

/**
 * Vendor name field that offers what has been used before.
 *
 * Vendor names are free text today, which is how one firm ended up recorded
 * seven different ways — "3 BROTHERS", "3 BROTHER", "3 BROTHER'S", and an
 * "ALT GREEN" / "ALTGREEN" pair. A split like that quietly defeats the vendor
 * performance programme the Truck Operations Manager's job document requires,
 * because a poor performer's history is spread across several lines.
 *
 * Deliberately a datalist rather than a locked dropdown:
 *
 *  - **Typing still works.** A genuinely new vendor can be entered on the spot.
 *    Locking the field would block truck sourcing whenever a new haulier turns
 *    up, which is exactly the moment nobody wants a fight with the software.
 *  - **It cannot break.** If the list fails to load the field behaves as the
 *    plain text input it replaced.
 *  - **It works on a phone**, where a custom combobox usually does not.
 *
 * The suggestions are the most-used spelling of each firm, so picking one is
 * easier than retyping — which is what actually stops the split widening.
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import type { ApiResponse } from "@/types";

interface VendorOption {
  name: string;
  trips?: number | null;
  variants: string[];
}

interface VendorList {
  source: "registry" | "usage" | "unavailable";
  vendors: VendorOption[];
}

export function VendorPicker({
  value,
  onChange,
  id = "vendor-name",
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
}) {
  const { data } = useQuery({
    queryKey: ["kpi-vendors"],
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    // A failed lookup must not surface an error here — the field still works
    // without it, so it degrades to plain text rather than shouting.
    retry: 1,
    queryFn: async () => {
      const res = await api.get<ApiResponse<VendorList>>("/kpi/vendors");
      return res.data.data;
    },
  });

  const vendors = data?.vendors ?? [];
  const listId = `${id}-options`;

  // Is what they typed a spelling we already hold under another name?
  const typed = value.trim();
  const matchedVariant = typed
    ? vendors.find((v) =>
        v.variants.some((alt) => alt.toLowerCase() === typed.toLowerCase())
      )
    : undefined;

  return (
    <>
      <Input
        id={id}
        list={vendors.length ? listId : undefined}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
      {vendors.length > 0 && (
        <datalist id={listId}>
          {vendors.map((v) => (
            <option key={v.name} value={v.name}>
              {v.trips ? `${v.trips} trips` : ""}
            </option>
          ))}
        </datalist>
      )}

      {/* Nudge, never block. They may genuinely mean a different firm. */}
      {matchedVariant && (
        <p className="text-xs text-amber-600">
          Recorded elsewhere as <strong>{matchedVariant.name}</strong>. Using the
          same spelling keeps their history together.
        </p>
      )}
    </>
  );
}
