"use client";

import { motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Loader2,
  MapPin,
  Mic,
  PenLine,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { NEIGHBOURHOODS, nearestNeighbourhood } from "@/lib/geo";
import type { StageEvent } from "@/lib/pipeline";
import type { Complaint, IntakeMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import ComplaintResult from "./ComplaintResult";
import PipelineView from "./PipelineView";
import VoiceCapture from "./VoiceCapture";
import { BiLabel, Button } from "./ui";

/* ============================================================
   INTAKE
   The first decision a citizen makes is "do I talk or do I type?"
   so that is the first thing on screen — two doors, equal size,
   both labelled in Urdu and English. Everything else is optional
   and clearly marked as such.
   ============================================================ */

const EXAMPLES = [
  {
    label: "Sewerage",
    ur: "سیوریج",
    text: "Gulberg mein sewerage ka pani teen din se sarak pe khara hai, bohat badbo hai aur bachay wahin khelte hain. Koi sunwai nahi ho rahi.",
  },
  {
    label: "Electricity",
    ur: "بجلی",
    text: "The transformer outside our lane is sparking and a cable is hanging low over the footpath children use for school.",
  },
  {
    label: "Street lights",
    ur: "اسٹریٹ لائٹ",
    text: "پوری گلی کی اسٹریٹ لائٹس دو ہفتے سے بند ہیں، رات کو باہر نکلنا خطرناک ہو گیا ہے۔",
  },
];

type Mode = "voice" | "write";
type Phase = "idle" | "running" | "done" | "error";

export default function IntakeConsole() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [events, setEvents] = useState<StageEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [voiceLang, setVoiceLang] = useState<"ur-PK" | "en-US">("ur-PK");

  const fileRef = useRef<HTMLInputElement>(null);
  const hood = coords ? nearestNeighbourhood(coords.lat, coords.lng) : null;
  const ready = text.trim().length >= 8;

  /* ---- location ---- */
  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  /* ---- photos ---- */
  const onPhotos = (files: FileList | null) => {
    if (!files) return;
    Array.from(files)
      .slice(0, 3)
      .forEach((f) => {
        const reader = new FileReader();
        reader.onload = () => setPhotos((p) => [...p, reader.result as string].slice(0, 3));
        reader.readAsDataURL(f);
      });
  };

  /* ---- submit ---- */
  const submit = async () => {
    if (!ready || phase === "running") return;
    setPhase("running");
    setEvents([]);
    setError(null);

    const intakeMode: IntakeMode =
      mode === "voice" ? "voice" : photos.length ? "photo" : "text";

    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          intakeMode,
          photoCount: photos.length,
        }),
      });

      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "We couldn't reach the service. Please try again.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const evt = JSON.parse(line) as StageEvent;
          if (evt.stage === "error") {
            setError(evt.message ?? "Filing failed.");
            setPhase("error");
            return;
          }
          setEvents((prev) => [...prev, evt]);
          if (evt.stage === "filed") setPhase("done");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setPhase("error");
    }
  };

  const reset = () => {
    setText("");
    setEvents([]);
    setPhotos([]);
    setPhase("idle");
    setMode(null);
    setError(null);
  };

  const filed = events.find((e) => e.stage === "filed");
  const dedupe = events.find((e) => e.stage === "deduped");
  const received = events.find((e) => e.stage === "received");
  const complaint = filed?.complaint as Complaint | undefined;

  /* ══════════════════════════════════════════════════════════ */

  if (phase === "running") {
    return <PipelineView events={events} engine={received?.engine ?? null} />;
  }

  if (phase === "done" && complaint) {
    return (
      <ComplaintResult
        complaint={complaint}
        matches={dedupe?.matches ?? 0}
        escalated={Boolean(dedupe?.escalated)}
        onReset={reset}
      />
    );
  }

  return (
    <div className="border-rule bg-paper-raised w-full border">
      {/* ── panel header ── */}
      <div className="rule-b flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-3">
          {mode && (
            <button
              onClick={() => setMode(null)}
              className="text-ink-faint hover:text-ink -ml-1 p-1 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="size-4" />
            </button>
          )}
          <div>
            <p className="type-action">Report a problem</p>
            <p className="type-urdu text-ink-faint text-[0.85rem] leading-tight">
              مسئلہ بتائیں
            </p>
          </div>
        </div>
        <span className="type-meta text-ink-faint shrink-0">
          {mode ? "Step 2 of 2" : "Step 1 of 2"}
        </span>
      </div>

        {/* ══ DOOR 1: how do you want to report? ══════════════ */}
        {!mode && (
          <motion.div
            key="choose"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="p-4 sm:p-5"
          >
            <p className="type-lead text-center">
              How would you like to tell us?
            </p>
            <p className="type-urdu text-ink-faint mt-1 text-center text-[1rem]">
              آپ کیسے بتانا چاہیں گے؟
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {/* SPEAK */}
              <button
                onClick={() => setMode("voice")}
                className="border-rule-strong hover:border-ink hover:bg-paper-sunk group flex flex-col items-center gap-4 border p-7 transition-colors sm:p-8"
              >
                <span className="bg-ink text-paper group-hover:bg-signal grid size-16 place-items-center rounded-full transition-colors">
                  <Mic className="size-7" strokeWidth={1.5} />
                </span>
                <BiLabel en="Speak" ur="بولیں" />
                <span className="type-body text-ink-muted text-center leading-snug">
                  Just talk, the way you would to a neighbour
                </span>
              </button>

              {/* WRITE */}
              <button
                onClick={() => setMode("write")}
                className="border-rule-strong hover:border-ink hover:bg-paper-sunk group flex flex-col items-center gap-4 border p-7 transition-colors sm:p-8"
              >
                <span className="border-ink text-ink group-hover:bg-ink group-hover:text-paper grid size-16 place-items-center rounded-full border transition-colors">
                  <PenLine className="size-7" strokeWidth={1.5} />
                </span>
                <BiLabel en="Write" ur="لکھیں" />
                <span className="type-body text-ink-muted text-center leading-snug">
                  Type it out in Urdu, English, or both
                </span>
              </button>
            </div>

            <p className="type-meta text-ink-faint mt-6 text-center">
              No account needed · Takes about a minute
            </p>
          </motion.div>
        )}

        {/* ══ DOOR 2A: speaking ═══════════════════════════════ */}
        {mode === "voice" && (
          <motion.div
            key="voice"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <VoiceCapture
              value={text}
              onChange={setText}
              lang={voiceLang}
              onLangChange={setVoiceLang}
              onDone={() => setMode("write")}
            />
          </motion.div>
        )}

        {/* ══ DOOR 2B: writing (also the review step after voice) ══ */}
        {mode === "write" && (
          <motion.div
            key="write"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="p-4 sm:p-5"
          >
            <label className="block">
              <span className="type-action">What is the problem?</span>
              <span className="type-urdu text-ink-faint mt-0.5 block text-[0.9rem]">
                مسئلہ کیا ہے؟
              </span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                autoFocus
                placeholder="For example: our street has had no water for three days and the children are getting sick."
                className={cn(
                  "border-rule focus:border-ink placeholder:text-ink-faint/70 mt-3 w-full resize-none border bg-transparent p-3.5 outline-none transition-colors",
                  /[؀-ۿ]/.test(text) ? "type-urdu text-right text-[1.05rem]" : "type-body",
                )}
              />
            </label>

            {/* examples */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="type-meta text-ink-faint">Try an example:</span>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.label}
                  onClick={() => setText(ex.text)}
                  className="border-rule text-ink-muted hover:border-ink hover:text-ink flex items-center gap-1.5 border px-2.5 py-1.5 transition-colors"
                >
                  <span className="type-meta">{ex.label}</span>
                  <span className="type-urdu-inline text-[0.8rem] opacity-60">{ex.ur}</span>
                </button>
              ))}
            </div>

            {/* photos */}
            {photos.length > 0 && (
              <ul className="mt-4 flex gap-2">
                {photos.map((src, i) => (
                  <li key={i} className="border-rule relative size-20 border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="size-full object-cover" />
                    <button
                      onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                      className="bg-ink text-paper absolute -top-2 -right-2 grid size-5 place-items-center"
                      aria-label="Remove photo"
                    >
                      <X className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* optional extras — clearly marked optional */}
            <div className="rule-t mt-5 pt-5">
              <p className="type-meta text-ink-faint mb-3">
                Optional — these help us send it to the right office
              </p>

              <div className="flex flex-wrap gap-2.5">
                <Button
                  variant="outline"
                  urdu="تصویر"
                  onClick={() => fileRef.current?.click()}
                >
                  <Camera className="mr-2 size-4" />
                  Add photo
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => onPhotos(e.target.files)}
                />

                <Button
                  variant={hood ? "primary" : "outline"}
                  urdu={hood ? undefined : "مقام"}
                  onClick={locate}
                >
                  {locating ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : hood ? (
                    <Check className="mr-2 size-4" />
                  ) : (
                    <MapPin className="mr-2 size-4" />
                  )}
                  {hood ? hood.name : "Use my location"}
                </Button>
              </div>

              {!hood && (
                <div className="mt-3 flex flex-wrap items-center gap-2.5">
                  <span className="type-body text-ink-faint">or choose your area</span>
                  <select
                    onChange={(e) => {
                      const n = NEIGHBOURHOODS.find((x) => x.name === e.target.value);
                      if (n) setCoords({ lat: n.lat, lng: n.lng });
                    }}
                    defaultValue=""
                    className="type-body border-rule focus:border-ink h-11 border bg-transparent px-3 outline-none transition-colors"
                  >
                    <option value="" disabled>
                      Select your area…
                    </option>
                    {NEIGHBOURHOODS.map((n) => (
                      <option key={n.name} value={n.name}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {error && <p className="type-body text-p1 mt-4">{error}</p>}

            {/* the one action that matters */}
            <div className="rule-t mt-5 flex flex-col gap-3 pt-5 sm:flex-row sm:items-center">
              <Button
                size="xl"
                urdu="شکایت بھیجیں"
                onClick={submit}
                disabled={!ready}
                className="w-full sm:w-auto"
              >
                Send complaint
                <ArrowRight className="ml-1 size-4" />
              </Button>

              {!ready && (
                <p className="type-body text-ink-faint">
                  Tell us a little more first
                </p>
              )}
            </div>
          </motion.div>
        )}
    </div>
  );
}
