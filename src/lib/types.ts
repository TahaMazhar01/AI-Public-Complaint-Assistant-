/* ============================================================
   AWAAZ — CORE DOMAIN TYPES
   The contract between the three build lanes. Change nothing
   here without telling the other two people.
   ============================================================ */

export type Priority = "P1" | "P2" | "P3" | "P4";

export type ComplaintStatus =
  | "submitted"    // received, not yet routed
  | "routed"       // assigned to a department
  | "acknowledged" // department has seen it
  | "in_progress"  // work started
  | "resolved"
  | "rejected";

export type IntakeMode = "text" | "voice" | "photo";

/** ur-latn = Roman Urdu ("sarak pe pani khara hai"). Very common in practice. */
export type Language = "en" | "ur" | "ur-latn" | "mixed";

/** Explainable risk signals. These are WHY a complaint got its priority,
    and they are shown to the citizen and the officer verbatim. */
export type HazardFlag =
  | "children_at_risk"
  | "health_hazard"
  | "traffic_danger"
  | "structural_risk"
  | "fire_or_electrical_risk"
  | "water_contamination"
  | "elderly_or_disabled_affected"
  | "blocking_access"
  | "recurring_issue"
  | "large_population_affected";

export type CategoryId =
  | "roads_potholes"
  | "street_lighting"
  | "water_supply"
  | "sewerage_drainage"
  | "solid_waste"
  | "electricity"
  | "gas_supply"
  | "traffic_signals"
  | "encroachment"
  | "public_transport"
  | "parks_trees"
  | "stray_animals"
  | "building_violation"
  | "noise_pollution"
  | "air_quality"
  | "public_health"
  | "urban_flooding"
  | "other";

export type DepartmentId =
  | "wasa"
  | "lwmc"
  | "lesco"
  | "sngpl"
  | "tepa"
  | "mcl"
  | "lda"
  | "pha"
  | "epa"
  | "health"
  | "pta"
  | "rescue1122";

/* ------------------------------------------------------------
   WHAT THE MODEL RETURNS
   One structured call produces exactly this. Nothing more.
   ------------------------------------------------------------ */
export interface ComplaintAnalysis {
  title: string;
  summary: string;
  category: CategoryId;
  priority: Priority;
  priority_reason: string;
  hazard_flags: HazardFlag[];
  detected_language: Language;
  location_hint: string | null;
  formal_text: string;
  confidence: number; // 0–1, the model's own read on how clear the report was
  needs_clarification: string | null;
}

/* ------------------------------------------------------------
   WHAT THE DATABASE STORES
   ------------------------------------------------------------ */
export interface Complaint {
  id: string;
  tracking_id: string; // AWZ-LHR-2609-0043

  created_at: string;
  updated_at: string;

  // --- raw intake ---
  raw_text: string;
  intake_mode: IntakeMode;
  detected_language: Language;
  audio_url: string | null;
  photo_urls: string[];

  // --- where ---
  lat: number | null;
  lng: number | null;
  address_text: string | null;
  neighbourhood: string | null;
  city: string;

  // --- AI output ---
  title: string;
  summary: string;
  category: CategoryId;
  department_id: DepartmentId;
  priority: Priority;
  priority_reason: string;
  hazard_flags: HazardFlag[];
  formal_text: string;
  confidence: number;

  // --- lifecycle ---
  status: ComplaintStatus;
  sla_hours: number;
  due_at: string;
  resolved_at: string | null;
  assigned_officer: string | null;

  // --- duplicate clustering ---
  cluster_id: string | null;
  is_cluster_parent: boolean;
  duplicate_count: number;

  // --- reporter ---
  citizen_name: string | null;
  citizen_phone: string | null;
}

/** Append-only audit trail. Every state change writes one row.
    This is what the citizen tracking timeline renders. */
export interface ComplaintEvent {
  id: string;
  complaint_id: string;
  created_at: string;
  kind:
    | "received"
    | "analysed"
    | "routed"
    | "merged"
    | "escalated"
    | "status_changed"
    | "note"
    | "resolved";
  actor: "citizen" | "awaaz_ai" | "officer" | "system";
  message: string;
  meta: Record<string, unknown> | null;
}

/* ------------------------------------------------------------
   REFERENCE DATA SHAPES
   ------------------------------------------------------------ */
export interface Department {
  id: DepartmentId;
  name: string;
  shortName: string;
  remit: string;
  escalatesTo: DepartmentId | null;
}

export interface Category {
  id: CategoryId;
  label: string;
  labelUr: string;
  department: DepartmentId;
  /** Nudges the model and powers keyword fallback in demo mode. */
  cues: string[];
  /** Hours allowed before it is overdue, at baseline priority P3. */
  baseSlaHours: number;
}

/** Result of the dedupe pass — surfaced to the citizen as
    "12 other people reported this". */
export interface DuplicateMatch {
  complaint_id: string;
  tracking_id: string;
  similarity: number;
  distance_m: number;
  created_at: string;
}
