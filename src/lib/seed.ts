import { composeFormalText } from "./formal";
import { NEIGHBOURHOODS, jitter } from "./geo";
import { resolveSlaHours, routeToDepartment } from "./taxonomy";
import type {
  CategoryId,
  Complaint,
  ComplaintEvent,
  ComplaintStatus,
  HazardFlag,
  IntakeMode,
  Language,
  Priority,
} from "./types";
import { formatTrackingId } from "./utils";

/* ============================================================
   DEMO CORPUS
   A dashboard with four rows in it loses hackathons. This builds
   a plausible week of civic traffic for Lahore — deterministic,
   so every teammate and every demo run sees the same city.
   ============================================================ */

interface Template {
  raw: string;
  lang: Language;
  category: CategoryId;
  priority: Priority;
  hazards: HazardFlag[];
  title: string;
  summary: string;
  mode?: IntakeMode;
}

const TEMPLATES: Template[] = [
  {
    raw: "Sewerage ka pani teen din se sarak pe khara hai, bohat badbo hai aur bachay wahin khelte hain. Koi sunwai nahi ho rahi.",
    lang: "ur-latn",
    category: "sewerage_drainage",
    priority: "P1",
    hazards: ["children_at_risk", "health_hazard", "blocking_access"],
    title: "Sewerage overflow standing on residential street",
    summary:
      "Untreated sewage has been standing on a residential street for three days, producing a strong odour. Children are reported to be playing in the affected area and residents say earlier reports went unanswered.",
    mode: "voice",
  },
  {
    raw: "There is a huge pothole right before the turn and two bikes have already fallen. It gets worse after rain.",
    lang: "en",
    category: "roads_potholes",
    priority: "P2",
    hazards: ["traffic_danger", "recurring_issue"],
    title: "Deep pothole causing motorcycle accidents",
    summary:
      "A large pothole immediately before a turning has already caused two motorcycle falls. The hazard worsens after rainfall when the depth is concealed by standing water.",
  },
  {
    raw: "پوری گلی کی اسٹریٹ لائٹس دو ہفتے سے بند ہیں، رات کو نکلنا خطرناک ہے۔",
    lang: "ur",
    category: "street_lighting",
    priority: "P3",
    hazards: ["elderly_or_disabled_affected"],
    title: "Entire street unlit for two weeks",
    summary:
      "All street lights along one residential lane have been non-functional for approximately two weeks, making movement after dark unsafe for residents.",
  },
  {
    raw: "Kachra utha nahi hai pichle 5 din se, poori gali mein makhian aur badbo. Dengue ka season bhi hai.",
    lang: "ur-latn",
    category: "solid_waste",
    priority: "P2",
    hazards: ["health_hazard", "large_population_affected"],
    title: "Waste uncollected for five days",
    summary:
      "Household waste has not been collected for five days, resulting in fly infestation and odour across the lane. Residents raise concern given the current dengue season.",
  },
  {
    raw: "Transformer se sparking ho rahi hai aur wire neeche latak raha hai. Bachon ka school ka rasta wahin se hai.",
    lang: "ur-latn",
    category: "electricity",
    priority: "P1",
    hazards: ["fire_or_electrical_risk", "children_at_risk", "traffic_danger"],
    title: "Sparking transformer with low-hanging cable",
    summary:
      "A pole-mounted transformer is visibly sparking and an associated cable hangs at low height over a route used by schoolchildren. Immediate isolation is required.",
    mode: "photo",
  },
  {
    raw: "Gas pressure itna kam hai ke subah roti nahi ban sakti. Poore block ka yehi masla hai.",
    lang: "ur-latn",
    category: "gas_supply",
    priority: "P3",
    hazards: ["large_population_affected"],
    title: "Severe low gas pressure across block",
    summary:
      "Gas pressure during morning hours is insufficient for cooking. The complaint is reported as affecting an entire residential block rather than a single connection.",
  },
  {
    raw: "Barish ke baad ghutno tak pani khara ho jata hai, dukanein band karni padti hain.",
    lang: "ur-latn",
    category: "urban_flooding",
    priority: "P1",
    hazards: ["blocking_access", "large_population_affected", "recurring_issue"],
    title: "Knee-deep waterlogging after rainfall",
    summary:
      "Rainwater accumulates to knee height after every spell, forcing commercial premises to close. Drainage capacity at this point appears inadequate and the issue recurs seasonally.",
  },
  {
    raw: "Footpath pe thele aur khokhay laga diye hain, pedestrians ko sarak pe chalna padta hai.",
    lang: "ur-latn",
    category: "encroachment",
    priority: "P3",
    hazards: ["traffic_danger", "blocking_access"],
    title: "Footpath occupied by vendor stalls",
    summary:
      "Vendor carts and temporary stalls have occupied the pedestrian footpath, forcing pedestrians onto the carriageway alongside moving traffic.",
  },
  {
    raw: "Paani bilkul gandha aa raha hai, peene layak nahi. Bachay bimar ho gaye hain.",
    lang: "ur-latn",
    category: "water_supply",
    priority: "P1",
    hazards: ["water_contamination", "health_hazard", "children_at_risk"],
    title: "Contaminated water in domestic supply",
    summary:
      "Domestic supply is discoloured and reported as unfit for consumption. Residents link recent illness among children in the household to the supply.",
  },
  {
    raw: "The traffic signal at this crossing has been dead for a week. Cars just push through and it is chaos at rush hour.",
    lang: "en",
    category: "traffic_signals",
    priority: "P2",
    hazards: ["traffic_danger", "large_population_affected"],
    title: "Traffic signal non-functional at major crossing",
    summary:
      "Signal heads at a busy intersection have been inoperative for approximately one week, producing uncontrolled conflicting movements during peak hours.",
  },
  {
    raw: "Awara kuttay ka jhund hai, kal ek bachay ko kaat liya. School ke bahar khare rehte hain.",
    lang: "ur-latn",
    category: "stray_animals",
    priority: "P1",
    hazards: ["children_at_risk", "health_hazard"],
    title: "Stray dog pack outside school, bite reported",
    summary:
      "A pack of stray dogs congregates outside a school gate. One child was bitten the previous day. Immediate capture and post-exposure follow-up are requested.",
  },
  {
    raw: "Marriage hall raat 2 baje tak loudspeaker chalata hai, koi so nahi sakta.",
    lang: "ur-latn",
    category: "noise_pollution",
    priority: "P3",
    hazards: ["recurring_issue", "large_population_affected"],
    title: "Marriage hall amplified noise past permitted hours",
    summary:
      "A commercial marriage hall operates loudspeakers until approximately 2am, in excess of permitted hours, disturbing the surrounding residential area.",
  },
  {
    raw: "Factory se kala dhuan nikal raha hai subah shaam, saans lena mushkil hai aur smog season bhi shuru hai.",
    lang: "ur-latn",
    category: "air_quality",
    priority: "P2",
    hazards: ["health_hazard", "large_population_affected"],
    title: "Persistent black smoke emission from industrial unit",
    summary:
      "An industrial unit emits dense black smoke morning and evening. Residents report breathing difficulty, compounded by the onset of the smog season.",
  },
  {
    raw: "Park mein jhoolay tootay hue hain aur ghaas mein sharab ki botlein padi hain. Bachay wahan nahi ja sakte.",
    lang: "ur-latn",
    category: "parks_trees",
    priority: "P4",
    hazards: ["children_at_risk"],
    title: "Broken playground equipment and litter in public park",
    summary:
      "Playground equipment in a public park is broken and the grounds contain glass litter, rendering the space unusable for children.",
  },
  {
    raw: "Residential plot pe 5 manzila commercial building bana rahe hain, naqsha pass nahi hai.",
    lang: "ur-latn",
    category: "building_violation",
    priority: "P3",
    hazards: ["structural_risk"],
    title: "Unapproved commercial construction on residential plot",
    summary:
      "A five-storey commercial structure is under construction on a plot designated residential. The complainant states no approved building plan exists for the work.",
  },
  {
    raw: "Dengue ke cases barh rahe hain, khare pani ke talab hain khali plot pe. Spray nahi hui abhi tak.",
    lang: "ur-latn",
    category: "public_health",
    priority: "P2",
    hazards: ["health_hazard", "large_population_affected", "children_at_risk"],
    title: "Dengue breeding site on vacant plot",
    summary:
      "Standing water on a vacant plot is acting as a mosquito breeding site amid rising dengue cases in the locality. No larviciding has been carried out to date.",
  },
  {
    raw: "Bus conductor double kiraya le raha hai aur route adha chhor deta hai.",
    lang: "ur-latn",
    category: "public_transport",
    priority: "P4",
    hazards: [],
    title: "Overcharging and route curtailment on public bus",
    summary:
      "A public service vehicle is reported to be charging double the notified fare and terminating the route short of its designated end point.",
  },
  {
    raw: "Manhole ka dhakkan gayab hai, raat ko koi bhi gir sakta hai. Bilkul rasta ke beech mein.",
    lang: "ur-latn",
    category: "sewerage_drainage",
    priority: "P1",
    hazards: ["traffic_danger", "children_at_risk", "blocking_access"],
    title: "Open manhole in carriageway",
    summary:
      "A manhole cover is missing from a shaft located in the middle of a used carriageway, presenting an immediate fall hazard, particularly after dark.",
  },
  {
    raw: "Road puri khud gayi hai kaam ke baad, wapas theek nahi ki. Do mahinay ho gaye.",
    lang: "ur-latn",
    category: "roads_potholes",
    priority: "P3",
    hazards: ["traffic_danger", "recurring_issue"],
    title: "Road left unrestored after utility excavation",
    summary:
      "A carriageway excavated for utility work has not been reinstated two months after the work concluded, leaving an uneven and hazardous surface.",
  },
  {
    raw: "Water supply bilkul band hai teen din se, tanker mangwana par raha hai jo bohat mehnga hai.",
    lang: "ur-latn",
    category: "water_supply",
    priority: "P2",
    hazards: ["large_population_affected"],
    title: "Complete supply outage for three days",
    summary:
      "Piped water supply has been fully interrupted for three days, forcing residents to purchase tanker water at significant cost.",
  },
  {
    raw: "Green belt ke darakht kaat diye bina permission ke, ab wahan parking bana rahe hain.",
    lang: "ur-latn",
    category: "parks_trees",
    priority: "P3",
    hazards: [],
    title: "Unauthorised tree felling on green belt",
    summary:
      "Mature trees on a designated green belt have been felled without apparent authorisation, and the cleared area is being converted to parking.",
  },
  {
    raw: "Streetlight pole se current aa raha hai, barish mein chhoo kar dekha to jhatka laga.",
    lang: "ur-latn",
    category: "street_lighting",
    priority: "P1",
    hazards: ["fire_or_electrical_risk", "children_at_risk"],
    title: "Live current in street light pole",
    summary:
      "A street light pole is energised and delivered an electric shock on contact during rain, indicating a failed earth or damaged internal wiring.",
  },
  {
    raw: "Kooda karkat ka dher khali plot pe hai, log wahan jala dete hain raat ko. Dhuan ghar tak aata hai.",
    lang: "ur-latn",
    category: "solid_waste",
    priority: "P2",
    hazards: ["health_hazard", "fire_or_electrical_risk"],
    title: "Illegal dumping followed by open burning",
    summary:
      "Waste accumulated on a vacant plot is being burned openly at night, producing smoke that reaches adjacent homes.",
  },
  {
    raw: "Load shedding schedule se bahar ho rahi hai, 8-8 ghante bijli nahi hoti.",
    lang: "ur-latn",
    category: "electricity",
    priority: "P3",
    hazards: ["large_population_affected"],
    title: "Unscheduled outages of up to eight hours",
    summary:
      "Power interruptions substantially exceeding the published schedule are reported, with continuous outages of up to eight hours.",
  },
  {
    raw: "Speed breaker itna ooncha bana diya hai ke gaari ka neeche wala hissa lagta hai, koi paint bhi nahi.",
    lang: "ur-latn",
    category: "roads_potholes",
    priority: "P4",
    hazards: ["traffic_danger"],
    title: "Excessive unmarked speed breaker",
    summary:
      "A speed breaker has been constructed above permissible height and carries no reflective marking, causing vehicle underbody contact.",
  },
  {
    raw: "There is a gas smell near the corner shop for the last two days. Nobody has come to check it.",
    lang: "en",
    category: "gas_supply",
    priority: "P1",
    hazards: ["fire_or_electrical_risk", "large_population_affected"],
    title: "Persistent gas odour near commercial premises",
    summary:
      "A gas odour has persisted near a commercial premises for two days with no inspection carried out, indicating a possible distribution leak.",
  },
];

