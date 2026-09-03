"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/* ============================================================
   TRACKING CODE
   The receipt is meant to be photographed. A citizen leaving a
   government office wants the case on their phone, not a
   seventeen character string to copy by hand, and anyone the
   complaint is shown to can reach the live case in one scan.

   Rendered as SVG rather than a canvas so it stays sharp when
   the receipt is printed or projected.
   ============================================================ */

export default function TrackingQr({
  trackingId,
  size = 132,
}: {
  trackingId: string;
  size?: number;
}) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    // The origin is only knowable in the browser, and it has to be right:
    // a code pointing at localhost is worse than no code at all.
    const url = `${window.location.origin}/track/${trackingId}`;

    QRCode.toString(url, {
      type: "svg",
      margin: 0,
      // Highest correction level, because this gets scanned off a
      // projector and across a room.
      errorCorrectionLevel: "H",
      color: { dark: "#15140F", light: "#00000000" },
    })
      .then(setSvg)
      .catch(() => setSvg(null));
  }, [trackingId]);

  if (!svg) {
    // Hold the space so the receipt does not jump when the code arrives.
    return <div style={{ width: size, height: size }} aria-hidden="true" />;
  }

  return (
    <div
      style={{ width: size, height: size }}
      className="[&>svg]:block [&>svg]:h-full [&>svg]:w-full"
      role="img"
      aria-label={`QR code linking to complaint ${trackingId}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
