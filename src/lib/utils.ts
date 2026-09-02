import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** AWZ-LHR-2609-0043 — city code, year+month, zero-padded sequence.
    Looks like a real records system because it behaves like one. */
export function formatTrackingId(
  sequence: number,
  cityCode = "LHR",
  at: Date = new Date(),
): string {
  const yy = String(at.getFullYear()).slice(-2);
  const mm = String(at.getMonth() + 1).padStart(2, "0");
  return `AWZ-${cityCode}-${yy}${mm}-${String(sequence).padStart(4, "0")}`;
}

/** Compact relative time for the ops console: 4m, 3h, 2d. */
export function shortAgo(iso: string, now: Date = new Date()): string {
  const diff = Math.max(0, now.getTime() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

/** How much of the SLA window is spent. >1 means overdue. */
export function slaProgress(createdAt: string, dueAt: string, now = new Date()): number {
  const start = new Date(createdAt).getTime();
  const end = new Date(dueAt).getTime();
  if (end <= start) return 1;
  return (now.getTime() - start) / (end - start);
}

/** Time left before breach, as a terse console string: "4h 12m" / "OVERDUE 2h". */
export function slaCountdown(dueAt: string, now = new Date()): string {
  const diff = new Date(dueAt).getTime() - now.getTime();
  const overdue = diff < 0;
  const abs = Math.abs(diff);
  const hrs = Math.floor(abs / 3600000);
  const mins = Math.floor((abs % 3600000) / 60000);
  const body = hrs >= 24 ? `${Math.floor(hrs / 24)}d ${hrs % 24}h` : `${hrs}h ${mins}m`;
  return overdue ? `OVERDUE ${body}` : body;
}

/** Metres between two coordinates. Used by the duplicate-detection pass. */
export function distanceMetres(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
