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
import { fmt, type Locale } from "@/lib/i18n";
import type { StageEvent } from "@/lib/pipeline";
import type { Complaint, IntakeMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import ComplaintResult from "./ComplaintResult";
import { useI18n } from "./LocaleProvider";
import PipelineView from "./PipelineView";
import VoiceCapture from "./VoiceCapture";
import { Button } from "./ui";

/* ============================================================
   INTAKE
   The first decision a citizen makes is "do I talk or do I type?"
   so that is the first thing on screen — two doors, equal size.
   Everything else is optional and clearly marked as such.
   ============================================================ */

/* Sample reports in the reader's own language. Nothing here is
   translated from English — each is how a person would actually
   phrase it in that language. */
const EXAMPLES: Record<Locale, { key: "exSewerage" | "exElectricity" | "exStreetLights"; text: string }[]> = {
  en: [
    {
      key: "exSewerage",
      text: "Sewage has been standing on our street for three days. The smell is unbearable and children still play in it.",
    },
    {
      key: "exElectricity",
      text: "The transformer outside our lane is sparking and a cable is hanging low over the footpath children use for school.",
    },
    {
      key: "exStreetLights",
      text: "None of the street lights on our block have worked for two weeks. It is completely dark and unsafe at night.",
    },
  ],
  ur: [
    {
      key: "exSewerage",
      text: "ہماری گلی میں تین دن سے سیوریج کا پانی کھڑا ہے۔ بدبو ناقابلِ برداشت ہے اور بچے وہیں کھیلتے رہتے ہیں۔",
    },
    {
      key: "exElectricity",
      text: "ہماری گلی کے باہر ٹرانسفارمر سے چنگاریاں نکل رہی ہیں اور ایک تار نیچے لٹک رہی ہے، جہاں سے بچے اسکول جاتے ہیں۔",
    },
    {
      key: "exStreetLights",
      text: "ہمارے بلاک کی تمام اسٹریٹ لائٹس دو ہفتے سے بند ہیں۔ رات کو مکمل اندھیرا اور خطرہ رہتا ہے۔",
    },
  ],
  zh: [
    {
      key: "exSewerage",
      text: "我们这条街的污水已经积了三天，气味难以忍受，孩子们还在里面玩。",
    },
    {
      key: "exElectricity",
      text: "巷口的变压器一直在冒火花，还有一根电缆低垂在孩子们上学要走的人行道上方。",
    },
    {
      key: "exStreetLights",
      text: "我们这一片的路灯已经两周都不亮了，晚上一片漆黑，很不安全。",
    },
  ],
};

type Mode = "voice" | "write";
type Phase = "idle" | "running" | "done" | "error";

export default function IntakeConsole() {
  const { t, locale } = useI18n();
  const [mode, setMode] = useState<Mode | null>(null);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [events, setEvents] = useState<StageEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

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
          locale,
        }),
      });

      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? t.intake.failed);
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
            setError(evt.message ?? t.intake.generic);
            setPhase("error");
            return;
          }
          setEvents((prev) => [...prev, evt]);
          if (evt.stage === "filed") setPhase("done");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.intake.generic);
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

  const textIsUrdu = /[؀-ۿ]/.test(text);

  return (
    <div className="border-rule bg-paper-raised w-full border">
      {/* ── panel header ── */}
      <div className="rule-b flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-3">
          {mode && (
            <button
              onClick={() => setMode(null)}
              className="text-ink-faint hover:text-ink -ms-1 p-1 transition-colors"
              aria-label={t.common.back}
            >
              <ArrowLeft className="size-4 rtl:rotate-180" />
            </button>
          )}
          <p className="type-action">{t.intake.panelTitle}</p>
        </div>
        <span className="type-meta text-ink-faint shrink-0">
          {fmt(t.intake.step, { n: mode ? 2 : 1 })}
        </span>
      </div>

      {/* ══ DOOR 1: how do you want to report? ══════════════ */}
      {!mode && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="p-4 sm:p-5"
        >
          <p className="type-lead text-center">{t.intake.question}</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => setMode("voice")}
              className="border-rule-strong hover:border-ink hover:bg-paper-sunk group flex flex-col items-center gap-4 border p-7 transition-colors sm:p-8"
            >
              <span className="bg-ink text-paper group-hover:bg-signal grid size-16 place-items-center rounded-full transition-colors">
                <Mic className="size-7" strokeWidth={1.5} />
              </span>
              <span className="type-action-lg">{t.intake.speak}</span>
              <span className="type-body text-ink-muted text-center leading-snug">
                {t.intake.speakDesc}
              </span>
            </button>

            <button
              onClick={() => setMode("write")}
              className="border-rule-strong hover:border-ink hover:bg-paper-sunk group flex flex-col items-center gap-4 border p-7 transition-colors sm:p-8"
            >
              <span className="border-ink text-ink group-hover:bg-ink group-hover:text-paper grid size-16 place-items-center rounded-full border transition-colors">
                <PenLine className="size-7" strokeWidth={1.5} />
              </span>
              <span className="type-action-lg">{t.intake.write}</span>
              <span className="type-body text-ink-muted text-center leading-snug">
                {t.intake.writeDesc}
              </span>
            </button>
          </div>

          <p className="type-meta text-ink-faint mt-6 text-center">
            {t.intake.noAccount}
          </p>
        </motion.div>
      )}

      {/* ══ DOOR 2A: speaking ═══════════════════════════════ */}
      {mode === "voice" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
          <VoiceCapture value={text} onChange={setText} onDone={() => setMode("write")} />
        </motion.div>
      )}

      {/* ══ DOOR 2B: writing, and the review step after voice ══ */}
      {mode === "write" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="p-4 sm:p-5"
        >
          <label className="block">
            <span className="type-action">{t.intake.problemLabel}</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              autoFocus
              placeholder={t.intake.placeholder}
              dir={textIsUrdu ? "rtl" : undefined}
              className={cn(
                "type-body border-rule focus:border-ink placeholder:text-ink-faint/70 mt-3 w-full resize-none border bg-transparent p-3.5 outline-none transition-colors",
              )}
              style={
                textIsUrdu && locale !== "ur"
                  ? { fontFamily: "var(--font-nastaliq)", lineHeight: 2.1 }
                  : undefined
              }
            />
          </label>

          {/* examples */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="type-meta text-ink-faint">{t.intake.tryExample}</span>
            {EXAMPLES[locale].map((ex) => (
              <button
                key={ex.key}
                onClick={() => setText(ex.text)}
                className="type-body border-rule text-ink-muted hover:border-ink hover:text-ink border px-2.5 py-1.5 text-[0.8rem] transition-colors"
              >
                {t.intake[ex.key]}
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
                    className="bg-ink text-paper absolute -top-2 -end-2 grid size-5 place-items-center"
                    aria-label={t.common.remove}
                  >
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* optional extras — clearly marked optional */}
          <div className="rule-t mt-5 pt-5">
            <p className="type-meta text-ink-faint mb-3">{t.intake.optionalHint}</p>

            <div className="flex flex-wrap gap-2.5">
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <Camera className="me-2 size-4" />
                {t.intake.addPhoto}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => onPhotos(e.target.files)}
              />

              <Button variant={hood ? "primary" : "outline"} onClick={locate}>
                {locating ? (
                  <Loader2 className="me-2 size-4 animate-spin" />
                ) : hood ? (
                  <Check className="me-2 size-4" />
                ) : (
                  <MapPin className="me-2 size-4" />
                )}
                {hood ? hood.name : t.intake.useLocation}
              </Button>
            </div>

            {!hood && (
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                <span className="type-body text-ink-faint">{t.intake.orChooseArea}</span>
                <select
                  onChange={(e) => {
                    const n = NEIGHBOURHOODS.find((x) => x.name === e.target.value);
                    if (n) setCoords({ lat: n.lat, lng: n.lng });
                  }}
                  defaultValue=""
                  className="type-body border-rule focus:border-ink h-11 border bg-transparent px-3 outline-none transition-colors"
                >
                  <option value="" disabled>
                    {t.intake.selectArea}
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
            <Button size="xl" onClick={submit} disabled={!ready} className="w-full sm:w-auto">
              {t.intake.send}
              <ArrowRight className="ms-1 size-4 rtl:rotate-180" />
            </Button>
            {!ready && <p className="type-body text-ink-faint">{t.intake.tellMore}</p>}
          </div>
        </motion.div>
      )}
    </div>
  );
}
