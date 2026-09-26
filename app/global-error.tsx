"use client";

import { useEffect } from "react";
import { reloadIfStaleBuild, reportError } from "@/components/shared/RouteError";

/**
 * Last line of defence: a fault in the root layout itself. It replaces the
 * whole document, so it cannot rely on the app's stylesheet and styles itself
 * inline. Without this file Next.js showed its own bare "This page couldn't
 * load", with no record of what had failed.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    reportError(error);
    reloadIfStaleBuild(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5f7fa",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
          color: "#12233d",
          padding: "16px",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            background: "#fff",
            border: "1px solid #dae2ec",
            borderRadius: 16,
            padding: 24,
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Reliant Anchor didn&apos;t load</p>
          <p style={{ fontSize: 13, color: "#56677e", margin: "8px 0 20px" }}>
            Something went wrong starting the app. Reloading usually fixes it.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button
              onClick={() => unstable_retry()}
              style={{ background: "#0a1f3c", color: "#fff", border: 0, borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{ background: "#fff", color: "#12233d", border: "1px solid #dae2ec", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              Reload page
            </button>
          </div>
          {error?.digest && (
            <p style={{ marginTop: 16, fontFamily: "monospace", fontSize: 10, color: "#8a99ad" }}>
              Ref: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
