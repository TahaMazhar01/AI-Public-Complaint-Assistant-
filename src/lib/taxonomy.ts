import type {
  Category,
  CategoryId,
  Department,
  DepartmentId,
  Priority,
} from "./types";

/* ============================================================
   ROUTING LIVES HERE - NOT IN THE PROMPT.
   The model picks a CATEGORY. This table picks the DEPARTMENT.
   That split is deliberate: routing stays deterministic and
   auditable even when the model is wrong, and a new city can be
   onboarded by editing one file.
   ============================================================ */

export const CITY = {
  id: "lhr",
  name: "Lahore",
  nameUr: "لاہور",
  center: { lat: 31.5204, lng: 74.3587 },
  bounds: { minLat: 31.35, maxLat: 31.68, minLng: 74.15, maxLng: 74.55 },
} as const;

/** Real civic bodies with real remits. Judges from Lahore will check this. */
export const DEPARTMENTS: Record<DepartmentId, Department> = {
  wasa: {
    id: "wasa",
    name: "Water & Sanitation Agency, Lahore",
    shortName: "WASA",
    remit: "Water supply, sewerage, drainage, urban flooding",
    escalatesTo: "lda",
  },
  lwmc: {
    id: "lwmc",
    name: "Lahore Waste Management Company",
    shortName: "LWMC",
    remit: "Solid waste collection, street sweeping, illegal dumping",
    escalatesTo: "mcl",
  },
  lesco: {
    id: "lesco",
    name: "Lahore Electric Supply Company",
    shortName: "LESCO",
    remit: "Power supply, transformers, hanging or exposed cabling",
    escalatesTo: null,
  },
  sngpl: {
    id: "sngpl",
    name: "Sui Northern Gas Pipelines Ltd",
    shortName: "SNGPL",
    remit: "Gas supply, pressure faults, suspected leaks",
    escalatesTo: null,
  },
  tepa: {
    id: "tepa",
    name: "Traffic Engineering & Transport Planning Agency",
    shortName: "TEPA",
    remit: "Road surfaces, signals, signage, road-side infrastructure",
    escalatesTo: "lda",
  },
  mcl: {
    id: "mcl",
    name: "Metropolitan Corporation Lahore",
    shortName: "MCL",
    remit: "Street lighting, encroachment, stray animals, general municipal",
    escalatesTo: "lda",
  },
  lda: {
    id: "lda",
    name: "Lahore Development Authority",
    shortName: "LDA",
    remit: "Building violations, illegal construction, land use",
    escalatesTo: null,
  },
  pha: {
    id: "pha",
    name: "Parks & Horticulture Authority",
    shortName: "PHA",
    remit: "Public parks, green belts, tree felling and maintenance",
    escalatesTo: "mcl",
  },
  epa: {
    id: "epa",
    name: "Environment Protection Agency, Punjab",
    shortName: "EPA",
    remit: "Air quality, smog, industrial emissions, noise pollution",
    escalatesTo: null,
  },
  health: {
    id: "health",
    name: "District Health Authority, Lahore",
    shortName: "DHA-L",
    remit: "Disease outbreaks, food safety, public health hazards",
    escalatesTo: null,
  },
  pta: {
    id: "pta",
    name: "Punjab Transport Authority",
    shortName: "PTA",
    remit: "Public transport, route violations, overcharging",
    escalatesTo: null,
  },
  rescue1122: {
    id: "rescue1122",
    name: "Punjab Emergency Service (Rescue 1122)",
    shortName: "Rescue 1122",
    remit: "Immediate life-safety emergencies",
    escalatesTo: null,
  },
};

/** Categories the model must choose from. `cues` both steer the model
    and drive the offline keyword fallback used in demo mode. */
