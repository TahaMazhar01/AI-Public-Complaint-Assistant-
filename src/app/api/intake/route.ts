import { NextRequest } from "next/server";
import { analyzeComplaint } from "@/lib/ai/analyze";
import { providerLabel } from "@/lib/ai/provider";
import { composeFormalText } from "@/lib/formal";
import { nearestNeighbourhood } from "@/lib/geo";
import {
  CATEGORIES,
  DEPARTMENTS,
  resolveSlaHours,
  routeToDepartment,
} from "@/lib/taxonomy";
import { findDuplicates, insertComplaint, nextSequence } from "@/lib/store";
import type { Complaint, ComplaintEvent, IntakeMode } from "@/lib/types";
import { formatTrackingId } from "@/lib/utils";

export const runtime = "nodejs";

/* ============================================================
   INTAKE PIPELINE — STREAMED
   Each stage emits the instant it actually finishes. The
   animation the citizen watches is therefore a real progress
   report, not a decorative spinner on a timer.
   ============================================================ */

type Stage =
  | "received"
  | "understanding"
  | "classified"
  | "routed"
  | "deduped"
  | "drafted"
  | "filed"
  | "error";

interface Payload {
  text: string;
  lat?: number | null;
  lng?: number | null;
  intakeMode?: IntakeMode;
  photoCount?: number;
  citizenName?: string | null;
  citizenPhone?: string | null;
}

/** Floor each stage so the sequence stays legible to a human eye.
    A pipeline that finishes in 40ms reads as "nothing happened". */
