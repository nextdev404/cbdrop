import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Pure Node.js PNG Decoder
function decodePNG(buf) {
  let offset = 8, width, height, idatChunks = [];
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    }
    offset += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const stride = 1 + width * 4;
  const rgba = Buffer.alloc(width * height * 4);

  function paeth(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
  }

  for (let y = 0; y < height; y++) {
    const filter = raw[y * stride];
    const rowStart = y * stride + 1;
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 4; c++) {
        let val = raw[rowStart + x * 4 + c];
        const a = x > 0 ? rgba[(y * width + (x - 1)) * 4 + c] : 0;
        const b = y > 0 ? rgba[((y - 1) * width + x) * 4 + c] : 0;
        const c_prev = (x > 0 && y > 0) ? rgba[((y - 1) * width + (x - 1)) * 4 + c] : 0;
        if (filter === 1) val = (val + a) & 0xff;
        else if (filter === 2) val = (val + b) & 0xff;
        else if (filter === 3) val = (val + Math.floor((a + b) / 2)) & 0xff;
        else if (filter === 4) val = (val + paeth(a, b, c_prev)) & 0xff;
        rgba[(y * width + x) * 4 + c] = val;
      }
    }
  }
  return { width, height, rgba };
}

// Pure Node.js PNG Encoder
function encodePNG(width, height, rgba) {
  const stride = 1 + width * 4;
  const raw = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // Filter None
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  function makeChunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);
    const toCrc = Buffer.concat([typeBuf, data]);
    const crc = zlib.crc32(toCrc);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc >>> 0, 0);
    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
  }

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdrData),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

const srcFile = path.resolve('scripts/assets/source-logo.png');
console.log('Loading source artwork:', srcFile);
const { width: srcW, height: srcH, rgba: srcRGBA } = decodePNG(fs.readFileSync(srcFile));

// 1. Identify Background via flood-fill
const isBg = new Uint8Array(srcW * srcH);

function floodFill(seedX, seedY) {
  const q = [seedX, seedY];
  while (q.length > 0) {
    const cy = q.pop();
    const cx = q.pop();
    const idx = cy * srcW + cx;
    if (isBg[idx]) continue;
    const pIdx = idx * 4;
    const r = srcRGBA[pIdx], g = srcRGBA[pIdx+1], b = srcRGBA[pIdx+2];
    if (r >= 246 && g >= 246 && b >= 246) {
      isBg[idx] = 1;
      if (cx > 0 && !isBg[idx - 1]) q.push(cx - 1, cy);
      if (cx < srcW - 1 && !isBg[idx + 1]) q.push(cx + 1, cy);
      if (cy > 0 && !isBg[idx - srcW]) q.push(cx, cy - 1);
      if (cy < srcH - 1 && !isBg[idx + srcW]) q.push(cx, cy + 1);
    }
  }
}

// Flood fill all canvas borders
for (let x = 0; x < srcW; x++) {
  floodFill(x, 0);
  floodFill(x, srcH - 1);
}
for (let y = 0; y < srcH; y++) {
  floodFill(0, y);
  floodFill(srcW - 1, y);
}

// Flood fill letter counters for 'd' and 'p'
floodFill(610, 325);
floodFill(840, 325);

console.log('Background identification complete.');

// Crop boundaries matching the original brand layout
const cropX = 140, cropY = 220, cropW = 745, cropH = 203;

