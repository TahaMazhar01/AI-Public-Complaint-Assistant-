"use client";

/* Replaces the root layout itself, so there is no locale provider and no
   design system here. Deliberately plain, deliberately self-contained:
   this file runs when everything else has already failed. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#F4F2EC",
          color: "#15140F",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: "40ch", textAlign: "center" }}>
          <p
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: "0.6875rem",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#8C8879",
              margin: "0 0 1.5rem",
            }}
          >
            Awaaz
          </p>
          <h1 style={{ fontSize: "1.75rem", lineHeight: 1.15, margin: 0 }}>
            Something went wrong at our end
          </h1>
          <p style={{ lineHeight: 1.6, color: "#57544A", marginTop: "1rem" }}>
            The problem has been logged. Your complaints are safe; nothing you
            filed has been lost.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "2rem",
              height: "3.5rem",
              padding: "0 1.5rem",
              background: "#15140F",
              color: "#F4F2EC",
              border: "1px solid #15140F",
              fontSize: "0.9375rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest && (
            <p
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.75rem",
                color: "#8C8879",
                marginTop: "2rem",
              }}
            >
              {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