export const CATEGORIES: Record<CategoryId, Category> = {
  roads_potholes: {
    id: "roads_potholes",
    label: "Roads & Potholes",
    labelUr: "سڑکیں اور گڑھے",
    department: "tepa",
    cues: ["pothole", "gaddha", "broken road", "sarak", "tuta", "road damage", "speed breaker"],
    baseSlaHours: 72,
  },
  street_lighting: {
    id: "street_lighting",
    label: "Street Lighting",
    labelUr: "اسٹریٹ لائٹ",
    department: "mcl",
    cues: ["street light", "lamp post", "andhera", "dark street", "bulb", "light kharab"],
    baseSlaHours: 96,
  },
  water_supply: {
    id: "water_supply",
    label: "Water Supply",
    labelUr: "پانی کی فراہمی",
    department: "wasa",
    cues: ["no water", "pani nahi", "low pressure", "dirty water", "water tanker", "supply band"],
    baseSlaHours: 24,
  },
  sewerage_drainage: {
    id: "sewerage_drainage",
    label: "Sewerage & Drainage",
    labelUr: "سیوریج اور نکاسی",
    department: "wasa",
    cues: ["sewerage", "gutter", "drain", "overflow", "gandha pani", "manhole", "blockage", "seepage"],
    baseSlaHours: 24,
  },
  solid_waste: {
    id: "solid_waste",
    label: "Garbage & Sanitation",
    labelUr: "کچرا اور صفائی",
    department: "lwmc",
    cues: ["garbage", "kachra", "trash", "dump", "rubbish", "safai", "waste not collected", "kooda"],
    baseSlaHours: 48,
  },
  electricity: {
    id: "electricity",
    label: "Electricity",
    labelUr: "بجلی",
    department: "lesco",
    cues: ["bijli", "power cut", "transformer", "wire", "electric shock", "load shedding", "meter"],
    baseSlaHours: 24,
  },
  gas_supply: {
    id: "gas_supply",
    label: "Gas Supply",
    labelUr: "گیس",
    department: "sngpl",
    cues: ["gas", "leak", "pressure", "cylinder", "gas nahi", "smell of gas"],
    baseSlaHours: 12,
  },
  traffic_signals: {
    id: "traffic_signals",
    label: "Traffic Signals & Signage",
    labelUr: "ٹریفک سگنل",
    department: "tepa",
    cues: ["signal", "traffic light", "zebra crossing", "sign board", "u-turn", "signal kharab"],
    baseSlaHours: 48,
  },
  encroachment: {
    id: "encroachment",
    label: "Encroachment",
    labelUr: "تجاوزات",
    department: "mcl",
    cues: ["encroachment", "qabza", "footpath blocked", "illegal stall", "thela", "khokha"],
    baseSlaHours: 96,
  },
  public_transport: {
    id: "public_transport",
    label: "Public Transport",
    labelUr: "پبلک ٹرانسپورٹ",
    department: "pta",
    cues: ["bus", "metro", "rickshaw", "overcharging", "route", "conductor", "kiraya"],
    baseSlaHours: 96,
  },
  parks_trees: {
    id: "parks_trees",
    label: "Parks & Trees",
    labelUr: "پارک اور درخت",
    department: "pha",
    cues: ["park", "tree", "green belt", "playground", "darakht", "grass", "bench"],
    baseSlaHours: 120,
  },
  stray_animals: {
    id: "stray_animals",
    label: "Stray Animals",
    labelUr: "آوارہ جانور",
    department: "mcl",
    cues: ["stray dog", "kutta", "cattle", "animal bite", "awara janwar", "monkey"],
    baseSlaHours: 48,
  },
  building_violation: {
    id: "building_violation",
    label: "Building Violation",
    labelUr: "تعمیراتی خلاف ورزی",
    department: "lda",
    cues: ["illegal construction", "naqsha", "extra floor", "commercial in residential", "building violation"],
    baseSlaHours: 120,
  },
  noise_pollution: {
    id: "noise_pollution",
    label: "Noise Pollution",
    labelUr: "شور کی آلودگی",
    department: "epa",
    cues: ["noise", "loud", "shor", "generator", "marriage hall", "loudspeaker", "horn"],
    baseSlaHours: 72,
  },
  air_quality: {
    id: "air_quality",
    label: "Air Quality & Smog",
    labelUr: "فضائی آلودگی",
    department: "epa",
    cues: ["smog", "smoke", "dhuan", "burning", "factory emission", "air quality", "dust"],
    baseSlaHours: 72,
  },
  public_health: {
    id: "public_health",
    label: "Public Health",
    labelUr: "صحت عامہ",
    department: "health",
    cues: ["dengue", "mosquito", "outbreak", "expired food", "clinic", "bimari", "epidemic"],
    baseSlaHours: 24,
  },
  urban_flooding: {
    id: "urban_flooding",
    label: "Urban Flooding",
    labelUr: "شہری سیلاب",
    department: "wasa",
    cues: ["flood", "rain water", "barish ka pani", "waterlogging", "street flooded", "knee deep"],
    baseSlaHours: 12,
  },
  other: {
    id: "other",
    label: "Other",
    labelUr: "دیگر",
    department: "mcl",
    cues: [],
    baseSlaHours: 120,
  },
};

export const CATEGORY_LIST = Object.values(CATEGORIES);
export const DEPARTMENT_LIST = Object.values(DEPARTMENTS);
export const CATEGORY_IDS = Object.keys(CATEGORIES) as CategoryId[];

/* ------------------------------------------------------------
   PRIORITY
   ------------------------------------------------------------ */
export const PRIORITY_META: Record<
  Priority,
  { label: string; rank: number; slaMultiplier: number; description: string }
> = {
  P1: {
    label: "Critical",
    rank: 1,
    slaMultiplier: 0.15,
    description: "Immediate risk to life, health, or safety",
  },
  P2: {
    label: "High",
    rank: 2,
    slaMultiplier: 0.4,
    description: "Serious disruption, or a hazard that will worsen quickly",
  },
  P3: {
    label: "Medium",
    rank: 3,
    slaMultiplier: 1,
    description: "Standard civic fault affecting daily life",
  },
  P4: {
    label: "Low",
    rank: 4,
    slaMultiplier: 2,
    description: "Minor or cosmetic, with no safety impact",
  },
};

/** Human-readable hazard labels. Shown verbatim to citizen and officer,
    so the priority is never an unexplained number. */
export const HAZARD_LABELS: Record<string, string> = {
  children_at_risk: "Children at risk",
  health_hazard: "Health hazard",
  traffic_danger: "Traffic danger",
  structural_risk: "Structural risk",
  fire_or_electrical_risk: "Fire / electrical risk",
  water_contamination: "Water contamination",
  elderly_or_disabled_affected: "Elderly or disabled affected",
  blocking_access: "Blocking access",
  recurring_issue: "Recurring issue",
  large_population_affected: "Large population affected",
};

/** Deterministic routing. The model never picks the department. */
export function routeToDepartment(category: CategoryId): DepartmentId {
  return CATEGORIES[category]?.department ?? "mcl";
}

/** SLA = the category baseline, compressed by how urgent it is.
    Floors at 4h so the system never promises the impossible. */
export function resolveSlaHours(category: CategoryId, priority: Priority): number {
  const base = CATEGORIES[category]?.baseSlaHours ?? 120;
  return Math.max(4, Math.round(base * PRIORITY_META[priority].slaMultiplier));
}

export function departmentFor(category: CategoryId): Department {
  return DEPARTMENTS[routeToDepartment(category)];
}
