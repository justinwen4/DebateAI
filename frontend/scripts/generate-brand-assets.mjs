import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, "..", "public");
const appDir = path.join(root, "..", "app");

const fullSvg = fs.readFileSync(path.join(publicDir, "debate-ai-logo.svg"));
const iconSvg = fs.readFileSync(path.join(publicDir, "debate-ai-icon.svg"));

async function svgToPng(svg, width, outPath) {
  await sharp(svg, { density: 300 })
    .resize({ width, withoutEnlargement: false })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

async function createOpenGraphImage(outPath) {
  const logo = await sharp(fullSvg, { density: 300 }).resize({ width: 520 }).png().toBuffer();
  const { width, height } = await sharp(logo).metadata();

  await sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 4,
      background: { r: 248, g: 250, b: 252, alpha: 1 },
    },
  })
    .composite([{ input: logo, top: Math.round((630 - height) / 2), left: Math.round((1200 - width) / 2) }])
    .png()
    .toFile(outPath);
}

await svgToPng(iconSvg, 512, path.join(publicDir, "debate-ai-icon.png"));
await svgToPng(fullSvg, 800, path.join(publicDir, "debate-ai-logo.png"));
await svgToPng(iconSvg, 512, path.join(appDir, "icon.png"));
await svgToPng(iconSvg, 180, path.join(appDir, "apple-icon.png"));
await createOpenGraphImage(path.join(appDir, "opengraph-image.png"));
await createOpenGraphImage(path.join(publicDir, "og-image.png"));

console.log("Generated brand assets");