const MIN_STAGE_MS = 420;

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Payload;
  const text = (body.text ?? "").trim();

  if (text.length < 8) {
    return Response.json(
      { error: "Please describe the problem in a little more detail." },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const t0 = Date.now();
      let lastEmit = t0;

      const emit = async (stage: Stage, data: Record<string, unknown> = {}) => {
        const elapsed = Date.now() - lastEmit;
        if (elapsed < MIN_STAGE_MS) {
          await sleep(MIN_STAGE_MS - elapsed);
        }
        lastEmit = Date.now();
        controller.enqueue(
          encoder.encode(
            JSON.stringify({ stage, at: Date.now() - t0, ...data }) + "\n",
          ),
        );
      };

      try {
        /* 1 — RECEIVED ------------------------------------------------ */
        const hood =
          body.lat != null && body.lng != null
            ? nearestNeighbourhood(body.lat, body.lng)
            : null;

        await emit("received", {
          chars: text.length,
          mode: body.intakeMode ?? "text",
          neighbourhood: hood?.name ?? null,
          engine: providerLabel(),
        });

        /* 2 — UNDERSTANDING (the one model call) ----------------------- */
        const { analysis, source, ms } = await analyzeComplaint({
          text,
          neighbourhood: hood?.name ?? null,
          hasPhoto: (body.photoCount ?? 0) > 0,
        });

        await emit("understanding", {
          language: analysis.detected_language,
          source,
          ms,
          confidence: analysis.confidence,
        });

        /* 3 — CLASSIFIED ---------------------------------------------- */
        const category = CATEGORIES[analysis.category];
        await emit("classified", {
          category: analysis.category,
          categoryLabel: category.label,
          categoryLabelUr: category.labelUr,
          priority: analysis.priority,
          priorityReason: analysis.priority_reason,
          hazards: analysis.hazard_flags,
        });

        /* 4 — ROUTED (deterministic, not the model's decision) --------- */
        const departmentId = routeToDepartment(analysis.category);
        const department = DEPARTMENTS[departmentId];
        const slaHours = resolveSlaHours(analysis.category, analysis.priority);

        await emit("routed", {
          departmentId,
          departmentName: department.name,
          departmentShort: department.shortName,
          slaHours,
        });

        /* 5 — DEDUPED -------------------------------------------------- */
        const duplicates = await findDuplicates({
          category: analysis.category,
          lat: body.lat ?? null,
          lng: body.lng ?? null,
          text,
        });

        // Enough corroboration turns a routine fault into a cluster
        // that deserves a harder deadline.
        const escalated = duplicates.length >= 3 && analysis.priority !== "P1";
        const finalPriority = escalated
          ? stepUp(analysis.priority)
          : analysis.priority;
        const finalSla = escalated
          ? resolveSlaHours(analysis.category, finalPriority)
          : slaHours;

        await emit("deduped", {
          matches: duplicates.length,
          nearest: duplicates[0] ?? null,
          escalated,
          finalPriority,
          finalSla,
        });

        /* 6 — DRAFTED -------------------------------------------------- */
        const sequence = nextSequence();
        const now = new Date();
        const trackingId = formatTrackingId(sequence, "LHR", now);

        const formalText = composeFormalText({
          trackingId,
          category: analysis.category,
          departmentId,
          priority: finalPriority,
          summary: analysis.summary,
          addressText: hood ? `${hood.name}, Lahore` : null,
          neighbourhood: hood?.name ?? null,
          hazards: analysis.hazard_flags,
          slaHours: finalSla,
          citizenName: body.citizenName,
          filedAt: now,
        });

        await emit("drafted", { trackingId, words: formalText.split(/\s+/).length });

        /* 7 — FILED ---------------------------------------------------- */
        const complaint: Complaint = {
          id: `c-${sequence}`,
          tracking_id: trackingId,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
          raw_text: text,
          intake_mode: body.intakeMode ?? "text",
          detected_language: analysis.detected_language,
          audio_url: null,
          photo_urls: [],
          lat: body.lat ?? null,
          lng: body.lng ?? null,
          address_text: hood ? `${hood.name}, Lahore` : null,
          neighbourhood: hood?.name ?? null,
          city: "Lahore",
          title: analysis.title,
          summary: analysis.summary,
          category: analysis.category,
          department_id: departmentId,
          priority: finalPriority,
          priority_reason: analysis.priority_reason,
          hazard_flags: analysis.hazard_flags,
          formal_text: formalText,
          confidence: analysis.confidence,
          status: "routed",
          sla_hours: finalSla,
          due_at: new Date(now.getTime() + finalSla * 3600_000).toISOString(),
          resolved_at: null,
          assigned_officer: null,
          cluster_id: duplicates.length ? duplicates[0].complaint_id : null,
          is_cluster_parent: duplicates.length === 0,
          duplicate_count: duplicates.length,
          citizen_name: body.citizenName ?? null,
          citizen_phone: body.citizenPhone ?? null,
        };

        const timeline: ComplaintEvent[] = [
          ev(complaint.id, 0, "received", "citizen", `Report received via ${complaint.intake_mode}.`),
          ev(complaint.id, 1, "analysed", "awaaz_ai", `${analysis.title}. ${analysis.priority_reason}`),
          ev(complaint.id, 2, "routed", "awaaz_ai", `Routed to ${department.shortName} with a ${finalSla}-hour service deadline.`),
        ];
        if (duplicates.length) {
          timeline.push(
            ev(
              complaint.id,
              3,
              "merged",
              "awaaz_ai",
              `${duplicates.length} nearby report${duplicates.length > 1 ? "s" : ""} matched this issue.`,
            ),
          );
        }
        if (escalated) {
          timeline.push(
            ev(complaint.id, 4, "escalated", "awaaz_ai", `Priority raised to ${finalPriority} on corroborating reports.`),
          );
        }

        await insertComplaint(complaint, timeline);
        await emit("filed", { complaint });

        controller.close();
      } catch (err) {
        console.error("[awaaz] intake failed:", err);
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              stage: "error",
              message: "Something broke while filing. Please try again.",
            }) + "\n",
          ),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

function ev(
  complaintId: string,
  i: number,
  kind: ComplaintEvent["kind"],
  actor: ComplaintEvent["actor"],
  message: string,
): ComplaintEvent {
  return {
    id: `${complaintId}-ev-${i}`,
    complaint_id: complaintId,
    created_at: new Date(Date.now() + i * 40).toISOString(),
    kind,
    actor,
    message,
    meta: null,
  };
}

function stepUp(p: "P1" | "P2" | "P3" | "P4") {
  return p === "P4" ? "P3" : p === "P3" ? "P2" : "P1";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
