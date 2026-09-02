/* ============================================================
   LAHORE GEOGRAPHY
   Approximate centroids for real neighbourhoods. Used to seed
   demo data, to place map pins, and to give the reverse-geocode
   stub something honest to return.
   ============================================================ */

export interface Neighbourhood {
  name: string;
  nameUr: string;
  lat: number;
  lng: number;
  /** Rough population weight — drives how many demo complaints land here. */
  weight: number;
}

export const NEIGHBOURHOODS: Neighbourhood[] = [
  { name: "Gulberg III",        nameUr: "گلبرگ",         lat: 31.5100, lng: 74.3436, weight: 5 },
  { name: "Johar Town",         nameUr: "جوہر ٹاؤن",      lat: 31.4697, lng: 74.2728, weight: 5 },
  { name: "Model Town",         nameUr: "ماڈل ٹاؤن",      lat: 31.4805, lng: 74.3239, weight: 4 },
  { name: "Shadman",            nameUr: "شادمان",        lat: 31.5406, lng: 74.3200, weight: 3 },
  { name: "DHA Phase 5",        nameUr: "ڈی ایچ اے",     lat: 31.4744, lng: 74.4053, weight: 4 },
  { name: "Allama Iqbal Town",  nameUr: "اقبال ٹاؤن",     lat: 31.5075, lng: 74.2830, weight: 5 },
  { name: "Faisal Town",        nameUr: "فیصل ٹاؤن",      lat: 31.4869, lng: 74.3053, weight: 3 },
  { name: "Garden Town",        nameUr: "گارڈن ٹاؤن",     lat: 31.4936, lng: 74.3111, weight: 3 },
  { name: "Samanabad",          nameUr: "سمن آباد",       lat: 31.5330, lng: 74.2937, weight: 4 },
  { name: "Township",           nameUr: "ٹاؤن شپ",        lat: 31.4570, lng: 74.3080, weight: 3 },
  { name: "Wapda Town",         nameUr: "واپڈا ٹاؤن",     lat: 31.4300, lng: 74.2600, weight: 3 },
  { name: "Lahore Cantt",       nameUr: "لاہور چھاؤنی",   lat: 31.5497, lng: 74.4000, weight: 3 },
  { name: "Androon Shehr",      nameUr: "اندرون شہر",     lat: 31.5820, lng: 74.3130, weight: 5 },
  { name: "Kot Lakhpat",        nameUr: "کوٹ لکھپت",      lat: 31.4520, lng: 74.3320, weight: 3 },
  { name: "Mughalpura",         nameUr: "مغل پورہ",       lat: 31.5680, lng: 74.3720, weight: 3 },
  { name: "Baghbanpura",        nameUr: "باغبانپورہ",     lat: 31.5930, lng: 74.3760, weight: 2 },
  { name: "Harbanspura",        nameUr: "ہربنس پورہ",     lat: 31.5810, lng: 74.4200, weight: 2 },
  { name: "Shahdara",           nameUr: "شاہدرہ",        lat: 31.6280, lng: 74.2880, weight: 3 },
  { name: "Sabzazar",           nameUr: "سبزہ زار",       lat: 31.5250, lng: 74.2560, weight: 3 },
  { name: "Valencia Town",      nameUr: "ویلنشیا",       lat: 31.4180, lng: 74.2320, weight: 2 },
  { name: "Bahria Town",        nameUr: "بحریہ ٹاؤن",     lat: 31.3670, lng: 74.1830, weight: 2 },
  { name: "Askari X",           nameUr: "عسکری",         lat: 31.5210, lng: 74.4130, weight: 2 },
];

/** Nearest known neighbourhood to a coordinate. Stands in for a
    reverse-geocoding API we are not paying for during a hackathon. */
export function nearestNeighbourhood(lat: number, lng: number): Neighbourhood {
  let best = NEIGHBOURHOODS[0];
  let bestD = Number.POSITIVE_INFINITY;
  for (const n of NEIGHBOURHOODS) {
    const d = (n.lat - lat) ** 2 + (n.lng - lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

/** Human address line: "Street 12, Gulberg III, Lahore". */
export function describeLocation(lat: number, lng: number, street?: string): string {
  const n = nearestNeighbourhood(lat, lng);
  return [street, n.name, "Lahore"].filter(Boolean).join(", ");
}

/** Deterministic jitter so seeded complaints scatter within a
    neighbourhood instead of stacking on one pin. */
export function jitter(base: number, seed: number, spread = 0.012): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return base + (x - Math.floor(x) - 0.5) * 2 * spread;
}
