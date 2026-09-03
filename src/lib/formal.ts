import { CATEGORIES, DEPARTMENTS, HAZARD_LABELS, PRIORITY_META } from "./taxonomy";
import type { CategoryId, DepartmentId, HazardFlag, Priority } from "./types";

/* ============================================================
   FORMAL COMPLAINT COMPOSITION
   The citizen speaks casually. The department receives a letter
   in the register it actually expects. This function is the
   bridge — and it is deterministic, so the same complaint always
   produces the same document.
   ============================================================ */

export interface FormalInput {
  trackingId: string;
  category: CategoryId;
  departmentId: DepartmentId;
  priority: Priority;
  summary: string;
  addressText: string | null;
  neighbourhood: string | null;
  hazards: HazardFlag[];
  slaHours: number;
  citizenName?: string | null;
  filedAt?: Date;
}

function hazardSentence(hazards: HazardFlag[]): string {
  if (hazards.length === 0) return "";
  const phrases = hazards
    .map((h) => HAZARD_LABELS[h]?.toLowerCase())
    .filter(Boolean);
  if (phrases.length === 0) return "";
  const list =
    phrases.length === 1
      ? phrases[0]
      : `${phrases.slice(0, -1).join(", ")} and ${phrases[phrases.length - 1]}`;
  return `The matter carries a documented risk of ${list}, which is the basis of the priority assigned below. `;
}

export function composeFormalText(input: FormalInput): string {
  const dept = DEPARTMENTS[input.departmentId];
  const cat = CATEGORIES[input.category];
  const pri = PRIORITY_META[input.priority];
  const filed = input.filedAt ?? new Date();
  const where = input.addressText ?? input.neighbourhood ?? "Lahore";

  const deadline = new Date(filed.getTime() + input.slaHours * 3600_000);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  return `To,
The Director,
${dept.name} (${dept.shortName})

Subject: ${cat.label} at ${where}
Reference: ${input.trackingId}
Date: ${fmt(filed)}

Respected Sir / Madam,

I wish to formally bring to your notice a civic matter falling within the remit of your department (${dept.remit.toLowerCase()}).

${input.summary}

The location of the issue is ${where}. ${hazardSentence(input.hazards)}Accordingly, this complaint has been classified as ${input.priority} (${pri.label}): ${pri.description.toLowerCase()}.

In line with the service standard applicable to this category, a response is requested on or before ${fmt(deadline)} (${input.slaHours} hours from filing).

I therefore request that the concerned staff be directed to inspect the site and take corrective action at the earliest, and that the undersigned be informed of the steps taken against the reference number quoted above.

Yours faithfully,
${input.citizenName?.trim() || "A concerned resident"}

Filed through Awaaz, the AI Public Complaint Assistant.
This complaint was generated from a citizen report and routed automatically to ${dept.shortName}.
Tracking reference: ${input.trackingId}`;
}
