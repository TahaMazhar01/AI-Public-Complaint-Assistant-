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
import {
  attachToCluster,
  findDuplicates,
  insertComplaint,
  nextTrackingId,
} from "@/lib/store";
import type { Complaint, ComplaintEvent, IntakeMode } from "@/lib/types";

export const runtime = "nodejs";

/* The pipeline deliberately paces itself (MIN_STAGE_MS below) and then waits
   on a model call, so a filing takes roughly 5–9 seconds end to end. That is
   comfortably past the 10s default some Vercel plans apply, and a timeout
   here would kill the demo's centrepiece. Ask for the headroom explicitly. */
export const maxDuration = 60;

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
  locale?: "en" | "ur" | "zh";
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
          locale: body.locale ?? "en",
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

        // Joining is a write, not a label: the case being matched has its
        // own corroboration count raised, so the officer queue moves too.
        const joined = duplicates.length
          ? await attachToCluster(duplicates[0].complaint_id)
          : null;

        await emit("deduped", {
          matches: duplicates.length,
          nearest: duplicates[0] ?? null,
          escalated,
          finalPriority,
          finalSla,
        });

        /* 6 — DRAFTED -------------------------------------------------- */
        const now = new Date();
        // Postgres owns the sequence when it is configured, so the id is
        // minted before the row is written and carried through unchanged.
        const trackingId = await nextTrackingId();

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
          id: crypto.randomUUID(), // replaced by the database on insert
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
          cluster_id: joined?.clusterId ?? null,
          is_cluster_parent: joined === null,
          // The corroboration count lives on the parent of the cluster,
          // counted once, rather than on every member of it.
          duplicate_count: 0,
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

        // Emit what was actually stored, not the local draft: the database
        // assigns the real id, and the tracking page is looked up by it.
        const saved = await insertComplaint(complaint, timeline);
        await emit("filed", { complaint: saved });

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
