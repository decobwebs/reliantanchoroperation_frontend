/**
 * Renders every PWA icon from public/icons/mark.svg.
 *
 * Run BY HAND after changing the mark, and commit the PNGs:
 *
 *     node scripts/gen-icons.mjs
 *
 * This is deliberately NOT part of `npm run build`. `sharp` is only present
 * transitively (via Next) and is not a declared dependency of this app — making
 * the build depend on it would break the moment that hoist changes. The outputs
 * are committed, so the build never needs it.
 *
 * Everything comes from the vector, never from public/logo-email.png: that
 * raster is 140x140 with no alpha, and a 3.7x upscale to the 512px the manifest
 * requires is visibly soft on a phone.
 */
import sharp from "sharp";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUB = join(ROOT, "public");
const ICONS = join(PUB, "icons");

const BRAND = "#0d79c9"; // brand-500 — the swoosh and ring
const NAVY = "#102447"; // the anchor body, and the manifest theme_color
const LIGHT = "#8ec7f0"; // brand-300

const src = await readFile(join(ICONS, "mark.svg"), "utf8");

/** The mark recoloured. Light-on-dark keeps the two-tone identity legible:
 *  the navy body would vanish entirely against a navy background. */
const variant = (brand, navy) =>
  src.replaceAll(BRAND, brand).replaceAll(NAVY, navy);

const FULL = src; // brand blue + navy, on white
const ON_NAVY = variant(LIGHT, "#ffffff"); // light blue + white, on navy
const MONO = variant("#ffffff", "#ffffff"); // flat white silhouette

/**
 * @param svg      which recolouring to render
 * @param size     output canvas, square
 * @param coverage how much of the canvas width the mark spans (0–1)
 * @param bg       canvas colour, or null for transparent
 */
async function icon(svg, size, coverage, bg, out) {
  const box = Math.round(size * coverage);
  const mark = await sharp(Buffer.from(svg), { density: 1200 })
    .resize(box, box, { fit: "contain", background: "#00000000" })
    .png()
    .toBuffer();
  const off = Math.round((size - box) / 2);

  let canvas = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: bg ?? "#00000000",
    },
  }).composite([{ input: mark, left: off, top: off }]);

  // iOS masks the apple-touch-icon itself and renders any alpha as black, so
  // that one must be flattened. The rest keep their alpha.
  if (bg && out.includes("apple-touch")) canvas = canvas.flatten({ background: bg });

  await canvas.png().toFile(join(PUB, out));
  console.log("  ", out, `${size}x${size}`);
}

await mkdir(ICONS, { recursive: true });
console.log("Rendering icons from mark.svg:");

// Install icons — `purpose: "any"`. Comfortable padding; these are shown whole.
await icon(FULL, 192, 0.78, "#ffffff", "icons/icon-192.png");
await icon(FULL, 512, 0.78, "#ffffff", "icons/icon-512.png");

// Maskable — Android crops to a circle/squircle and keeps only the middle 80%,
// so the mark sits at 56% and the background bleeds to every edge.
await icon(ON_NAVY, 192, 0.56, NAVY, "icons/icon-maskable-192.png");
await icon(ON_NAVY, 512, 0.56, NAVY, "icons/icon-maskable-512.png");

// iOS home screen. No alpha, no rounded corners — iOS adds its own.
await icon(FULL, 180, 0.8, "#ffffff", "apple-touch-icon.png");

// Notification badge. Android renders ONLY the alpha channel of this image, so
// it must be a flat white silhouette on transparent — anything with colour
// arrives on the phone as a grey blob.
await icon(MONO, 96, 0.92, null, "icons/badge-96.png");

console.log("Done.");
