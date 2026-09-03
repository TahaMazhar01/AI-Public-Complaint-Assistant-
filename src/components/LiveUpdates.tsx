"use client";

import { motion } from "motion/react";
import { ArrowRight, Radio } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { fmt } from "@/lib/i18n";
import { browserClient } from "@/lib/supabase";
import type { Complaint } from "@/lib/types";
import { useI18n } from "./LocaleProvider";
import { cn } from "@/lib/utils";

/* ============================================================
   LIVE QUEUE
   Subscribes to inserts on `complaints` and re-renders the page
   the moment one lands. The officer never refreshes; a complaint
   filed on a phone appears in the dispatch queue while they are
   looking at it.

   Rendering stays entirely on the server. This component holds no
   case data of its own, it only asks the router to fetch again,
   so there is exactly one source of truth for what the queue says.
   ============================================================ */

interface Arrival {
  id: string;
  trackingId: string;
  title: string;
  category: string;
}

export default function LiveUpdates({ dark = true }: { dark?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const [arrivals, setArrivals] = useState<Arrival[]>([]);

  // Several rows can land within a second or two. Refresh once for the
  // batch rather than once per row, which would thrash the server.
  const pending = useRef<number | null>(null);

  useEffect(() => {
    const supabase = browserClient();
    if (!supabase) return;

    const channel = supabase
      .channel("awaaz-queue")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "complaints" },
        (payload) => {
          const row = payload.new as Partial<Complaint>;
          if (row?.tracking_id) {
            setArrivals((prev) =>
              [
                {
                  id: String(row.id ?? row.tracking_id),
                  trackingId: String(row.tracking_id),
                  title: String(row.title ?? ""),
                  category: String(row.category ?? ""),
                },
                ...prev,
              ].slice(0, 5),
            );
          }
          if (pending.current) clearTimeout(pending.current);
          pending.current = window.setTimeout(() => router.refresh(), 700);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "complaints" },
        () => {
          if (pending.current) clearTimeout(pending.current);
          pending.current = window.setTimeout(() => router.refresh(), 700);
        },
      )
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => {
      if (pending.current) clearTimeout(pending.current);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  // Let an arrival announce itself, then get out of the way.
  useEffect(() => {
    if (!arrivals.length) return;
    const id = setTimeout(() => setArrivals([]), 9000);
    return () => clearTimeout(id);
  }, [arrivals]);

  if (!connected && arrivals.length === 0) return null;

  const latest = arrivals[0];

  return (
    <>
      {/* Quiet proof the socket is open, so nobody wonders whether the
          queue is stale while waiting for the demo complaint to land. */}
      <span
        className={cn(
          "type-eyebrow inline-flex items-center gap-2",
          dark ? "text-console-faint" : "text-ink-faint",
          connected && "text-resolved",
        )}
        title={t.live.connected}
      >
        <Radio className="size-3" />
        {t.live.connected}
      </span>

      {latest && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          role="status"
          aria-live="polite"
          className={cn(
            "fixed inset-x-0 top-20 z-50 mx-auto flex w-[min(38rem,calc(100%-2rem))] items-center gap-3 border px-4 py-3 backdrop-blur-sm sm:top-28",
            dark
              ? "border-signal bg-console-raised/95 text-console-ink"
              : "border-signal bg-paper-raised/95 text-ink",
          )}
        >
          <span className="pulse-dot text-signal block size-2 shrink-0 rounded-full bg-current" />

          <div className="min-w-0 flex-1">
            <p className="type-action text-[0.9rem]">
              {arrivals.length === 1
                ? t.live.newCase
                : fmt(t.live.newCases, { n: arrivals.length })}
            </p>
            <p
              className={cn(
                "type-meta mt-0.5 truncate",
                dark ? "text-console-muted" : "text-ink-muted",
              )}
            >
              <span dir="ltr">{latest.trackingId}</span>
              {latest.title ? ` · ${latest.title}` : ""}
            </p>
          </div>

          <Link
            href={`/console/${latest.trackingId}`}
            className={cn(
              "type-action inline-flex shrink-0 items-center gap-1.5 border px-3 py-2 text-[0.85rem] transition-colors",
              dark
                ? "border-console-rule text-console-muted hover:border-console-ink hover:text-console-ink"
                : "border-rule text-ink-muted hover:border-ink hover:text-ink",
            )}
          >
            {t.live.view}
            <ArrowRight className="size-3.5 rtl:rotate-180" />
          </Link>
        </motion.div>
      )}
    </>
  );
}