/* ------------------------------------------------------------
   HOTSPOTS
   Real cities generate repeat reports at the same broken place —
   one bad intersection, one collapsed drain. These clusters make
   duplicate detection demonstrable rather than theoretical, and
   they are how "12 other people reported this" becomes true.
   ------------------------------------------------------------ */

interface Hotspot {
  hood: string;
  category: CategoryId;
  priority: Priority;
  hazards: HazardFlag[];
  title: string;
  summary: string;
  members: number;
  variants: string[];
}

const HOTSPOTS: Hotspot[] = [
  {
    hood: "Gulberg III",
    category: "sewerage_drainage",
    priority: "P1",
    hazards: ["children_at_risk", "health_hazard", "blocking_access", "recurring_issue"],
    title: "Sewerage overflow standing on residential street",
    summary:
      "Untreated sewage has been standing on a residential street for several days, producing a strong odour. Multiple residents report children playing in the affected area and say earlier complaints went unanswered.",
    members: 12,
    variants: [
      "Sewerage ka pani sarak pe khara hai teen din se, badbo bardasht se bahar hai aur bachay wahin khel rahe hain.",
      "Gutter overflow ho raha hai humari gali mein, gandha pani ghar ke bahar tak aa gaya hai. Bachon ka nikalna mushkil.",
      "The drain has been overflowing onto the street for days now. The smell is unbearable and children still play there.",
      "Sewerage line block hai, pani nikal ke sarak pe faila hua hai. Complaint ki thi lekin koi sunwai nahi hui.",
      "گلی میں سیوریج کا پانی کھڑا ہے، بدبو اور مکھیاں ہیں اور بچے وہیں کھیلتے ہیں۔",
    ],
  },
  {
    hood: "Johar Town",
    category: "roads_potholes",
    priority: "P2",
    hazards: ["traffic_danger", "recurring_issue"],
    title: "Pothole cluster causing repeated motorcycle falls",
    summary:
      "A concentration of deep potholes on a single stretch of carriageway has caused repeated motorcycle falls. The hazard is concealed by standing water after rainfall.",
    members: 8,
    variants: [
      "Sarak pe itne bade gaddhe hain ke motorcycle wale roz girte hain, barish mein to dikhte bhi nahi.",
      "Huge potholes on this stretch. Two bikes fell yesterday evening. It needs resurfacing, not patching.",
      "Road bilkul tut chuki hai, gaddhe hi gaddhe. Raat ko bohat khatarnak hai.",
      "Ye road pe gaddhay mahino se hain, patch lagate hain phir tut jati hai.",
    ],
  },
  {
    hood: "Androon Shehr",
    category: "solid_waste",
    priority: "P2",
    hazards: ["health_hazard", "large_population_affected"],
    title: "Waste accumulation across old-city lanes",
    summary:
      "Household and commercial waste has gone uncollected across several connected lanes, producing fly infestation and odour affecting a large number of households.",
    members: 9,
    variants: [
      "Kachra kai din se nahi utha, poori gali mein makhian aur badbo phaili hui hai.",
      "Garbage has not been collected in this area for over a week. It is piling up at the corner.",
      "Kooday ka dher lag gaya hai, dengue season mein ye bohat khatarnak hai sab ke liye.",
      "Safai wale aate hi nahi, poora mohalla pareshan hai kachray se.",
    ],
  },
  {
    hood: "Allama Iqbal Town",
    category: "street_lighting",
    priority: "P3",
    hazards: ["elderly_or_disabled_affected", "recurring_issue"],
    title: "Extended street lighting failure across block",
    summary:
      "Street lighting has failed across a connected set of residential lanes for an extended period, leaving the area unlit and unsafe for movement after dark.",
    members: 6,
    variants: [
      "Poori gali ki street lights band hain do hafte se, raat ko bilkul andhera hota hai.",
      "None of the street lights on our block have worked for weeks. It is completely dark at night.",
      "Andhera itna hai ke buzurg log raat ko bahar nahi nikal sakte, lights theek karwa dein.",
      "Light poles lagay hain lekin ek bhi jalta nahi, kai baar bola hai.",
    ],
  },
  {
    hood: "Shahdara",
    category: "urban_flooding",
    priority: "P1",
    hazards: ["blocking_access", "large_population_affected", "recurring_issue"],
    title: "Recurrent waterlogging at low-lying junction",
    summary:
      "Rainwater accumulates to significant depth at a low-lying junction after every spell, blocking access for residents and forcing commercial premises to close.",
    members: 7,
    variants: [
      "Barish ke baad ghutno tak pani khara ho jata hai, ghar se nikalna namumkin.",
      "Every time it rains this junction floods completely. Shops have to shut for the day.",
      "Pani nikalne ka koi intezam nahi, har barish mein yehi haal hota hai.",
      "Nikasi bilkul band hai, barish ka pani kai din khara rehta hai.",
    ],
  },
  {
    hood: "Model Town",
    category: "electricity",
    priority: "P1",
    hazards: ["fire_or_electrical_risk", "children_at_risk"],
    title: "Sparking transformer with exposed low cabling",
    summary:
      "A pole-mounted transformer is sparking intermittently with an associated cable hanging at low height above a pedestrian route. Immediate isolation has been requested by several residents.",
    members: 5,
    variants: [
      "Transformer se sparking ho rahi hai aur wire neeche latak raha hai, bachon ka school ka rasta wahin se hai.",
      "There is constant sparking from the transformer and a live cable is hanging low over the footpath.",
      "Bijli ka wire itna neecha hai ke koi bhi chhoo sakta hai, transformer se aag nikalti hai.",
      "Khambe se current aa raha hai aur sparking hoti rehti hai, koi hadsa ho jayega.",
    ],
  },
];

