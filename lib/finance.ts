// Shared finance constants — used by the operation Finance tab and the
// standalone Finance page so both stay in sync with the backend enums
// (see reliant-anchor-api/app/models/enums.py).

/** VoucherCategory — mirrors the backend enum. */
export const VOUCHER_CATEGORY_OPTIONS = [
  ["port_fees", "Port Fees"],
  ["demurrage", "Demurrage"],
  ["logistics", "Logistics"],
  ["bunker_purchase", "Bunker Purchase"],
  ["labour", "Labour"],
  ["agency_fees", "Agency Fees"],
  ["documentation", "Documentation"],
  ["customs", "Customs"],
  ["inspection", "Inspection"],
  ["other", "Other"],
] as const;

export const VOUCHER_CATEGORY_LABELS: Record<string, string> =
  Object.fromEntries(VOUCHER_CATEGORY_OPTIONS.map(([v, l]) => [v, l]));

/** Currencies accepted across finance forms. */
export const CURRENCY_OPTIONS = ["NGN", "USD", "EUR", "GBP"] as const;

/** VoucherStatus badge classes. */
export const VOUCHER_STATUS_CLASS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

/** InvoiceStatus badge classes. */
export const INVOICE_STATUS_CLASS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-emerald-100 text-emerald-700",
  overdue: "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-700",
};
