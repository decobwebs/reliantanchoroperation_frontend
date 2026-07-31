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
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
  submitted: "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  rejected: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};

/** InvoiceStatus badge classes. */
export const INVOICE_STATUS_CLASS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
  sent: "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  overdue: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};
