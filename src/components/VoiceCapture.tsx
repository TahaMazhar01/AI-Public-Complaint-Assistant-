"use client";

import { Check, Mic, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "./ui";
import { cn } from "@/lib/utils";

/* ============================================================
   VOICE
   Built for someone who would rather talk than type, and who has
   never used a speech interface before. Three things they need
   to be certain of, at all times:
     1. Is it listening?          → the ring pulses
     2. Can it hear ME?           → the bars move with my voice
     3. Did it get my words?      → the transcript appears live
   A spinner would answer none of those.
   ============================================================ */

const BAR_COUNT = 7;

export default function VoiceCapture({
  value,
  onChange,
  lang,
  onLangChange,
  onDone,
}: {
  value: string;
  onChange: (text: string) => void;
  lang: "ur-PK" | "en-US";
  onLangChange: (l: "ur-PK" | "en-US") => void;
  onDone: () => void;
}) {
  const [listening, setListening] = useState(false);
  const [levels, setLevels] = useState<number[]>(Array(BAR_COUNT).fill(0.08));
  const [error, setError] = useState<string | null>(null);
  const [heardSomething, setHeardSomething] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const committedRef = useRef("");

  /* ---- teardown ------------------------------------------- */
  const teardown = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setLevels(Array(BAR_COUNT).fill(0.08));
    setListening(false);
  }, []);

  useEffect(() => teardown, [teardown]);

  /* ---- level meter ---------------------------------------- */
  const startMeter = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);

      const bins = new Uint8Array(analyser.frequencyBinCount);
      // Speech energy sits low in the spectrum; sample the bands that
      // actually move when a person talks rather than the whole range.
      const slice = Math.floor(analyser.frequencyBinCount / (BAR_COUNT * 2.4));

      const tick = () => {
        analyser.getByteFrequencyData(bins);
        const next: number[] = [];
        for (let i = 0; i < BAR_COUNT; i++) {
          let sum = 0;
          for (let j = 0; j < slice; j++) sum += bins[i * slice + j] ?? 0;
          const avg = sum / slice / 255;
          next.push(Math.max(0.08, Math.min(1, avg * 2.4)));
        }
        setLevels(next);
        if (next.some((n) => n > 0.3)) setHeardSomething(true);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // No meter is survivable; no transcript is not. Carry on.
    }
  }, []);

  /* ---- speech --------------------------------------------- */
  const start = useCallback(async () => {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      setError("This browser can't listen. Please use Chrome, or write instead.");
      return;
    }
    setError(null);
    setHeardSomething(false);
    committedRef.current = value ? value.trimEnd() + " " : "";

    await startMeter();

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) committedRef.current += chunk + " ";
        else interim += chunk;
      }
      onChange((committedRef.current + interim).replace(/\s+/g, " ").trimStart());
    };
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      setError(
        e.error === "not-allowed"
          ? "We need microphone permission. Allow it, or write instead."
          : e.error === "no-speech"
            ? "We didn't catch anything. Try again, a little closer."
            : "Listening stopped. Tap the microphone to try again.",
      );
      teardown();
    };
    rec.onend = () => teardown();

    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }, [lang, onChange, startMeter, teardown, value]);

  const hasWords = value.trim().length > 0;

  return (
    <div className="flex flex-col items-center px-5 py-9 text-center sm:px-8 sm:py-12">
      {/* language — chosen before speaking, never buried */}
      <div className="border-rule mb-9 inline-flex border p-1">
        {(
          [
            { id: "ur-PK" as const, en: "Urdu", ur: "اردو" },
            { id: "en-US" as const, en: "English", ur: "انگریزی" },
          ]
        ).map((l) => (
          <button
            key={l.id}
            onClick={() => !listening && onLangChange(l.id)}
            disabled={listening}
            className={cn(
              "flex items-center gap-2 px-4 py-2 transition-colors disabled:cursor-not-allowed",
              lang === l.id ? "bg-ink text-paper" : "text-ink-muted hover:text-ink",
            )}
          >
            <span className="type-action">{l.en}</span>
            <span className="type-urdu-inline text-[0.9rem] opacity-70">{l.ur}</span>
          </button>
        ))}
      </div>

      {/* the microphone */}
      <button
        onClick={listening ? teardown : start}
        className="relative grid size-32 place-items-center rounded-full transition-transform active:scale-95 sm:size-36"
        aria-label={listening ? "Stop listening" : "Start speaking"}
      >
        {listening && (
          <>
            <span
              className="border-signal absolute inset-0 rounded-full border"
              style={{ animation: "civic-ring 2s var(--ease-out-civic) infinite" }}
            />
            <span
              className="border-signal absolute inset-0 rounded-full border"
              style={{ animation: "civic-ring 2s var(--ease-out-civic) 0.66s infinite" }}
            />
          </>
        )}
        <span
          className={cn(
            "grid size-full place-items-center rounded-full border transition-colors",
            listening ? "border-signal bg-signal text-paper" : "border-ink bg-ink text-paper",
          )}
        >
          <Mic className="size-11 sm:size-12" strokeWidth={1.4} />
        </span>
      </button>

      {/* level meter — proof the microphone hears them */}
      <div className="mt-7 flex h-9 items-end justify-center gap-1.5">
        {levels.map((v, i) => (
          <span
            key={i}
            className={cn(
              "mic-bar w-1.5 rounded-full",
              listening ? "bg-signal" : "bg-rule-strong",
            )}
            style={{ height: `${Math.round(v * 36)}px` }}
          />
        ))}
      </div>

      {/* what is happening, in both languages */}
      <div className="mt-5">
        {listening ? (
          <>
            <p className="type-action-lg text-signal">
              {heardSomething ? "We can hear you — keep going" : "Listening… start speaking"}
            </p>
            <p className="type-urdu text-ink-muted mt-1 text-[1rem]">
              {heardSomething ? "ہم سن رہے ہیں، بولتے رہیے" : "سن رہے ہیں، بولنا شروع کریں"}
            </p>
          </>
        ) : (
          <>
            <p className="type-action-lg">Tap the microphone and just talk</p>
            <p className="type-urdu text-ink-muted mt-1 text-[1rem]">
              مائیک دبائیں اور بولیں
            </p>
          </>
        )}
      </div>

      {/* live transcript */}
      {hasWords && (
        <div className="border-rule bg-paper-sunk mt-8 w-full border p-4 text-left sm:p-5">
          <p className="type-eyebrow text-ink-faint mb-2.5">What we heard</p>
          <p
            className={cn(
              lang === "ur-PK" && /[؀-ۿ]/.test(value)
                ? "type-urdu text-[1.05rem]"
                : "type-lead text-ink",
            )}
          >
            {value}
          </p>
        </div>
      )}

      {error && (
        <p className="type-body text-p2 mt-5 max-w-[34ch]">{error}</p>
      )}

      {/* onward */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {listening ? (
          <Button variant="outline" size="lg" urdu="روکیں" onClick={teardown}>
            <Square className="mr-2 size-4" />
            Stop
          </Button>
        ) : (
          hasWords && (
            <Button size="lg" urdu="ٹھیک ہے" onClick={onDone}>
              <Check className="mr-2 size-4" />
              That&apos;s right
            </Button>
          )
        )}
      </div>

      {hasWords && !listening && (
        <button
          onClick={() => onChange("")}
          className="type-body text-ink-faint hover:text-ink mt-4 underline underline-offset-4 transition-colors"
        >
          Clear and say it again
        </button>
      )}
    </div>
  );
}
