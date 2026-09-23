import type { MetadataRoute } from "next";

// The Next file-convention route: this is served at /manifest.webmanifest and
// its <link rel="manifest"> is injected automatically. Do NOT also set
// `metadata.manifest` in app/layout.tsx — that would emit a second link tag.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Reliant Anchor — Operations Management",
    short_name: "RAOMS",
    description: "Maritime bunker operations management system",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#ffffff",
    theme_color: "#102447",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Notifications", url: "/notifications" },
      { name: "Operations", url: "/operations" },
      { name: "My Tasks", url: "/tasks" },
    ],
  };
}