function buildLogo(isDark) {
  const out = Buffer.alloc(cropW * cropH * 4);

  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      const sx = cropX + x;
      const sy = cropY + y;
      const sIdx = (sy * srcW + sx) * 4;
      const oIdx = (y * cropW + x) * 4;
      const r = srcRGBA[sIdx], g = srcRGBA[sIdx+1], b = srcRGBA[sIdx+2];

      // Region A: "CB" text (sx: 350..557)
      if (sx >= 350 && sx <= 557) {
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const cov = Math.max(0, Math.min(1, (254 - lum) / 239));
        if (cov < 0.03) {
          // Transparent background / counter
          out[oIdx] = 0; out[oIdx+1] = 0; out[oIdx+2] = 0; out[oIdx+3] = 0;
        } else {
          const a = Math.round(cov * 255);
          if (isDark) {
            // Pure white text with smooth subpixel anti-aliasing
            out[oIdx] = 255;
            out[oIdx+1] = 255;
            out[oIdx+2] = 255;
            out[oIdx+3] = a;
          } else {
            // Un-matted dark navy text with smooth anti-aliasing
            const unR = Math.max(0, Math.min(255, Math.round((r - (1 - cov) * 254) / cov)));
            const unG = Math.max(0, Math.min(255, Math.round((g - (1 - cov) * 254) / cov)));
            const unB = Math.max(0, Math.min(255, Math.round((b - (1 - cov) * 254) / cov)));
            out[oIdx] = unR;
            out[oIdx+1] = unG;
            out[oIdx+2] = unB;
            out[oIdx+3] = a;
          }
        }
        continue;
      }

      // Region B: Squircle mark (sx < 350)
      if (sx < 350) {
        const bg = isBg[sy * srcW + sx];
        if (bg) {
          out[oIdx] = 0; out[oIdx+1] = 0; out[oIdx+2] = 0; out[oIdx+3] = 0;
          continue;
        }

        let nearBg = false;
        for (let dy = -2; dy <= 2 && !nearBg; dy++) {
          for (let dx = -2; dx <= 2 && !nearBg; dx++) {
            if (isBg[(sy + dy) * srcW + (sx + dx)]) nearBg = true;
          }
        }

        if (nearBg) {
          // Edge anti-aliasing without white fringe
          const diff = Math.max(254 - r, 254 - g, 254 - b);
          if (diff < 8) {
            out[oIdx] = 0; out[oIdx+1] = 0; out[oIdx+2] = 0; out[oIdx+3] = 0;
          } else {
            const cov = Math.min(1, Math.max(0, (diff - 4) / 140));
            const a = Math.round(cov * 255);
            const unR = Math.max(0, Math.min(255, Math.round((r - (1 - cov) * 254) / cov)));
            const unG = Math.max(0, Math.min(255, Math.round((g - (1 - cov) * 254) / cov)));
            const unB = Math.max(0, Math.min(255, Math.round((b - (1 - cov) * 254) / cov)));
            out[oIdx] = unR;
            out[oIdx+1] = unG;
            out[oIdx+2] = unB;
            out[oIdx+3] = a;
          }
        } else {
          // Solid squircle interior (play button gradient, lime dot, squircle body)
          out[oIdx] = r;
          out[oIdx+1] = g;
          out[oIdx+2] = b;
          out[oIdx+3] = 255;
        }
        continue;
      }

      // Region C: "drop" text (sx > 557)
      const bg = isBg[sy * srcW + sx];
      if (bg) {
        out[oIdx] = 0; out[oIdx+1] = 0; out[oIdx+2] = 0; out[oIdx+3] = 0;
        continue;
      }

      let nearBg = false;
      for (let dy = -2; dy <= 2 && !nearBg; dy++) {
        for (let dx = -2; dx <= 2 && !nearBg; dx++) {
          if (isBg[(sy + dy) * srcW + (sx + dx)]) nearBg = true;
        }
      }

      if (nearBg) {
        const diff = 254 - (r + g) / 2;
        if (diff < 6) {
          out[oIdx] = 0; out[oIdx+1] = 0; out[oIdx+2] = 0; out[oIdx+3] = 0;
        } else {
          const cov = Math.min(1, Math.max(0, (diff - 4) / 165));
          const a = Math.round(cov * 255);
          const unR = Math.max(0, Math.min(255, Math.round((r - (1 - cov) * 254) / cov)));
          const unG = Math.max(0, Math.min(255, Math.round((g - (1 - cov) * 254) / cov)));
          const unB = Math.max(0, Math.min(255, Math.round((b - (1 - cov) * 254) / cov)));
          out[oIdx] = unR;
          out[oIdx+1] = unG;
          out[oIdx+2] = unB;
          out[oIdx+3] = a;
        }
      } else {
        // Solid drop body and white down-arrow inside 'o'
        out[oIdx] = r;
        out[oIdx+1] = g;
        out[oIdx+2] = b;
        out[oIdx+3] = 255;
      }
    }
  }

  return out;
}

console.log('Generating Light Mode logo...');
const lightRGBA = buildLogo(false);
const lightPNG = encodePNG(cropW, cropH, lightRGBA);

console.log('Generating Dark Mode logo...');
const darkRGBA = buildLogo(true);
const darkPNG = encodePNG(cropW, cropH, darkRGBA);

// Write to client/public
fs.writeFileSync('client/public/logo.png', lightPNG);
fs.writeFileSync('client/public/logo-dark.png', darkPNG);
console.log('Written to client/public/logo.png and logo-dark.png');

// Also update client/dist if present
if (fs.existsSync('client/dist')) {
  fs.writeFileSync('client/dist/logo.png', lightPNG);
  fs.writeFileSync('client/dist/logo-dark.png', darkPNG);
  console.log('Written to client/dist/logo.png and logo-dark.png');
}
console.log('Logo assets updated successfully.');
