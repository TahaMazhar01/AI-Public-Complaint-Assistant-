"use server";

import { revalidatePath } from "next/cache";
import { getComplaint, updateStatus } from "@/lib/store";
import type { ComplaintStatus } from "@/lib/types";

const NOTES: Record<ComplaintStatus, string> = {
  submitted: "Returned to intake.",
  routed: "Reassigned to the department queue.",
  acknowledged: "Complaint acknowledged by the department.",
  in_progress: "Field team dispatched to site.",
  resolved: "Work completed and site verified.",
  rejected: "Closed — outside this department's remit.",
};

export async function changeStatus(complaintId: string, status: ComplaintStatus) {
  const updated = await updateStatus(complaintId, status, NOTES[status]);
  if (!updated) return { ok: false as const };

  // Both surfaces show this case, and the landing counters read from it.
  revalidatePath("/console");
  revalidatePath(`/console/${updated.tracking_id}`);
  revalidatePath(`/track/${updated.tracking_id}`);
  revalidatePath("/track");
  revalidatePath("/");
  revalidatePath("/map");

  return { ok: true as const, status: updated.status };
}

export async function lookupByTracking(trackingId: string) {
  const c = await getComplaint(trackingId);
  return c ? { id: c.id, tracking_id: c.tracking_id } : null;
}
