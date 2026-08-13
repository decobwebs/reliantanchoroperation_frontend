// ─── Auth ────────────────────────────────────────────────────────────────────

export type UserRole =
  | "bunker_manager"
  | "ops_supervisor"
  | "logistics_officer"
  | "cargo_superintendent"
  | "finance_manager"
  | "client"
  | "marine_operator";

export interface User {
  id: string;
  auth_id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  acting_as_role?: string | null;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

// ─── Operations ──────────────────────────────────────────────────────────────

export type OperationType = "full_operation" | "vessel_only" | "truck_only";
export type VesselSourceType = "truck" | "terminal";

export type OperationStatus =
  | "draft"
  | "tasks_assigned"
  | "awaiting_feedback"
  | "feedback_submitted"
  | "feedback_approved"
  | "feedback_rejected"
  | "active"
  | "pending_completion"
  | "pfi_linked"
  | "payment_processing"
  | "payment_confirmed"
  | "vessel_operations"
  | "bdn_pending"
  | "bdn_approved"
  | "invoiced"
  | "completed"
  | "archived"
  | "cancelled";

export type ProductType =
  | "AGO"
  | "DPK"
  | "PMS"
  | "HFO"
  | "VLSFO"
  | "LSMGO"
  | "MGO"
  | "IFO_380"
  | "IFO_180"
  | "ULSFO"
  | "JET_A1"
  | "ATK"
  | "NAPHTHA"
  | "CRUDE"
  | "OTHER";

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  AGO: "AGO (Automotive Gas Oil)",
  DPK: "DPK (Dual Purpose Kerosene)",
  PMS: "PMS (Premium Motor Spirit)",
  HFO: "HFO (Heavy Fuel Oil)",
  VLSFO: "VLSFO (Very Low Sulphur Fuel Oil)",
  LSMGO: "LSMGO (Low Sulphur Marine Gas Oil)",
  MGO: "MGO (Marine Gas Oil)",
  IFO_380: "IFO 380 CST",
  IFO_180: "IFO 180 CST",
  ULSFO: "ULSFO (Ultra Low Sulphur Fuel Oil)",
  JET_A1: "Jet A-1",
  ATK: "ATK (Aviation Turbine Kerosene)",
  NAPHTHA: "Naphtha",
  CRUDE: "Crude Oil",
  OTHER: "Other",
};

export interface Operation {
  id: string;
  operation_number: string;
  type: OperationType;
  source_type?: VesselSourceType;
  status: OperationStatus;
  client_id: string;
  created_by: string;
  product_type?: string;
  loading_location?: string;
  discharge_location?: string;
  expected_volume_mt?: string;
  actual_volume_mt?: string;
  notes?: string;
  currency: string;
  vessel_id?: string;
  naval_clearance_id?: string;
  naval_clearance?: {
    id: string;
    clearance_number: string;
    ppdl_number?: string;
    bfl_numbers: string[];
    products: string[];
    is_valid: boolean;
  };
  // Serialised by OperationOut — the real product list. `product_type` above
  // is the legacy single-product scalar and is null on anything created
  // through the current flow.
  products?: { id: string; product_type: string; quantity_mt: string }[];
  color?: string;
  trucks_required?: number;
  version: number;
  parent_operation_id?: string;
  version_notes?: string;
  completion_notes?: string;
  completed_at?: string;
  closed_at?: string;
  expected_rob_mt?: string;
  actual_rob_mt?: string;
  rob_closed_by?: string;
  created_at: string;
  updated_at: string;
  client?: User;
  creator?: User;
}

export interface OperationTotals {
  total_loaded_mt: string;
  total_discharged_mt: string;
  total_received_mt: string;
  vessels_received: number;
  tts_variance_mt: string;
  sts_variance_mt: string;
}

export interface InlineTaskAssignment {
  assigned_to: string;
  task_type: string;
  priority: string;
  instructions?: string;
  due_date?: string;
}

