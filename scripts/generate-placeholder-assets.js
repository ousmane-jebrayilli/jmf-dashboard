/**
 * Generates placeholder icon.png (1024×1024) and splash.png (2732×2732)
 * in the resources/ directory using only Node.js built-ins.
 *
 * Replace resources/icon.png and resources/splash.png with your real artwork
 * before running `npm run cap:icons`.
 *
 * Run: node scripts/generate-placeholder-assets.js
 */

const fs   = require("fs");
const zlib = require("zlib");
const path = require("path");

function crc32(buf) {
  const table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })();
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u32be(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0);
  return b;
}

function pngChunk(type, data) {
  const typeB = Buffer.from(type, "ascii");
  const len   = u32be(data.length);
  const crcB  = u32be(crc32(Buffer.concat([typeB, data])));
  return Buffer.concat([len, typeB, data, crcB]);
}

function solidPng(width, height, r, g, b) {
  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width,  0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8]  = 8;  // bit depth
  ihdr[9]  = 2;  // color type: RGB
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  // Build raw image data: one filter byte (0) + RGB pixels per scanline
  const scanline = Buffer.alloc(1 + width * 3);
  scanline[0] = 0; // filter: None
  for (let x = 0; x < width; x++) {
    scanline[1 + x * 3]     = r;
    scanline[1 + x * 3 + 1] = g;
    scanline[1 + x * 3 + 2] = b;
  }
  const raw = Buffer.concat(Array(height).fill(scanline));
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    PNG_SIG,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const outDir = path.join(__dirname, "..", "resources");
fs.mkdirSync(outDir, { recursive: true });

// Navy blue icon placeholder (1024×1024)
fs.writeFileSync(path.join(outDir, "icon.png"),   solidPng(1024, 1024, 11, 24,  41));
// Dark splash placeholder (2732×2732) — must be > 2732 on longest side
fs.writeFileSync(path.join(outDir, "splash.png"), solidPng(2732, 2732, 11, 24,  41));

console.log("✓ resources/icon.png   (1024×1024, navy placeholder)");
console.log("✓ resources/splash.png (2732×2732, navy placeholder)");
console.log("");
console.log("Replace these with real artwork, then run:");
console.log("  npx @capacitor/assets generate --iconBackgroundColor '#0B1829' --splashBackgroundColor '#0B1829'");
