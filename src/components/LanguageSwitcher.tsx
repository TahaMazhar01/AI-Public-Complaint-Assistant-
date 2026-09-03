"use client";

import { Globe } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { setLocale } from "@/app/actions";
import { LOCALES, getDictionary, type Locale } from "@/lib/i18n";
import { useI18n } from "./LocaleProvider";
import { cn } from "@/lib/utils";

/* ============================================================
   LANGUAGE
   Every option is written in its OWN script — a reader looking
   for their language must never have to read another one to
   find it. Sets a cookie and refreshes so the server re-renders
   every string, including the ones inside server components.
   ============================================================ */

export default function LanguageSwitcher({ dark = false }: { dark?: boolean }) {
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const choose = (next: Locale) => {
    setOpen(false);
    // Written by a server action so the cookie is committed before the
    // refresh that re-reads it. Writing document.cookie here raced it.
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  };

  const current = getDictionary(locale);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className={cn(
          "inline-flex h-12 items-center gap-2 border px-3.5 transition-colors",
          dark
            ? "border-console-rule text-console-muted hover:border-console-ink hover:text-console-ink"
            : "border-rule text-ink-muted hover:border-ink hover:text-ink",
          pending && "opacity-50",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={current.language.choose}
      >
        <Globe className="size-4" />
        <span className="type-action text-[0.95rem]">
          {current.language[locale]}
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          className={cn(
            "absolute end-0 top-full z-50 mt-1 min-w-[9.5rem] border",
            dark ? "border-console-rule bg-console-raised" : "border-rule bg-paper-raised",
          )}
        >
          {LOCALES.map((l) => {
            const d = getDictionary(l);
            return (
              <li key={l}>
                <button
                  role="option"
                  aria-selected={l === locale}
                  onClick={() => choose(l)}
                  dir={d.meta.dir}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-start transition-colors",
                    dark
                      ? "text-console-muted hover:bg-console hover:text-console-ink"
                      : "text-ink-muted hover:bg-paper-sunk hover:text-ink",
                    l === locale && (dark ? "text-console-ink" : "text-ink"),
                  )}
                >
                  <span
                    className="type-action"
                    style={{
                      fontFamily:
                        l === "ur"
                          ? "var(--font-nastaliq)"
                          : l === "zh"
                            ? "var(--font-notosc)"
                            : "var(--font-archivo)",
                      lineHeight: l === "ur" ? 2 : 1.2,
                    }}
                  >
                    {d.language[l]}
                  </span>
                  {l === locale && (
                    <span className="bg-signal block size-1.5 rounded-full" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
