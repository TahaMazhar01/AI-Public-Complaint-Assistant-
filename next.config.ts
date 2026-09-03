import type { NextConfig } from "next";

/* Deliberately NOT setting Permissions-Policy. The obvious version of that
   header restricts microphone, camera and geolocation, and this app needs
   all three from its own origin. Getting it subtly wrong would disable
   voice intake, which is the single feature the whole demo rests on, and
   the failure would be silent. The three headers below cannot break
   anything the app does. */
const securityHeaders = [
  // Stop browsers second-guessing a declared Content-Type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Do not leak the full URL (which contains tracking numbers) to third parties.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The console is an authority surface; it should not be frameable.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
