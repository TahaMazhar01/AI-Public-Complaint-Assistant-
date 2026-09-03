"use client";

import dynamic from "next/dynamic";
import type { Complaint } from "@/lib/types";

/* Leaflet reads `window` at module scope, so the map itself must never
   be rendered on the server. This wrapper is the only reason it exists. */
const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="bg-console grid h-full place-items-center">
      <span className="type-eyebrow text-console-faint">Loading…</span>
    </div>
  ),
});

export default function LiveMap({ complaints }: { complaints: Complaint[] }) {
  return <LeafletMap complaints={complaints} />;
}
