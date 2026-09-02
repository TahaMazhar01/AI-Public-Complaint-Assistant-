"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Camera,
  Loader2,
  MapPin,
  Mic,
  Square,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { NEIGHBOURHOODS, nearestNeighbourhood } from "@/lib/geo";
import type { StageEvent } from "@/lib/pipeline";
import type { Complaint, IntakeMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import ComplaintResult from "./ComplaintResult";
import PipelineView from "./PipelineView";

/* ============================================================
   INTAKE
   One box. Speak, type, photograph, or all three. Everything the
   citizen has to decide is optional — the system does the rest.
   ============================================================ */

const EXAMPLES = [
  {
    label: "Roman Urdu · voice",
    text: "Gulberg mein sewerage ka pani teen din se sarak pe khara hai, bohat badbo hai aur bachay wahin khelte hain. Koi sunwai nahi ho rahi.",
  },
  {
    label: "English",
    text: "The transformer outside our lane is sparking and a cable is hanging low over the footpath children use for school.",
  },
  {
    label: "Urdu",
    text: "پوری گلی کی اسٹریٹ لائٹس دو ہفتے سے بند ہیں، رات کو باہر نکلنا خطرناک ہو گیا ہے۔",
  },
];

type Phase = "idle" | "running" | "done" | "error";

export default function IntakeConsole() {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [events, setEvents] = useState<StageEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState<"ur-PK" | "en-US">("ur-PK");
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const committedRef = useRef("");
  const fileRef = useRef<HTMLInputElement>(null);

  const hood = coords ? nearestNeighbourhood(coords.lat, coords.lng) : null;

  /* ── voice ───────────────────────────────────────────────── */
  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      setVoiceError("This browser cannot capture speech. Chrome or Edge works.");
      return;
    }
    setVoiceError(null);
    committedRef.current = text ? text.trimEnd() + " " : "";

    const rec = new Ctor();
    rec.lang = voiceLang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) committedRef.current += chunk + " ";
        else interim += chunk;
      }
      setText((committedRef.current + interim).replace(/\s+/g, " ").trimStart());
    };
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      setVoiceError(
        e.error === "not-allowed"
          ? "Microphone permission was refused."
          : `Speech capture stopped (${e.error}).`,
      );
      setListening(false);
    };
    rec.onend = () => setListening(false);

    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }, [text, voiceLang]);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  /* ── location ────────────────────────────────────────────── */
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

  /* ── photos ──────────────────────────────────────────────── */
  const onPhotos = (files: FileList | null) => {
    if (!files) return;
    Array.from(files)
      .slice(0, 3)
      .forEach((f) => {
        const reader = new FileReader();
        reader.onload = () =>
          setPhotos((p) => [...p, reader.result as string].slice(0, 3));
        reader.readAsDataURL(f);
      });
  };

  /* ── submit ──────────────────────────────────────────────── */
  const submit = async () => {
    if (text.trim().length < 8 || phase === "running") return;
    stopListening();
    setPhase("running");
    setEvents([]);
    setError(null);

    const mode: IntakeMode = listening || committedRef.current ? "voice" : photos.length ? "photo" : "text";

    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          intakeMode: mode,
          photoCount: photos.length,
        }),
      });

      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "The intake service did not respond.");
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
    setError(null);
    committedRef.current = "";
  };

  const filed = events.find((e) => e.stage === "filed");
  const dedupe = events.find((e) => e.stage === "deduped");
  const received = events.find((e) => e.stage === "received");
  const complaint = filed?.complaint as Complaint | undefined;

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {/* ══ FORM ══════════════════════════════════════════ */}
        {phase === "idle" || phase === "error" ? (
          <motion.div
            key="form"
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="border-rule bg-paper-raised border"
          >
            <div className="rule-b flex items-center justify-between px-4 py-2.5">
              <span className="type-eyebrow text-ink-faint">New report</span>
              <span className="type-meta text-ink-faint">01 / INTAKE</span>
            </div>

            <div className="p-4 sm:p-5">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                placeholder="Describe the problem the way you would to a neighbour — Urdu, English, or both."
                className="type-body placeholder:text-ink-faint/70 w-full resize-none bg-transparent outline-none"
              />

              {listening && (
                <div className="type-meta text-signal mt-1 flex items-center gap-2">
                  <span className="pulse-dot block size-1.5 rounded-full bg-current" />
                  Listening in {voiceLang === "ur-PK" ? "Urdu" : "English"}…
                </div>
              )}
              {voiceError && (
                <p className="type-meta text-p2 mt-1">{voiceError}</p>
              )}

              {/* photo thumbnails */}
              {photos.length > 0 && (
                <ul className="mt-3 flex gap-2">
                  {photos.map((src, i) => (
                    <li key={i} className="border-rule relative size-16 border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="size-full object-cover" />
                      <button
                        onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                        className="bg-ink text-paper absolute -top-2 -right-2 grid size-4 place-items-center"
                      >
                        <X className="size-2.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* examples — also the demo's safety rail */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="type-eyebrow text-ink-faint">Try</span>
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.label}
                    onClick={() => setText(ex.text)}
                    className="type-eyebrow border-rule text-ink-muted hover:border-ink hover:text-ink border px-2 py-1 transition-colors"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>

              {/* controls */}
              <div className="rule-t mt-4 flex flex-wrap items-center gap-2 pt-4">
                <button
                  onClick={listening ? stopListening : startListening}
                  className={cn(
                    "inline-flex items-center gap-2 border px-3 py-2 transition-colors",
                    listening
                      ? "border-signal bg-signal text-paper"
                      : "border-rule text-ink-muted hover:border-ink hover:text-ink",
                  )}
                >
                  {listening ? <Square className="size-3.5" /> : <Mic className="size-3.5" />}
                  <span className="type-eyebrow">{listening ? "Stop" : "Speak"}</span>
                </button>

                <button
                  onClick={() => setVoiceLang((l) => (l === "ur-PK" ? "en-US" : "ur-PK"))}
                  className="type-eyebrow border-rule text-ink-faint hover:border-ink hover:text-ink border px-2 py-2 transition-colors"
                  title="Speech recognition language"
                >
                  {voiceLang === "ur-PK" ? "اردو" : "EN"}
                </button>

                <button
                  onClick={() => fileRef.current?.click()}
                  className="border-rule text-ink-muted hover:border-ink hover:text-ink inline-flex items-center gap-2 border px-3 py-2 transition-colors"
                >
                  <Camera className="size-3.5" />
                  <span className="type-eyebrow">Photo</span>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => onPhotos(e.target.files)}
                />

                <button
                  onClick={locate}
                  className={cn(
                    "inline-flex items-center gap-2 border px-3 py-2 transition-colors",
                    hood
                      ? "border-ink text-ink"
                      : "border-rule text-ink-muted hover:border-ink hover:text-ink",
                  )}
                >
                  {locating ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <MapPin className="size-3.5" />
                  )}
                  <span className="type-eyebrow">{hood ? hood.name : "Locate me"}</span>
                </button>

                <button
                  onClick={submit}
                  disabled={text.trim().length < 8}
                  className="bg-ink text-paper hover:bg-signal ml-auto inline-flex items-center gap-2 px-4 py-2 transition-colors disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <span className="type-eyebrow">File complaint</span>
                  <ArrowRight className="size-3.5" />
                </button>
              </div>

              {/* manual area fallback when geolocation is refused */}
              {!hood && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="type-eyebrow text-ink-faint">or pick an area</span>
                  <select
                    onChange={(e) => {
                      const n = NEIGHBOURHOODS.find((x) => x.name === e.target.value);
                      if (n) setCoords({ lat: n.lat, lng: n.lng });
                    }}
                    defaultValue=""
                    className="type-meta border-rule text-ink-muted border bg-transparent px-2 py-1 outline-none"
                  >
                    <option value="" disabled>
                      Select…
                    </option>
                    {NEIGHBOURHOODS.map((n) => (
                      <option key={n.name} value={n.name}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {error && <p className="type-meta text-p1 mt-3">{error}</p>}
            </div>

            <div className="rule-t bg-paper-sunk px-4 py-2.5">
              <p className="type-meta text-ink-faint">
                No account required · Location is optional but improves routing
              </p>
            </div>
          </motion.div>
        ) : null}

        {/* ══ PIPELINE ══════════════════════════════════════ */}
        {phase === "running" && (
          <motion.div
            key="pipeline"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <PipelineView events={events} engine={received?.engine ?? null} />
          </motion.div>
        )}

        {/* ══ RESULT ════════════════════════════════════════ */}
        {phase === "done" && complaint && (
          <motion.div key="result">
            <ComplaintResult
              complaint={complaint}
              matches={dedupe?.matches ?? 0}
              escalated={Boolean(dedupe?.escalated)}
              onReset={reset}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
