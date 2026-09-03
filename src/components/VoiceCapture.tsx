"use client";

import { Check, Mic, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "./LocaleProvider";
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

   The recogniser follows the chosen interface language: pick
   اردو and it listens in Urdu, 中文 and it listens in Chinese.
   ============================================================ */

const BAR_COUNT = 7;

export default function VoiceCapture({
  value,
  onChange,
  onDone,
}: {
  value: string;
  onChange: (text: string) => void;
  onDone: () => void;
}) {
  const { t, locale } = useI18n();
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
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
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
      setError(t.voice.noBrowser);
      return;
    }
    setError(null);
    setHeardSomething(false);
    committedRef.current = value ? value.trimEnd() + " " : "";

    await startMeter();

    const rec = new Ctor();
    rec.lang = t.meta.speechLang;
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
          ? t.voice.noPermission
          : e.error === "no-speech"
            ? t.voice.noSpeech
            : t.voice.stopped,
      );
      teardown();
    };
    rec.onend = () => teardown();

    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }, [onChange, startMeter, t, teardown, value]);

  const hasWords = value.trim().length > 0;
  const transcriptIsUrdu = /[؀-ۿ]/.test(value);

  return (
    <div className="flex flex-col items-center px-5 py-10 text-center sm:px-8 sm:py-12">
      {/* the microphone */}
      <button
        onClick={listening ? teardown : start}
        className="relative grid size-32 place-items-center rounded-full transition-transform active:scale-95 sm:size-36"
        aria-label={listening ? t.voice.stop : t.voice.tapMic}
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

      {/* what is happening */}
      <p
        className={cn(
          "type-action-lg mt-5 max-w-[26ch]",
          listening && "text-signal",
        )}
      >
        {listening
          ? heardSomething
            ? t.voice.weCanHear
            : t.voice.listening
          : t.voice.tapMic}
      </p>

      {/* live transcript */}
      {hasWords && (
        <div className="border-rule bg-paper-sunk mt-8 w-full border p-4 text-start sm:p-5">
          <p className="type-eyebrow text-ink-faint mb-2.5">{t.voice.whatWeHeard}</p>
          <p
            className="type-lead text-ink"
            dir={transcriptIsUrdu ? "rtl" : undefined}
            style={
              transcriptIsUrdu && locale !== "ur"
                ? { fontFamily: "var(--font-nastaliq)", lineHeight: 2.1 }
                : undefined
            }
          >
            {value}
          </p>
        </div>
      )}

      {error && <p className="type-body text-p2 mt-5 max-w-[34ch]">{error}</p>}

      {/* onward */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {listening ? (
          <Button variant="outline" size="lg" onClick={teardown}>
            <Square className="me-2 size-4" />
            {t.voice.stop}
          </Button>
        ) : (
          hasWords && (
            <Button size="lg" onClick={onDone}>
              <Check className="me-2 size-4" />
              {t.voice.confirm}
            </Button>
          )
        )}
      </div>

      {hasWords && !listening && (
        <button
          onClick={() => onChange("")}
          className="type-body text-ink-faint hover:text-ink mt-4 underline underline-offset-4 transition-colors"
        >
          {t.voice.clearRetry}
        </button>
      )}
    </div>
  );
}
