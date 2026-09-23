import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Self-hosted by next/font, so the CSP's `font-src 'self' data:` still holds.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// No viewportFit: "cover" — that would draw content under the iPhone notch,
// and nothing in the shell uses env(safe-area-inset-*) yet. Leaving it off
// makes iOS letterbox the safe areas in the theme colour, which is correct
// out of the box.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#102447" },
    { media: "(prefers-color-scheme: dark)", color: "#101826" },
  ],
};

export const metadata: Metadata = {
  title: "Reliant Anchor — Operations Management",
  description: "RAOMS — Maritime bunker operations management system",
  applicationName: "RAOMS",
  // NOT setting `manifest` here — app/manifest.ts (the file-convention route)
  // already injects the <link rel="manifest">, and setting both emits two.
  appleWebApp: {
    capable: true,
    title: "RAOMS",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`h-full antialiased ${inter.variable}`}>
      <body className="min-h-full bg-background text-foreground font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