/* Deterministic PRNG so the demo city is identical on every machine. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STATUS_WALK: ComplaintStatus[] = [
  "submitted",
  "routed",
  "acknowledged",
  "in_progress",
  "resolved",
];

const NAMES = [
  "Ayesha Siddiqui", "Muhammad Bilal", "Fatima Noor", "Usman Ghani",
  "Hira Anwar", "Adnan Rasheed", "Sana Tariq", "Kamran Yousaf",
  null, null, null,
];

export interface SeedResult {
  complaints: Complaint[];
  events: ComplaintEvent[];
}

/** Builds a week of civic traffic. `now` is injectable so tests and
    the demo can pin a moment. */
export function buildSeed(count = 64, now: Date = new Date()): SeedResult {
  const rnd = mulberry32(20260902);
  const complaints: Complaint[] = [];
  const events: ComplaintEvent[] = [];

  const weighted: number[] = [];
  NEIGHBOURHOODS.forEach((n, i) => {
    for (let w = 0; w < n.weight; w++) weighted.push(i);
  });

  for (let i = 0; i < count; i++) {
    const tpl = TEMPLATES[Math.floor(rnd() * TEMPLATES.length)];
    const hood = NEIGHBOURHOODS[weighted[Math.floor(rnd() * weighted.length)]];

    // Spread across the last 7 days, front-loaded toward recent.
    const ageHours = Math.round(rnd() ** 1.15 * 168);
    const createdAt = new Date(now.getTime() - ageHours * 3600_000);

    const department = routeToDepartment(tpl.category);
    const slaHours = resolveSlaHours(tpl.category, tpl.priority);
    const dueAt = new Date(createdAt.getTime() + slaHours * 3600_000);

    // Lifecycle is driven by how far through its OWN deadline a case is,
    // not by raw age — a 12-hour gas complaint is late long before a
    // 120-hour parks complaint is. Most cases land inside their window;
    // a deliberate minority slip, because a console with nothing overdue
    // has nothing to manage.
    const dueFraction = ageHours / slaHours;
    const roll = rnd();
    const status: ComplaintStatus =
      dueFraction > 1
        ? roll < 0.84
          ? "resolved"
          : roll < 0.93
            ? "in_progress"
            : "acknowledged"
        : dueFraction > 0.5
          ? roll < 0.42
            ? "resolved"
            : roll < 0.78
              ? "in_progress"
              : "acknowledged"
          : dueFraction > 0.15
            ? roll < 0.55
              ? "acknowledged"
              : "routed"
            : roll < 0.5
              ? "routed"
              : "submitted";
    const statusIdx = STATUS_WALK.indexOf(status);

    const lat = jitter(hood.lat, i * 3 + 1);
    const lng = jitter(hood.lng, i * 7 + 2);
    const trackingId = formatTrackingId(1000 - count + i, "LHR", createdAt);
    const citizenName = NAMES[Math.floor(rnd() * NAMES.length)];

    const duplicateCount = 0;

    const complaint: Complaint = {
      id: `seed-${i}`,
      tracking_id: trackingId,
      created_at: createdAt.toISOString(),
      updated_at: createdAt.toISOString(),
      raw_text: tpl.raw,
      intake_mode: tpl.mode ?? (rnd() < 0.35 ? "voice" : "text"),
      detected_language: tpl.lang,
      audio_url: null,
      photo_urls: [],
      lat,
      lng,
      address_text: `${hood.name}, Lahore`,
      neighbourhood: hood.name,
      city: "Lahore",
      title: tpl.title,
      summary: tpl.summary,
      category: tpl.category,
      department_id: department,
      priority: tpl.priority,
      priority_reason: tpl.hazards.length
        ? `Escalated on ${tpl.hazards.length} risk signal${tpl.hazards.length > 1 ? "s" : ""} present in the report.`
        : "Standard civic fault with no elevated risk signals.",
      hazard_flags: tpl.hazards,
      formal_text: "",
      confidence: 0.72 + rnd() * 0.26,
      status,
      sla_hours: slaHours,
      due_at: dueAt.toISOString(),
      resolved_at:
        status === "resolved"
          ? new Date(createdAt.getTime() + slaHours * 0.7 * 3600_000).toISOString()
          : null,
      assigned_officer: statusIdx >= 2 ? "Inspector, Zone 4" : null,
      cluster_id: duplicateCount > 0 ? `cluster-${i}` : null,
      is_cluster_parent: true,
      duplicate_count: duplicateCount,
      citizen_name: citizenName,
      citizen_phone: citizenName ? "03**-*****72" : null,
    };

    complaint.formal_text = composeFormalText({
      trackingId,
      category: complaint.category,
      departmentId: complaint.department_id,
      priority: complaint.priority,
      summary: complaint.summary,
      addressText: complaint.address_text,
      neighbourhood: complaint.neighbourhood,
      hazards: complaint.hazard_flags,
      slaHours: complaint.sla_hours,
      citizenName: complaint.citizen_name,
      filedAt: createdAt,
    });

    complaints.push(complaint);
    events.push(...buildTimeline(complaint, statusIdx, duplicateCount));
  }

  /* ---- hotspot clusters ---------------------------------- */
  let seq = 2000;
  HOTSPOTS.forEach((spot, hi) => {
    const hood = NEIGHBOURHOODS.find((n) => n.name === spot.hood)!;
    // Anchored on the area centroid — the same point the area picker and
    // a device fix inside the neighbourhood resolve to. Members scatter
    // ~70m around it: one broken place, not one broken neighbourhood.
    const baseLat = hood.lat;
    const baseLng = hood.lng;
    const clusterId = `cluster-${spot.category}-${hi}`;
    const department = routeToDepartment(spot.category);
    const slaHours = resolveSlaHours(spot.category, spot.priority);

    for (let m = 0; m < spot.members; m++) {
      const isParent = m === 0;
      // The parent is the earliest report; corroborations arrive after.
      const ageHours = isParent ? 26 + rnd() * 20 : rnd() * 24;
      const createdAt = new Date(now.getTime() - ageHours * 3600_000);
      const trackingId = formatTrackingId(seq++, "LHR", createdAt);
      const citizenName = NAMES[Math.floor(rnd() * NAMES.length)];

      const c: Complaint = {
        id: `hot-${hi}-${m}`,
        tracking_id: trackingId,
        created_at: createdAt.toISOString(),
        updated_at: createdAt.toISOString(),
        raw_text: spot.variants[m % spot.variants.length],
        intake_mode: rnd() < 0.45 ? "voice" : "text",
        detected_language: /[؀-ۿ]/.test(spot.variants[m % spot.variants.length])
          ? "ur"
          : /\b(hai|nahi|mein|ka|ki)\b/.test(spot.variants[m % spot.variants.length])
            ? "ur-latn"
            : "en",
        audio_url: null,
        photo_urls: [],
        lat: jitter(baseLat, hi * 100 + m, 0.0007),
        lng: jitter(baseLng, hi * 200 + m, 0.0007),
        address_text: `${hood.name}, Lahore`,
        neighbourhood: hood.name,
        city: "Lahore",
        title: spot.title,
        summary: spot.summary,
        category: spot.category,
        department_id: department,
        priority: spot.priority,
        priority_reason: `Escalated on ${spot.hazards.length} risk signals, corroborated by ${spot.members - 1} further reports at the same location.`,
        hazard_flags: spot.hazards,
        formal_text: "",
        confidence: 0.8 + rnd() * 0.18,
        status: isParent ? "in_progress" : "routed",
        sla_hours: slaHours,
        due_at: new Date(createdAt.getTime() + slaHours * 3600_000).toISOString(),
        resolved_at: null,
        assigned_officer: isParent ? "Inspector, Zone 4" : null,
        cluster_id: clusterId,
        is_cluster_parent: isParent,
        duplicate_count: isParent ? spot.members - 1 : 0,
        citizen_name: citizenName,
        citizen_phone: citizenName ? "03**-*****72" : null,
      };

      c.formal_text = composeFormalText({
        trackingId,
        category: c.category,
        departmentId: c.department_id,
        priority: c.priority,
        summary: c.summary,
        addressText: c.address_text,
        neighbourhood: c.neighbourhood,
        hazards: c.hazard_flags,
        slaHours: c.sla_hours,
        citizenName: c.citizen_name,
        filedAt: createdAt,
      });

      complaints.push(c);
      events.push(...buildTimeline(c, isParent ? 3 : 1, c.duplicate_count));
    }
  });

  complaints.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return { complaints, events };
}

