import { cn, formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { INCIDENT_TYPE_LABEL, SEVERITY_LABEL } from "./VesselIncidentsPanel";
import { MAINTENANCE_TYPE_LABEL } from "./VesselMaintenancePanel";
import type { VesselReport } from "@/types";

/** The last 30 days, today included — the report's default period (matches the API's). */
export function defaultReportRange() {
  const isoDay = (d: Date) => d.toISOString().slice(0, 10);
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 29);
  return { from: isoDay(from), to: isoDay(to) };
}

/** A recorded figure, or blank when it was never recorded — never a dash or a 0. */
const fig = (v: string | null | undefined) => (v == null ? "" : formatNumber(v));

const ROB_TYPE_LABEL: Record<string, string> = {
  discharge: "Discharge",
  replenishment: "Replenishment",
  initial: "Initial load",
  adjustment: "Adjustment",
  correction: "Correction",
};

const PHASE_LABEL = { pre: "Pre", during: "During", post: "Post" } as const;

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid-page rounded-xl border border-border bg-card p-5 print:rounded-none print:border-0 print:p-0 print:pt-6">
      <h2 className="mb-3 text-base font-semibold">
        {title}
        {count !== undefined && <span className="ml-2 text-sm font-normal text-muted-foreground">({count})</span>}
      </h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function Table({ head, children, numeric = [] }: { head: string[]; children: React.ReactNode; numeric?: number[] }) {
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full border-collapse text-[12px] print:text-[10px]">
        <thead>
          <tr className="border-b border-border text-left text-[11px] text-muted-foreground print:text-[9px]">
            {head.map((h, i) => (
              <th key={h} className={cn("whitespace-nowrap px-2 py-1.5 font-semibold", numeric.includes(i) && "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60 [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top">{children}</tbody>
      </table>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-mono text-lg tabular-nums">{value}</p>
      {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
    </div>
  );
}

export function VesselReportDocument({ report: r }: { report: VesselReport }) {
  const s = r.summary;
  const sev = Object.entries(s.incidents_by_severity)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${SEVERITY_LABEL[k as keyof typeof SEVERITY_LABEL].toLowerCase()}`)
    .join(", ");

  return (
    <div className="space-y-4 print:space-y-0">
      {/* cover */}
      <div className="rounded-xl border border-border bg-card p-5 print:rounded-none print:border-0 print:p-0">
        <h1 className="text-xl font-semibold">Vessel report — {r.vessel.vessel_name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatDate(r.date_from)} to {formatDate(r.date_to)}
          {r.vessel.imo_number && ` · IMO ${r.vessel.imo_number}`}
          {r.vessel.vessel_type && ` · ${r.vessel.vessel_type}`}
          {r.vessel.flag_state && ` · ${r.vessel.flag_state}`}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <Stat label="Deliveries (BDNs)" value={s.deliveries} note={`${s.deliveries_approved} approved`} />
          <Stat
            label="MT(vac) delivered"
            value={fig(s.approved_mt_vacuum)}
            note={
              s.approved_missing_mt_vacuum > 0
                ? `Approved BDNs only. ${s.approved_missing_mt_vacuum} have no MT(vac) recorded.`
                : "Approved BDNs only"
            }
          />
          <Stat label="ROB at start" value={fig(s.rob_start)} />
          <Stat label="ROB at end" value={fig(s.rob_end)} />
          <Stat label="HSE checks" value={s.hse_checks} note={s.hse_failed > 0 ? `${s.hse_failed} not satisfactory` : "None failed"} />
          <Stat label="Incidents" value={s.incidents} note={sev || undefined} />
          <Stat label="Maintenance done" value={s.maintenance_done} />
          <Stat
            label="Maintenance due now"
            value={s.maintenance_overdue_now + s.maintenance_due_soon_now}
            note={`${s.maintenance_overdue_now} overdue · ${s.maintenance_due_soon_now} within 30 days`}
          />
        </div>
        <p className="mt-4 text-[11px] text-muted-foreground">
          Prepared by {r.generated_by_name} on {formatDateTime(r.generated_at)}. Figures are shown as recorded; a blank
          means it was never recorded. Open incidents on this vessel today: {s.incidents_open_now}.
        </p>
      </div>

      <Section title="Deliveries" count={r.deliveries.length}>
        {r.deliveries.length === 0 ? (
          <Empty>No BDNs dated in this period.</Empty>
        ) : (
          <Table
            head={["Date", "BDN", "Operation", "Receiving vessel", "Product", "Status", "GOV", "GSV", "MT(vac)", "Density", "Temp", "VCF"]}
            numeric={[6, 7, 8, 9, 10, 11]}
          >
            {r.deliveries.map((d) => (
              <tr key={d.bdn_number}>
                <td className="whitespace-nowrap">{formatDate(d.delivery_date)}</td>
                <td className="font-mono">{d.bdn_number}</td>
                <td className="font-mono">{d.operation_number ?? ""}</td>
                <td>{d.receiving_vessel ?? d.company_name ?? ""}</td>
                <td>{d.product_type ?? ""}</td>
                <td className="capitalize">{d.status}</td>
                <td className="text-right tabular-nums">{fig(d.gov)}</td>
                <td className="text-right tabular-nums">{fig(d.gsv)}</td>
                <td className="text-right font-semibold tabular-nums">{fig(d.mt_vacuum)}</td>
                <td className="text-right tabular-nums">{fig(d.density)}</td>
                <td className="text-right tabular-nums">{fig(d.temperature)}</td>
                <td className="text-right tabular-nums">{fig(d.vcf)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      <Section title="ROB movements" count={r.rob_movements.length}>
        {r.rob_movements.length === 0 ? (
          <Empty>No ROB movements recorded in this period.</Empty>
        ) : (
          <Table head={["Date", "Type", "Quantity", "ROB before", "ROB after", "Operation", "Details", "Recorded by"]} numeric={[2, 3, 4]}>
            {r.rob_movements.map((e, i) => (
              <tr key={i}>
                <td className="whitespace-nowrap">{formatDateTime(e.created_at)}</td>
                <td>{ROB_TYPE_LABEL[e.entry_type] ?? e.entry_type}</td>
                <td className="text-right tabular-nums">{fig(e.quantity)}</td>
                <td className="text-right tabular-nums">{fig(e.rob_before)}</td>
                <td className="text-right tabular-nums">{fig(e.rob_after)}</td>
                <td className="font-mono">{e.operation_number ?? ""}</td>
                <td>{e.description ?? ""}</td>
                <td>{e.recorded_by_name ?? ""}</td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      <Section title="HSE checks" count={r.hse_checks.length}>
        {r.hse_checks.length === 0 ? (
          <Empty>No HSE checks done in this period.</Empty>
        ) : (
          <Table head={["Date", "Check", "Operation", "Phase", "Result", "Safety officer", "Done by", "Notes"]}>
            {r.hse_checks.map((h, i) => (
              <tr key={i} className={cn(h.result === "not_satisfactory" && "bg-rose-50 dark:bg-rose-500/10")}>
                <td className="whitespace-nowrap">{formatDateTime(h.conducted_at)}</td>
                <td>{h.source}</td>
                <td className="font-mono">{h.operation_number ?? ""}</td>
                <td>{PHASE_LABEL[h.phase] ?? h.phase}</td>
                <td className={cn(h.result === "not_satisfactory" && "font-semibold text-rose-700 dark:text-rose-300")}>
                  {h.result === "satisfactory" ? "Satisfactory" : h.result === "not_satisfactory" ? "Not satisfactory" : ""}
                </td>
                <td>{h.safety_officer ?? ""}</td>
                <td>{h.conducted_by_name ?? ""}</td>
                <td>{h.notes ?? ""}</td>
              </tr>
            ))}
          </Table>
        )}
      </Section>

      <Section title="Incidents" count={r.incidents.length}>
        {r.incidents.length === 0 ? (
          <Empty>No incidents logged in this period.</Empty>
        ) : (
          <div className="space-y-3">
            {r.incidents.map((i) => (
              <div key={i.id} className="break-inside-avoid border-l-2 border-border pl-3 text-[12px]">
                <p className="font-semibold">
                  {i.title}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {INCIDENT_TYPE_LABEL[i.incident_type]} · {SEVERITY_LABEL[i.severity]} ·{" "}
                    {i.status === "under_investigation" ? "Under investigation" : i.status === "closed" ? "Closed" : "Open"}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  {formatDateTime(i.occurred_at)}
                  {i.location && ` · ${i.location}`}
                  {i.operation_number && ` · ${i.operation_number}`} · logged by {i.reported_by_name ?? "unknown"}
                </p>
                {i.description && <p className="mt-1 whitespace-pre-line">{i.description}</p>}
                {i.immediate_action && <p className="mt-1">Action taken: {i.immediate_action}</p>}
                {i.status === "closed" && (
                  <p className="mt-1">
                    Root cause: {i.root_cause} · Fix: {i.corrective_action} (closed by {i.closed_by_name ?? "unknown"},{" "}
                    {formatDate(i.closed_at)})
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Maintenance" count={r.maintenance.length}>
        {r.maintenance.length === 0 ? (
          <Empty>No maintenance planned, done or logged in this period.</Empty>
        ) : (
          <Table head={["Type", "What", "Status", "Planned", "Done", "Next due / expiry", "Done by"]}>
            {r.maintenance.map((m) => (
              <tr key={m.id}>
                <td>{MAINTENANCE_TYPE_LABEL[m.maintenance_type]}</td>
                <td>{m.title}</td>
                <td className="capitalize">{m.status.replace("_", " ")}</td>
                <td className="whitespace-nowrap">{m.planned_date ? formatDate(m.planned_date) : ""}</td>
                <td className="whitespace-nowrap">{m.completed_date ? formatDate(m.completed_date) : ""}</td>
                <td className="whitespace-nowrap">{m.next_due_date ? formatDate(m.next_due_date) : ""}</td>
                <td>{m.performed_by ?? ""}</td>
              </tr>
            ))}
          </Table>
        )}
        {r.maintenance_due.length > 0 && (
          <div className="mt-4">
            <p className="mb-1 text-[12px] font-semibold">Due as of today</p>
            <ul className="space-y-0.5 text-[12px]">
              {r.maintenance_due.map((d) => (
                <li key={d.record_id} className={d.state === "overdue" ? "text-rose-700 dark:text-rose-300" : ""}>
                  {d.title} ({MAINTENANCE_TYPE_LABEL[d.maintenance_type].toLowerCase()}) —{" "}
                  {d.state === "overdue" ? `overdue since ${formatDate(d.due_date)}` : `due ${formatDate(d.due_date)}`}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>
    </div>
  );
}