export interface StatusHistory {
  id: string;
  operation_id: string;
  from_status?: OperationStatus;
  to_status: OperationStatus;
  changed_by: string;
  reason?: string;
  created_at: string;
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export type TaskType =
  | "truck_logistics"
  | "vessel_operations"
  | "marine_discharge"
  | "finance_processing";

export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";

export interface TaskOperation {
  id: string;
  operation_number: string;
  type: string;
  status: string;
}

export interface TaskUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

export interface Task {
  id: string;
  operation_id: string;
  assigned_to: string;
  assigned_by: string;
  task_type: TaskType;
  status: TaskStatus;
  priority: string;
  instructions?: string;
  due_date?: string;
  completed_at?: string;
  created_at: string;
  assignee?: TaskUser;
  assigner?: TaskUser;
  operation?: TaskOperation;
}

// ─── Finance ─────────────────────────────────────────────────────────────────

export interface PFI {
  id: string;
  pfi_number: string;
  operation_id?: string;
  linked_by: string;
  pfi_type: "client_proforma" | "supplier_invoice";
  amount: string;
  currency: string;
  exchange_rate?: string;
  amount_ngn?: string;
  quantity_litres?: string;
  allocated_litres: string;
  remaining_litres?: string;
  status: string;
  supplier_name?: string;
  description?: string;
  document_url?: string;
  receipt_url?: string;
  client_ref?: string;
  confirmed_by?: string;
  confirmed_at?: string;
  created_at: string;
}

export interface PfiAllocation {
  id: string;
  pfi_id: string;
  operation_id: string;
  quantity_litres: string;
  linked_by: string;
  notes?: string;
  created_at: string;
  pfi_number?: string;
  operation_number?: string;
}

// ── Licence hierarchy: PPDL -> BFL -> Naval Clearance ──────────────────────

export interface PpdlProduct {
  id: string;
  ppdl_id: string;
  product_type: string;
  quantity_litres: string;
  allocated_litres: string;
  remaining_litres?: string;
  created_at: string;
}

export interface Ppdl {
  id: string;
  ppdl_number: string;
  issue_date: string;
  expiry_date: string;
  is_current: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  products: PpdlProduct[];
}

export interface Bfl {
  id: string;
  bfl_number: string;
  ppdl_id: string;
  ppdl_number?: string;
  product_type: string;
  quantity_litres: string;
  allocated_litres: string;
  remaining_litres?: string;
  vessel?: string;
  expiry_date: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface NavalClearanceDrawdown {
  id: string;
  naval_clearance_id: string;
  bfl_id: string;
  bfl_number?: string;
  product_type?: string;
  quantity_litres: string;
  created_at: string;
}

export interface NavalClearanceLoadingLocation {
  id: string;
  location: string;
  sort_order: number;
}

export interface NavalClearanceVessel {
  id: string;
  client_id: string;
  client_name?: string;
  client_email?: string;
  vessel_name: string;
  imo_number?: string;
  current_eta?: string;
}

export interface NavalClearance {
  id: string;
  clearance_number: string;
  date_of_loading: string;
  expiry_date: string;
  is_valid: boolean;
  document_url?: string;
  ppdl_number?: string;
  bfl_numbers: string[];
  products: string[];
  total_quantity_litres: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  drawdowns: NavalClearanceDrawdown[];
  loading_locations: NavalClearanceLoadingLocation[];
  vessels: NavalClearanceVessel[];
}

export interface VesselRunKpi {
  vessel_activity_id: string;
  vessel_name?: string;
  cast_off_at?: string;
  discharge_completed_at?: string;
  duration_hours?: number;
}

export interface OperationKpi {
  operation_id: string;
  cast_off_at?: string;
  discharge_completed_at?: string;
  duration_hours?: number;
  vessel_runs: VesselRunKpi[];
}

export interface StageDurationEntry {
  vessel_activity_id: string;
  stage: string;
  role?: string;
  user_name?: string;
  started_at?: string;
  completed_at?: string;
  duration_hours?: number;
}

export interface RoleStageDurations {
  operation_id: string;
  entries: StageDurationEntry[];
}

export interface ClientNotificationRecipient {
  naval_clearance_vessel_id: string;
  client_id: string;
  client_name?: string;
  client_email?: string;
  vessel_name: string;
  imo_number?: string;
  current_eta?: string;
}

export interface ClientNotificationLog {
  id: string;
  operation_id: string;
  naval_clearance_vessel_id: string;
  client_id: string;
  recipient_email: string;
  recipient_name: string;
  notification_type: string;
  stage?: string;
  subject: string;
  sent_by: string;
  sent_at: string;
  thread_key: string;
}

export interface Voucher {
  id: string;
  voucher_number: string;
  operation_id?: string;
  pfi_id?: string;
  recorded_by: string;
  approved_by?: string;
  category: string;
  amount: string;
  currency: string;
  exchange_rate?: string;
  amount_ngn?: string;
  supplier_name?: string;
  description?: string;
  receipt_url?: string;
  notes?: string;
  status: string;
  payment_date?: string;
  approved_at?: string;
  rejection_reason?: string;
  created_at: string;
}

export interface Payment {
  id: string;
  pfi_id: string;
  operation_id: string;
  processed_by: string;
  amount: string;
  currency: string;
  voucher_number: string;
  payment_method?: string;
  payment_reference?: string;
  payment_date: string;
  notes?: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  operation_id?: string;   // absent for standalone (ad-hoc) invoices
  bdn_id?: string;
  truck_bdn_id?: string;
  client_id?: string;      // absent when billed to a manually-entered client
  client_name?: string;    // manual client name
  client_email?: string;
  generated_by: string;
  amount: string;
  currency: string;
  exchange_rate?: string;
  tax_amount: string;
  total_amount: string;
  due_date?: string;
  status: string;
  pdf_url?: string;
  sent_at?: string;
  paid_at?: string;
  description?: string;    // line item text — standalone invoices
  notes?: string;
  created_at: string;
  advance_paid?: string;   // sum of advance payments received via PFI
  balance_due?: string;    // total_amount - advance_paid
}

// ─── Fleet ───────────────────────────────────────────────────────────────────

export interface Truck {
  id: string;
  truck_number: string;
  capacity_mt: string;
  status: string;
  driver_name?: string;
  driver_phone?: string;
  chassis_number?: string;
  truck_licence_url?: string;
  calibration_cert_url?: string;
  current_location?: string;
  gps_lat?: string;
  gps_lng?: string;
  photo_url?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type TruckWaiverStatus = "available" | "linked";

/** One truck currently linked to a waiver — a waiver can cover more than one at once. */
export interface LinkedTruckSummary {
  truck_number: string;
  operation_id: string;
  operation_number: string;
  driver_name?: string;
  linked_at?: string;
}

export interface TruckWaiver {
  id: string;
  waybill_truck_number: string;
  /** Derived live from active links, not a stored gate — "linked" just means linked_trucks.length > 0. */
  status: TruckWaiverStatus;
  added_by: string;
  created_at: string;
  linked_trucks: LinkedTruckSummary[];
}

export interface TruckEvent {
  event_type: string;
  description: string;
  occurred_at: string;
  recorded_by: string;
  metadata?: Record<string, unknown>;
}

export type AuditResult = "satisfactory" | "not_satisfactory";
export type AuditPhase = "pre" | "post";

export interface AuditWaiver {
  item: string;
  waived_by: string;
  waived_by_name: string;
  waived_at: string;
  notes?: string;
}

export interface AuditChecklistItem {
  item: string;
  passed: boolean;
  checked_at?: string;
}

export interface TruckSafetyAudit {
  id: string;
  truck_op_id: string;
  phase: AuditPhase;
  operation_id: string;
  truck_id: string;
  conducted_by: string;
  conductor_name?: string;
  conducted_at: string;
  result: AuditResult;
  checklist: AuditChecklistItem[];
  header: Record<string, string>;
  waivers: AuditWaiver[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface TruckOperation {
  id: string;
  truck_id: string;
  operation_id: string;
  status: string;
  product_type?: string;
  quantity_loaded_mt?: string;
  quantity_discharged_mt?: string;
  quantity_remaining_mt?: string;
  spillage_mt?: string;
  temperature_celsius?: string;
  supervisor_id?: string;
  loading_location?: string;
  discharge_location?: string;
  destination_vessel_id?: string;
  destination_vessel_name?: string;
  discharge_approved?: boolean | null;
  discharge_approved_by?: string;
  discharge_approved_at?: string;
  waybill_number?: string;
  waybill_url?: string;
  driver_name?: string;
  driver_phone?: string;
  vendor_name?: string;
  waybill_document_number?: string;
  waiver_id?: string;
  departed_parking_at?: string;
  arrived_loading_at?: string;
  departed_loading_at?: string;
  transit_start_at?: string;
  arrived_discharge_at?: string;
  transit_end_at?: string;
  discharge_start_at?: string;
  discharge_end_at?: string;
  events: TruckEvent[];
  notes?: string;
  created_at: string;
  updated_at: string;
  truck?: Truck;
  supervisor?: { id: string; full_name: string; role: string };
  safety_audits: TruckSafetyAudit[];
}

export interface TruckOperationHistory {
  id: string;
  operation_id: string;
  operation_number: string;
  operation_type: string;
  operation_status: string;
  product_type?: string;
  quantity_loaded_mt?: string;
  quantity_discharged_mt?: string;
  quantity_remaining_mt?: string;
  spillage_mt?: string;
  temperature_celsius?: string;
  variance_mt?: string;
  loading_location?: string;
  discharge_location?: string;
  destination_vessel_name?: string;
  departed_parking_at?: string;
  arrived_loading_at?: string;
  departed_loading_at?: string;
  arrived_discharge_at?: string;
  transit_start_at?: string;
  transit_end_at?: string;
  discharge_start_at?: string;
  discharge_end_at?: string;
  supervisor_name?: string;
  status: string;
  logged_by_id: string;
  logged_by_name: string;
  logged_by_role: string;
  events: TruckEvent[];
  notes?: string;
  created_at: string;
}

export interface TruckStats {
  total_operations: number;
  total_loaded_mt: string;
  total_discharged_mt: string;
  total_variance_mt: string;
  total_spillage_mt: string;
  efficiency_pct?: number;
}

export interface TruckProfile {
  truck: Truck;
  stats: TruckStats;
  history: TruckOperationHistory[];
}

// ─── Vessel Discharge Events ──────────────────────────────────────────────────

export interface VesselDischargeEvent {
  id: string;
  operation_id: string;
  source_vessel_id: string;
  destination_vessel_id?: string;
  product_type: string;
  quantity_mt: string;
  spillage_mt?: string;
  temperature_celsius?: string;
  density?: string;
  discharge_start_at?: string;
  discharge_end_at?: string;
  supervisor_id: string;
  rob_entry_id: string;
  notes?: string;
  created_at: string;
  source_vessel?: Vessel;
  destination_vessel?: Vessel;
}

export interface VesselBDNEntry {
  id: string;
  bdn_number: string;
  operation_id: string;
  operation_number: string;
  status: string;
  quantity_delivered_mt: string;
  product_type?: string;
  fuel_type?: string;
  density?: string;
  temperature?: string;
  delivery_date?: string;
  generated_by_name: string;
  generated_by_role: string;
  reviewed_by_name?: string;
  approved_at?: string;
  rejection_reason?: string;
  notes?: string;
  created_at: string;
}

export interface VesselBDNs {
  bdns: VesselBDNEntry[];
  total_delivered_mt: string;
  total_count: number;
}

export interface TruckFeedback {
  id: string;
  operation_id: string;
  submitted_by: string;
  reviewed_by?: string;
  truck_ids: string[];
  status: "pending" | "approved" | "rejected" | "resubmitted";
  readiness_summary: string;
  truck_details: Record<string, unknown>;
  rejection_reason?: string;
  submitted_at: string;
  reviewed_at?: string;
  version: number;
}

export interface Vessel {
  id: string;
  vessel_name: string;
  imo_number: string;
  vessel_type: string;
  flag_state?: string;
  capacity_mt: string;
  current_rob_mt: string;
  rob_threshold_mt?: string;
  current_location?: string;
  status: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ─── Vessel Activities ────────────────────────────────────────────────────────

export type VesselActivityStatus = "pending" | "active" | "completed" | "cancelled";

export interface VesselActivity {
  id: string;
  activity_number: string;
  operation_id: string;
  vessel_id: string;
  vessel_name?: string;
  vessel_current_rob_mt?: string;
  assigned_to: string;
  assigned_by: string;

  initial_rob_mt?: string;
  truck_delivered_mt?: string;
  vessel_received_mt?: string;
  variance_mt?: string;
  previous_rob_mt?: string;
  new_rob_mt?: string;
  quantity_discharged_mt?: string;
  final_rob_mt?: string;

  product_type?: string;
  temperature_celsius?: string;
  density?: string;
  spillage_mt?: string;

  bunkering_start_at?: string;
  bunkering_end_at?: string;
  discharge_start_at?: string;
  discharge_end_at?: string;

  status: VesselActivityStatus;
  notes?: string;
  completion_notes?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;

  // ── Per-vessel stage flow ──
  stage?: string;
  stage_cast_off_at?: string;
  stage_outbound_at?: string;
  stage_alongside_at?: string;
  stage_hse_check_at?: string;
  stage_discharging_at?: string;
  stage_discharge_completed_at?: string;

  // ── HSE ──
  hse_checklist: { section?: string; item: string; passed: boolean; notes?: string }[];
  hse_result?: string;
  hse_conducted_by?: string;
  hse_conducted_at?: string;
  hse_notes?: string;

  // ── Discharge arithmetic ──
  gov?: string;
  vcf?: string;
  gsv?: string;
  mt_vacuum?: string;

  comments: {
    id: string;
    vessel_activity_id: string;
    stage?: string;
    comment: string;
    recorded_by: string;
    recorded_by_name?: string;
    recorded_at: string;
  }[];

  // ── Vessel-only: Loading Commenced/Completed (reuses commence/complete) ──
  commence_system_at?: string;
  commence_user_at?: string;
  commence_description?: string;
  complete_system_at?: string;
  complete_user_at?: string;
  complete_description?: string;
  // Superseded (migration 039) — dead for rows created after the
  // six-stage + receiving-vessel-legs rebuild (migration 041).
  discharged_quantity_litres?: string;
  received_quantity_litres?: string;
  quantity_recorded_at?: string;
  quantity_description?: string;

  // ── Loading Received Quantity — one-time, six-stage + legs flow ──
  loading_received_quantity_litres?: string;
  loading_density?: string;
  loading_temperature_before_loading?: string;
  loading_temperature_after_loading?: string;
  loading_vcf?: string;
  loading_gov?: string;
  loading_gsv?: string;
  loading_mt_vacuum?: string;
  loading_quantity_recorded_at?: string;
  loading_quantity_description?: string;

  updates: VesselActivityUpdate[];
  legs: VesselActivityLeg[];
}

export interface VesselActivityUpdate {
  id: string;
  vessel_activity_id: string;
  leg_id?: string;
  content: string;
  image_url?: string;
  recorded_by: string;
  recorded_by_name?: string;
  recorded_at: string;
  // BM correction markers — a corrected record stays visibly corrected.
  edited_at?: string;
  edited_by?: string;
  edited_by_name?: string;
  edit_reason?: string;
}

export interface VesselActivityLeg {
  id: string;
  vessel_activity_id: string;
  receiving_vessel_name: string;
  imo_number?: string;
  eta_at?: string;
  created_by: string;
  created_at: string;

  stage?: string;
  stage_cast_off_system_at?: string;
  stage_cast_off_user_at?: string;
  stage_alongside_system_at?: string;
  stage_alongside_user_at?: string;
  stage_discharge_commenced_system_at?: string;
  stage_discharge_commenced_user_at?: string;
  stage_discharge_completed_system_at?: string;
  stage_discharge_completed_user_at?: string;

  hse_checklist: { section?: string; item: string; passed: boolean; notes?: string }[];
  hse_result?: string;
  hse_conducted_by?: string;
  hse_conducted_at?: string;
  hse_notes?: string;

  quantity_discharged_litres?: string;
  density?: string;
  temperature_before_loading?: string;
  temperature_after_loading?: string;
  vcf?: string;
  gov?: string;
  gsv?: string;
  mt_vacuum?: string;
  quantity_recorded_at?: string;
  quantity_description?: string;

  cancelled_at?: string;
  cancelled_reason?: string;

  adhoc_client_email?: string;
  adhoc_client_name?: string;
}

export const LEG_STAGES: { value: string; label: string }[] = [
  { value: "cast_off", label: "Cast Off" },
  { value: "alongside", label: "Alongside" },
  { value: "discharge_commenced", label: "Discharge Commenced" },
  { value: "discharge_completed", label: "Discharge Completed" },
];

// ─── BDN ─────────────────────────────────────────────────────────────────────

export interface BDN {
  id: string;
  bdn_number: string;
  operation_id: string;
  vessel_id: string;
  generated_by: string;
  reviewed_by?: string;
  status: string;
  quantity_delivered_mt: string;
  product_type?: string;
  fuel_type?: string;
  delivery_date: string;
  rejection_reason?: string;
  approved_at?: string;
  pdf_url?: string;
  notes?: string;
  created_at: string;
}

export interface TruckBdn {
  id: string;
  truck_bdn_number: string;
  operation_id: string;
  generated_by: string;
  generated_by_name?: string;
  reviewed_by?: string;
  status: string;
  company_name: string;
  product_type: string;
  discharge_location: string;
  quantity_loaded_mt: string;
  quantity_discharged_mt: string;
  variance_mt?: string;
  density: string;
  temperature: string;
  vcf: string;
  gov: string;
  gsv: string;
  mt_vacuum: string;
  discharge_commenced_at: string;
  discharge_completed_at: string;
  discharge_completion_date: string;
  system_product_type?: string;
  system_discharge_location?: string;
  system_quantity_loaded_mt?: string;
  system_quantity_discharged_mt?: string;
  system_discharge_commenced_at?: string;
  system_discharge_completed_at?: string;
  rejection_reason?: string;
  approved_at?: string;
  pdf_url?: string;
  notes?: string;
  created_at: string;
}

export interface VesselBdn {
  id: string;
  bdn_number: string;
  operation_id: string;
  vessel_id: string;
  vessel_activity_id?: string;
  vessel_leg_id?: string;
  generated_by: string;
  generated_by_name?: string;
  reviewed_by?: string;
  status: string;
  company_name: string;
  product_type: string;
  discharge_location: string;
  receiving_vessel: string;
  quantity_loaded_litres: string;
  quantity_discharged_litres: string;
  variance_litres?: string;
  density: string;
  temperature: string;
  vcf: string;
  discharge_gov: string;
  discharge_gsv: string;
  discharge_mt_vacuum: string;
  discharge_commenced_at?: string;
  discharge_completed_at: string;
  discharge_completion_date: string;
  received_gov?: string;
  received_gsv?: string;
  received_mt_vacuum?: string;
  // Truck-vs-vessel reconciliation (Full Operation only) — truck_discharged_total_mt
  // is system-computed, never entered; vessel_received_total_mt is the one
  // manual figure; truck_variance_mt is derived. Null for vessel_only BDNs.
  truck_discharged_total_mt?: string;
  vessel_received_total_mt?: string;
  truck_variance_mt?: string;
  system_product_type?: string;
  system_discharge_location?: string;
  system_quantity_loaded_litres?: string;
  system_quantity_discharged_litres?: string;
  system_discharge_commenced_at?: string;
  system_discharge_completed_at?: string;
  rejection_reason?: string;
  approved_at?: string;
  notes?: string;
  created_at: string;
}

export interface TerminalLoadingReceipt {
  id: string;
  operation_id: string;
  quantity_litres: string;
  gov?: string;
  gsv?: string;
  mt_vacuum?: string;
  description?: string;
  recorded_by: string;
  recorded_by_name?: string;
  recorded_at: string;
}

export interface QuantitySummary {
  truck_loaded_mt: string;
  terminal_loaded_mt: string;
  total_loaded_mt: string;
}

// ─── Documents ───────────────────────────────────────────────────────────────

export interface Document {
  id: string;
  operation_id: string;
  uploaded_by: string;
  document_type: string;
  file_name: string;
  file_url: string;
  file_size_bytes?: number;
  mime_type?: string;
  description?: string;
  is_deleted: boolean;
  created_at: string;
}

// ─── Notifications ───────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  is_read: boolean;
  operation_id?: string;
  action_url?: string;
  created_at: string;
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface AnalyticsDashboard {
  operations: {
    total_operations: number;
    active_operations: number;
    completed_this_month: number;
    total_pfis: number;
    total_bdns_approved: number;
    total_volume_mt: string | null;
    by_status: { status: string; count: number }[];
  };
  trucks: {
    total_trucks: number;
    available: number;
    in_transit: number;
    discharging: number;
    total_operations: number;
    total_volume_mt: string;
  };
  vessels: {
    total_vessels: number;
    total_rob_entries: number;
    current_rob_mt: string;
  };
  revenue: { currency: string; total_amount: string; payment_count: number }[];
}

// ─── Audit Log ───────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  acted_as_role?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string;
  changes?: Record<string, unknown>;
  reason?: string;
  created_at: string;
}

// ─── Milestones ──────────────────────────────────────────────────────────────

export interface Milestone {
  milestone_type: string;
  title: string;
  description: string;
  reached_at: string;
}

// ─── API Response wrappers ───────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  errors: string[];
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
}