function buildTimeline(
  c: Complaint,
  statusIdx: number,
  duplicateCount: number,
): ComplaintEvent[] {
  const t0 = new Date(c.created_at).getTime();
  const out: ComplaintEvent[] = [];
  const push = (
    offsetMin: number,
    kind: ComplaintEvent["kind"],
    actor: ComplaintEvent["actor"],
    message: string,
  ) =>
    out.push({
      id: `${c.id}-ev-${out.length}`,
      complaint_id: c.id,
      created_at: new Date(t0 + offsetMin * 60_000).toISOString(),
      kind,
      actor,
      message,
      meta: null,
    });

  push(0, "received", "citizen", `Report received via ${c.intake_mode}.`);
  push(0.1, "analysed", "awaaz_ai", `Classified as ${c.title}. Priority ${c.priority}.`);
  push(0.2, "routed", "awaaz_ai", `Routed to ${c.department_id.toUpperCase()}.`);
  if (duplicateCount > 0) {
    push(1, "merged", "awaaz_ai", `${duplicateCount} matching reports merged into this case.`);
  }
  if (statusIdx >= 2) push(90, "status_changed", "officer", "Complaint acknowledged by department.");
  if (statusIdx >= 3) push(360, "status_changed", "officer", "Field team dispatched to site.");
  if (statusIdx >= 4) push(c.sla_hours * 42, "resolved", "officer", "Work completed and site verified.");

  return out;
}
