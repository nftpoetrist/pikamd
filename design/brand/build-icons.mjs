// Site icons from the mascot maps (web/components/brand/pika-art.ts), at integer scales so every
// pixel stays sharp:
//   web/app/favicon.ico    16, 32 and 48 px: the 16×16 head at 1×, 2×, 3× (PNG entries)
//   web/app/icon.png       64 px: the head at 4×, transparent
//   web/app/apple-icon.png 180 px: the full mascot at 5× on the site's dark background, opaque
//
//   node --experimental-strip-types design/brand/build-icons.mjs
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const WEB = join(ROOT, "web");
const sharp = createRequire(join(WEB, "package.json"))("sharp");
const { PIKA, PIKA_HEAD, PIKA_PALETTE } = await import(join(WEB, "components/brand/pika-art.ts"));

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** RGBA pixels of a map at `scale`, centered on a transparent `size`×`size` canvas. */
function raster(rows, scale, size) {
  const w = rows[0].length * scale, h = rows.length * scale;
  const ox = Math.floor((size - w) / 2), oy = Math.floor((size - h) / 2);
  const buf = Buffer.alloc(size * size * 4);
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === ".") return;
    const [r, g, b] = hex(PIKA_PALETTE[ch]);
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const i = ((oy + y * scale + dy) * size + (ox + x * scale + dx)) * 4;
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
    }
  }));
  return buf;
}

const png = (rows, scale, size) => sharp(raster(rows, scale, size), { raw: { width: size, height: size, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();

// favicon.ico: an ICO directory of PNG images (supported by every current browser)
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map((s) => png(PIKA_HEAD, s / 16, s)));
const header = Buffer.alloc(6 + 16 * images.length);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
let offset = header.length;
images.forEach((img, i) => {
  const e = 6 + 16 * i;
  header.writeUInt8(sizes[i], e); header.writeUInt8(sizes[i], e + 1);
  header.writeUInt8(0, e + 2); header.writeUInt8(0, e + 3);
  header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(img.length, e + 8); header.writeUInt32LE(offset, e + 12);
  offset += img.length;
});
writeFileSync(join(WEB, "app/favicon.ico"), Buffer.concat([header, ...images]));

writeFileSync(join(WEB, "app/icon.png"), await png(PIKA_HEAD, 4, 64));

// Apple touch icon: opaque, the site's dark background with a soft gold glow behind the mascot
const S = 180;
const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
  <defs><radialGradient id="g" cx="50%" cy="50%" r="55%">
    <stop offset="0%" stop-color="#4A3200"/><stop offset="60%" stop-color="#1A0F00"/><stop offset="100%" stop-color="#060300"/>
  </radialGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/></svg>`);
const sprite = await png(PIKA, 5, S);
await sharp(bg).composite([{ input: sprite }]).flatten({ background: "#060300" }).png({ compressionLevel: 9 }).toFile(join(WEB, "app/apple-icon.png"));

console.log("favicon.ico (16/32/48), icon.png (64), apple-icon.png (180)");
