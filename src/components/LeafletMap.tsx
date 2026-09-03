"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, Popup, TileLayer, ZoomControl } from "react-leaflet";
import Link from "next/link";
import { useMemo, useState } from "react";
import { fmt } from "@/lib/i18n";
import { CITY, DEPARTMENTS } from "@/lib/taxonomy";
import { useI18n } from "./LocaleProvider";
import type { Complaint, Priority } from "@/lib/types";
import { shortAgo } from "@/lib/utils";

/* ============================================================
   THE CITY, AS THE SYSTEM SEES IT
   Pin colour is priority and pin radius is corroboration — a case
   twelve people reported is physically larger than one person's.
   Nothing on this map is styled for looks.

   Leaflet rather than a WebGL map on purpose: raster tiles over
   plain DOM have no worker and no GL context to fail on stage.
   ============================================================ */

const PRIORITY_HEX: Record<Priority, string> = {
  P1: "#B3261E",
  P2: "#D2582A",
  P3: "#BE8A12",
  P4: "#6B7668",
};

export default function LeafletMap({ complaints }: { complaints: Complaint[] }) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<Priority | "all">("all");

  const visible = useMemo(
    () =>
      complaints.filter(
        (c) => c.lat != null && c.lng != null && (filter === "all" || c.priority === filter),
      ),
    [complaints, filter],
  );

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[CITY.center.lat, CITY.center.lng]}
        zoom={12}
        zoomControl={false}
        attributionControl={false}
        className="h-full w-full"
        style={{ background: "#0F0F0D" }}
      >
        {/* Esri's dark canvas: raster, keyless, and genuinely dark.
            CARTO's free dark basemap now stamps "API KEY REQUIRED"
            across every tile, so it is not usable unkeyed. Base and
            labels are separate layers here — the reference layer is
            what puts Gulberg and Johar Town on the map. */}
        <TileLayer
          url="https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          maxZoom={16}
        />
        <TileLayer
          url="https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
          maxZoom={16}
        />
        <ZoomControl position="bottomright" />

        {visible.map((c) => {
          const radius = c.duplicate_count > 0 ? Math.min(15, 6 + c.duplicate_count * 0.7) : 4.5;
          const hex = PRIORITY_HEX[c.priority];
          return (
            <CircleMarker
              key={c.id}
              center={[c.lat!, c.lng!]}
              radius={radius}
              pathOptions={{
                color: hex,
                weight: 1.5,
                fillColor: hex,
                fillOpacity: c.duplicate_count > 0 ? 0.25 : 0.8,
              }}
            >
              <Popup closeButton={false} maxWidth={280}>
                <div className="type-meta text-ink-faint">{c.tracking_id}</div>
                <div className="type-h3 text-ink mt-1">{c.title}</div>
                <div className="type-meta text-ink-muted mt-1.5">
                  {t.category[c.category]} · {DEPARTMENTS[c.department_id].shortName} ·{" "}
                  {fmt(t.console.reportedAgo, { t: shortAgo(c.created_at) })}
                </div>
                {c.duplicate_count > 0 && (
                  <div className="type-meta text-signal mt-1">
                    {fmt(t.map.corroborating, { n: c.duplicate_count })}
                  </div>
                )}
                <Link
                  href={`/track/${c.tracking_id}`}
                  className="type-eyebrow border-rule text-ink-muted hover:border-ink hover:text-ink mt-2.5 inline-block border px-2 py-1 transition-colors"
                >
                  {t.map.openCase}
                </Link>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* legend / filter */}
      <div className="border-console-rule bg-console/90 absolute top-4 left-4 z-[1000] border p-3 backdrop-blur-sm">
        <div className="type-eyebrow text-console-faint mb-2.5">{t.map.priority}</div>
        <ul className="space-y-1.5">
          {(["all", "P1", "P2", "P3", "P4"] as const).map((p) => (
            <li key={p}>
              <button
                onClick={() => setFilter(p)}
                className={`type-meta flex items-center gap-2 transition-colors ${
                  filter === p
                    ? "text-console-ink"
                    : "text-console-faint hover:text-console-muted"
                }`}
              >
                <span
                  className="block size-2 rounded-full"
                  style={{
                    background: p === "all" ? "transparent" : PRIORITY_HEX[p],
                    border: p === "all" ? "1px solid currentColor" : "none",
                  }}
                />
                {p === "all" ? t.map.allCases : `${p} · ${t.priority[p].label}`}
              </button>
            </li>
          ))}
        </ul>
        <div className="border-console-rule type-meta text-console-faint mt-3 border-t pt-2.5">
          {fmt(t.map.plotted, { n: visible.length })}
        </div>
      </div>
    </div>
  );
}
