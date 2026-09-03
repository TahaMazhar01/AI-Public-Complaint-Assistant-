"use client";

import { RotateCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { useI18n } from "@/components/LocaleProvider";
import { Button } from "@/components/ui";

/* ============================================================
   ERROR BOUNDARY
   Without this, a thrown error anywhere in the tree shows the
   framework's default stack page. On a projector, in front of
   judges, that is the worst possible failure. This keeps the
   surface intact and offers a way forward.
   ============================================================ */

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    console.error("[awaaz] render error:", error);
  }, [error]);

  return (
    <div className="grid flex-1 place-items-center px-5 py-24">
      <div className="max-w-[46ch] text-center">
        <div className="type-eyebrow text-ink-faint mb-6 flex items-center justify-center gap-3">
          <span className="bg-p2 block h-px w-8" />
          <span>{t.common.appName}</span>
        </div>

        <h1 className="type-h1 text-balance">{t.error.title}</h1>
        <p className="type-lead mt-5">{t.error.body}</p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" onClick={reset}>
            <RotateCw className="me-2 size-4" />
            {t.error.retry}
          </Button>
          <Link href="/">
            <Button variant="outline" size="lg">
              {t.error.home}
            </Button>
          </Link>
        </div>

        {/* The digest is the only handle on a production error. Showing it
            means a judge or teammate can quote it back to us. */}
        {error.digest && (
          <p className="type-meta text-ink-faint mt-8" dir="ltr">
            {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
