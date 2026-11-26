// สร้างไอคอนแอป (PNG) จากโลโก้ A ของ Aortica โดยไม่ต้องใช้ไลบรารีภายนอก
import { deflateSync } from 'node:zlib';

const SIZES = new Set([180, 192, 512]);

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function encodePng(w, h, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // 8 บิตต่อสี
  ihdr[9] = 2; // RGB
  const stride = w * 3 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y += 1) {
    raw[y * stride] = 0;
    rgb.copy(raw, y * stride + 1, y * w * 3, (y + 1) * w * 3);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// รูปทรงโลโก้ (พิกัดกรอบ 64x64 เหมือนโลโก้ในเว็บ)
const A = [[32, 3], [61, 59], [46.5, 59], [32, 30.5], [17.5, 59], [3, 59]];
const BAR = [[21, 46], [43, 46], [39.5, 52.5], [24.5, 52.5]];

const inPoly = (poly, x, y) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c0, c1, t) => [lerp(c0[0], c1[0], t), lerp(c0[1], c1[1], t), lerp(c0[2], c1[2], t)];
const G0 = [0xc0, 0x84, 0xfc];
const G1 = [0x63, 0x66, 0xf1];
const G2 = [0xec, 0x48, 0x99];
const grad = (t) => (t < 0.55 ? mix(G0, G1, t / 0.55) : mix(G1, G2, (t - 0.55) / 0.45));
const clamp01 = (v) => Math.min(1, Math.max(0, v));

function sample(lx, ly, u, v) {
  const d = Math.hypot(u - 0.5, v - 0.5) / 0.7071;
  const k = Math.max(0, 1 - d * 1.3);
  let c = [6 + 34 * k * k, 5 + 10 * k * k, 11 + 60 * k * k];
  if (inPoly(A, lx, ly)) c = grad(clamp01(((lx - 3) / 58 + (ly - 3) / 56) / 2));
  if (inPoly(BAR, lx, ly)) c = [0x22, 0xd3, 0xee];
  if ((lx - 32) ** 2 + (ly - 13) ** 2 <= 2.2 ** 2) c = [255, 255, 255];
  return c;
}

function render(size, pad) {
  const SS = 3; // ทำให้ขอบเรียบ
  const scale = (size * (1 - 2 * pad)) / 64;
  const off = size * pad;
  const out = Buffer.alloc(size * size * 3);
  const n = SS * SS;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          const c = sample((px - off) / scale, (py - off) / scale, px / size, py / size);
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const i = (y * size + x) * 3;
      out[i] = Math.round(r / n);
      out[i + 1] = Math.round(g / n);
      out[i + 2] = Math.round(b / n);
    }
  }
  return out;
}

export default function handler(req, res) {
  const s = Number(req.query?.s);
  const size = SIZES.has(s) ? s : 192;
  const maskable = req.query?.m === '1';
  const png = encodePng(size, size, render(size, maskable ? 0.26 : 0.17));
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=2592000');
  res.status(200).send(png);
}
