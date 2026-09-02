"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { changeStatus } from "@/app/console/actions";
import type { ComplaintStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/* The officer's only job on this screen: move the case forward.
   Every press writes an event the citizen can read on their
   tracking page seconds later — that round trip is the demo. */

const STEPS: { id: ComplaintStatus; label: string }[] = [
  { id: "acknowledged", label: "Acknowledge" },
  { id: "in_progress", label: "Dispatch team" },
  { id: "resolved", label: "Mark resolved" },
];

export default function StatusActions({
  complaintId,
  current,
}: {
  complaintId: string;
  current: ComplaintStatus;
}) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<ComplaintStatus | null>(null);
  const router = useRouter();

  const act = (status: ComplaintStatus) => {
    setBusy(status);
    startTransition(async () => {
      await changeStatus(complaintId, status);
      router.refresh();
      setBusy(null);
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {STEPS.map((s) => {
        const done =
          (s.id === "acknowledged" &&
            ["acknowledged", "in_progress", "resolved"].includes(current)) ||
          (s.id === "in_progress" && ["in_progress", "resolved"].includes(current)) ||
          (s.id === "resolved" && current === "resolved");

        return (
          <button
            key={s.id}
            onClick={() => act(s.id)}
            disabled={pending || done}
            className={cn(
              "inline-flex items-center gap-2 border px-3.5 py-2.5 transition-colors",
              done
                ? "border-resolved text-resolved cursor-default"
                : "border-console-rule text-console-muted hover:border-console-ink hover:text-console-ink",
              pending && !done && "opacity-60",
            )}
          >
            {busy === s.id ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : done ? (
              <Check className="size-3.5" />
            ) : null}
            <span className="type-eyebrow">{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}
