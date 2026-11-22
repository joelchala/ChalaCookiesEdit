/**
 * @fileoverview Generador nativo de iconos PNG y SVG para ChalaCookiesEdit (Suite Chala).
 * Renderiza el emblema de doble galleta dorada con chispas de chocolate, mordida y migas
 * usando exclusivamente APIs nativas de Node.js (node:fs, node:path, node:zlib, node:url).
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

/**
 * Calcula CRC32 estándar IEEE 802.3 sobre un Buffer o Uint8Array.
 * @param {Buffer | Uint8Array} buffer
 * @returns {number}
 */
export function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Empaqueta un chunk PNG (length + type + data + crc32).
 * @param {string} type
 * @param {Buffer} data
 * @returns {Buffer}
 */
function makePngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.allocUnsafe(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

/**
 * Codifica un búfer RGBA (width * height * 4 bytes) a un archivo PNG válido (RGBA 8-bit).
 * @param {number} width
 * @param {number} height
 * @param {Uint8Array | Buffer} rgbaBuffer
 * @returns {Buffer}
 */
export function encodePng(width, height, rgbaBuffer) {
  const expectedLength = width * height * 4;
  if (rgbaBuffer.length !== expectedLength) {
    throw new Error(`Tamaño RGBA inesperado: ${rgbaBuffer.length} !== ${expectedLength}`);
  }

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const stride = width * 4;
  const rawScanlines = Buffer.allocUnsafe((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    rawScanlines[rowStart] = 0; // filter type None
    const srcStart = y * stride;
    Buffer.from(rgbaBuffer.buffer, rgbaBuffer.byteOffset + srcStart, stride).copy(
      rawScanlines,
      rowStart + 1
    );
  }

  const compressed = zlib.deflateSync(rawScanlines, { level: 9 });

  return Buffer.concat([
    PNG_SIGNATURE,
    makePngChunk('IHDR', ihdr),
    makePngChunk('IDAT', compressed),
    makePngChunk('IEND', Buffer.alloc(0))
  ]);
}

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

const BACK_COOKIE = { cx: 0.34, cy: 0.45, r: 0.295 };
const FRONT_COOKIE = { cx: 0.625, cy: 0.545, r: 0.32 };

const FRONT_BITES = [
  { cx: 0.835, cy: 0.33, r: 0.135 },
  { cx: 0.885, cy: 0.415, r: 0.125 },
  { cx: 0.935, cy: 0.505, r: 0.138 }
];

const BACK_CHIPS = [
  { x: 0.28, y: 0.255, r: 0.031 },
  { x: 0.415, y: 0.24, r: 0.033 },
  { x: 0.215, y: 0.33, r: 0.026 },
  { x: 0.365, y: 0.375, r: 0.042 },
  { x: 0.185, y: 0.465, r: 0.032 },
  { x: 0.295, y: 0.495, r: 0.026 },
  { x: 0.27, y: 0.615, r: 0.039 }
];

const FRONT_CHIPS = [
  { x: 0.60, y: 0.365, r: 0.044 },
  { x: 0.465, y: 0.475, r: 0.035 },
  { x: 0.65, y: 0.53, r: 0.05 },
  { x: 0.515, y: 0.615, r: 0.043 },
  { x: 0.67, y: 0.71, r: 0.035 },
  { x: 0.805, y: 0.645, r: 0.041 }
];

const CRUMBS = [
  { cx: 0.81, cy: 0.34, rx: 0.048, ry: 0.043, rot: -0.25 },
  { cx: 0.908, cy: 0.425, rx: 0.028, ry: 0.025, rot: 0.35 },
  { cx: 0.91, cy: 0.535, rx: 0.044, ry: 0.034, rot: 0.15 }
];

/**
 * Calcula el color 3D de la masa horneada y sus chispas de chocolate.
 * @param {number} x
 * @param {number} y
 * @param {{ cx: number, cy: number, r: number }} cookie
 * @param {Array<{ x: number, y: number, r: number }>} chips
 * @param {number} edgeDepth Distancia mínima al borde exterior/mordida
 * @returns {[number, number, number]}
 */
function shadeCookieAndChips(x, y, cookie, chips, edgeDepth) {
  const dx = (x - cookie.cx) / cookie.r;
  const dy = (y - cookie.cy) / cookie.r;
  const distNorm = Math.hypot(dx, dy);

  // Iluminación 3D cálida desde arriba-derecha + borde horneado naranja/tostado
  const light = clamp(0.58 - dx * 0.18 - dy * 0.28, 0, 1);
  const rimToast = 1 - smoothstep(0.0, 0.055, edgeDepth);
  const centerCrease = Math.exp(-Math.pow(distNorm * 3.1, 2)) * 0.08;

  let r = 224 + light * 24 - rimToast * 44 - centerCrease * 35;
  let g = 160 + light * 28 - rimToast * 52 - centerCrease * 32;
  let b = 76 + light * 18 - rimToast * 34 - centerCrease * 20;

  // Chispas de chocolate con volumen 3D y sombra en la masa
  for (const chip of chips) {
    const cdx = x - chip.x;
    const cdy = y - chip.y;
    const cDist = Math.hypot(cdx, cdy);

    if (cDist <= chip.r) {
      const nx = cdx / chip.r;
      const ny = cdy / chip.r;
      const chipRim = smoothstep(0.72, 1.0, cDist / chip.r);
      const spec = Math.max(0, -(nx * 0.55 + ny * 0.65));
      const cr = 96 + spec * 42 - chipRim * 34;
      const cg = 54 + spec * 26 - chipRim * 22;
      const cb = 36 + spec * 18 - chipRim * 15;
      return [
        Math.round(clamp(cr, 0, 255)),
        Math.round(clamp(cg, 0, 255)),
        Math.round(clamp(cb, 0, 255))
      ];
    }

    // Sombra suave alrededor de la chispa
    const shadowDist = Math.hypot(cdx - 0.004, cdy - 0.006);
    if (shadowDist < chip.r * 1.24) {
      const s = 1 - smoothstep(chip.r, chip.r * 1.24, shadowDist);
      r -= s * 28;
      g -= s * 26;
      b -= s * 18;
    }
  }

  return [
    Math.round(clamp(r, 0, 255)),
    Math.round(clamp(g, 0, 255)),
    Math.round(clamp(b, 0, 255))
  ];
}

/**
 * Comprueba si el punto cae dentro de la galleta delantera (descontando la mordida).
 * Devuelve la profundidad al borde (> 0 si está dentro, <= 0 si está fuera).
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
function frontCookieDepth(x, y) {
  const outerDepth = FRONT_COOKIE.r - Math.hypot(x - FRONT_COOKIE.cx, y - FRONT_COOKIE.cy);
  if (outerDepth <= 0) return -1;

  let minBiteMargin = Infinity;
  for (const bite of FRONT_BITES) {
    const biteMargin = Math.hypot(x - bite.cx, y - bite.cy) - bite.r;
    if (biteMargin <= 0) return -1;
    if (biteMargin < minBiteMargin) minBiteMargin = biteMargin;
  }

  return Math.min(outerDepth, minBiteMargin);
}

/**
 * Evalúa si el punto cae dentro de alguna de las 3 migas de la mordida.
 * @param {number} x
 * @param {number} y
 * @returns {[number, number, number] | null}
 */
function sampleCrumb(x, y) {
  for (const crumb of CRUMBS) {
    const dx = x - crumb.cx;
    const dy = y - crumb.cy;
    const cos = Math.cos(crumb.rot);
    const sin = Math.sin(crumb.rot);
    const rx = (dx * cos + dy * sin) / crumb.rx;
    const ry = (-dx * sin + dy * cos) / crumb.ry;
    const angle = Math.atan2(ry, rx);
    const radiusMod = 1 + 0.08 * Math.sin(angle * 3) + 0.05 * Math.cos(angle * 5);
    const d = Math.hypot(rx, ry) / radiusMod;

    if (d <= 1) {
      const edge = 1 - d;
      const rim = 1 - smoothstep(0, 0.28, edge);
      const light = clamp(0.55 - rx * 0.22 - ry * 0.25, 0, 1);
      const r = Math.round(clamp(224 + light * 22 - rim * 45, 0, 255));
      const g = Math.round(clamp(162 + light * 24 - rim * 50, 0, 255));
      const b = Math.round(clamp(78 + light * 16 - rim * 34, 0, 255));
      return [r, g, b];
    }
  }
  return null;
}

/**
 * Calcula el color RGBA [0..255] de un subpíxel del emblema de doble galleta.
 * @param {number} x
 * @param {number} y
 * @returns {[number, number, number, number]}
 */
function sampleEmblemPixel(x, y) {
  // 1. Migas de la mordida
  const crumbColor = sampleCrumb(x, y);
  if (crumbColor) {
    return [crumbColor[0], crumbColor[1], crumbColor[2], 255];
  }

  // 2. Galleta delantera con mordida
  const frontDepth = frontCookieDepth(x, y);
  if (frontDepth > 0) {
    const [r, g, b] = shadeCookieAndChips(x, y, FRONT_COOKIE, FRONT_CHIPS, frontDepth);
    return [r, g, b, 255];
  }

  // 3. Galleta trasera (completa) con sombra proyectada por la galleta delantera
  const backDepth = BACK_COOKIE.r - Math.hypot(x - BACK_COOKIE.cx, y - BACK_COOKIE.cy);
  if (backDepth > 0) {
    let [r, g, b] = shadeCookieAndChips(x, y, BACK_COOKIE, BACK_CHIPS, backDepth);

    // Sombra proyectada de la galleta delantera sobre la trasera
    const distToFrontCenter = Math.hypot(x - (FRONT_COOKIE.cx - 0.025), y - (FRONT_COOKIE.cy - 0.01));
    if (distToFrontCenter < FRONT_COOKIE.r + 0.055) {
      const shadowStrength = 1 - smoothstep(FRONT_COOKIE.r - 0.02, FRONT_COOKIE.r + 0.055, distToFrontCenter);
      r = Math.round(r * (1 - shadowStrength * 0.28));
      g = Math.round(g * (1 - shadowStrength * 0.32));
      b = Math.round(b * (1 - shadowStrength * 0.36));
    }

    return [r, g, b, 255];
  }

  return [0, 0, 0, 0];
}

/**
 * Renderiza un icono cuadrado RGBA usando supermuestreo anti-aliased.
 * @param {number} size
 * @param {number} [samples=3]
 * @returns {Uint8Array}
 */
export function renderIconRgba(size, samples = 3) {
  const rgba = new Uint8Array(size * size * 4);
  const totalSamples = samples * samples;

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let aSum = 0;

      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const nx = (px + (sx + 0.5) / samples) / size;
          const ny = (py + (sy + 0.5) / samples) / size;
          const [sr, sg, sb, sa] = sampleEmblemPixel(nx, ny);
          const alphaWeight = sa / 255;
          rSum += sr * alphaWeight;
          gSum += sg * alphaWeight;
          bSum += sb * alphaWeight;
          aSum += sa;
        }
      }

      const idx = (py * size + px) * 4;
      const avgAlpha = aSum / totalSamples;
      if (avgAlpha > 0) {
        const norm = avgAlpha / 255;
        rgba[idx] = Math.min(255, Math.round(rSum / totalSamples / norm));
        rgba[idx + 1] = Math.min(255, Math.round(gSum / totalSamples / norm));
        rgba[idx + 2] = Math.min(255, Math.round(bSum / totalSamples / norm));
        rgba[idx + 3] = Math.min(255, Math.round(avgAlpha));
      }
    }
  }

  return rgba;
}

/**
 * Genera el archivo SVG maestro del emblema de doble galleta con mordida y migas.
 * @returns {string}
 */
export function buildMasterSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" fill="none">
  <defs>
    <radialGradient id="cookieDoughBack" cx="38%" cy="38%" r="65%">
      <stop offset="0%" stop-color="#F3C16D" />
      <stop offset="72%" stop-color="#DF9B3E" />
      <stop offset="100%" stop-color="#B96E1F" />
    </radialGradient>
    <radialGradient id="cookieDoughFront" cx="42%" cy="38%" r="65%">
      <stop offset="0%" stop-color="#F6C878" />
      <stop offset="70%" stop-color="#E3A145" />
      <stop offset="100%" stop-color="#BE7222" />
    </radialGradient>
    <mask id="frontCookieBite">
      <rect width="128" height="128" fill="#FFFFFF" />
      <circle cx="107" cy="42" r="17.5" fill="#000000" />
      <circle cx="113" cy="53" r="16" fill="#000000" />
      <circle cx="120" cy="65" r="17.5" fill="#000000" />
    </mask>
  </defs>

  <!-- Galleta trasera -->
  <g>
    <circle cx="44" cy="58" r="37.5" fill="url(#cookieDoughBack)" stroke="#B4691D" stroke-width="1.5" />
    <circle cx="36" cy="33" r="4.2" fill="#63361E" />
    <circle cx="53" cy="31" r="4.5" fill="#63361E" />
    <circle cx="27.5" cy="42.5" r="3.4" fill="#63361E" />
    <circle cx="47" cy="48" r="5.4" fill="#5A2F18" />
    <circle cx="24" cy="59.5" r="4.2" fill="#63361E" />
    <circle cx="38" cy="63.5" r="3.4" fill="#63361E" />
    <circle cx="34.5" cy="79" r="5" fill="#5A2F18" />
  </g>

  <!-- Galleta delantera con mordida -->
  <g mask="url(#frontCookieBite)">
    <circle cx="80" cy="70" r="41" fill="url(#cookieDoughFront)" stroke="#B4691D" stroke-width="1.5" />
    <circle cx="77" cy="47" r="5.6" fill="#5A2F18" />
    <circle cx="59.5" cy="61" r="4.5" fill="#63361E" />
    <circle cx="83" cy="68" r="6.4" fill="#5A2F18" />
    <circle cx="66" cy="79" r="5.5" fill="#63361E" />
    <circle cx="86" cy="91" r="4.5" fill="#63361E" />
    <circle cx="103" cy="82.5" r="5.2" fill="#5A2F18" />
  </g>

  <!-- Migas -->
  <ellipse cx="103.5" cy="43.5" rx="6" ry="5.4" fill="#E4A347" stroke="#BA6F22" stroke-width="1" />
  <circle cx="116" cy="54.5" r="3.4" fill="#E4A347" stroke="#BA6F22" stroke-width="0.8" />
  <ellipse cx="116.5" cy="68.5" rx="5.5" ry="4.3" fill="#E4A347" stroke="#BA6F22" stroke-width="1" />
</svg>
`;
}

/**
 * Genera todos los iconos PNG y el SVG maestro en src/icons/ y store/logo-300x300.png.
 * @param {string} [rootDir]
 * @returns {Array<{ file: string, size: number, bytes: number }>}
 */
export function generateAllIcons(rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')) {
  const iconsDir = path.join(rootDir, 'src', 'icons');
  const storeDir = path.join(rootDir, 'store');
  fs.mkdirSync(iconsDir, { recursive: true });
  fs.mkdirSync(storeDir, { recursive: true });

  const svgPath = path.join(iconsDir, 'icon.svg');
  fs.writeFileSync(svgPath, buildMasterSvg(), 'utf8');

  const targets = [
    { file: path.join(iconsDir, 'icon16.png'), size: 16, samples: 4 },
    { file: path.join(iconsDir, 'icon32.png'), size: 32, samples: 4 },
    { file: path.join(iconsDir, 'icon48.png'), size: 48, samples: 3 },
    { file: path.join(iconsDir, 'icon128.png'), size: 128, samples: 3 },
    { file: path.join(storeDir, 'logo-300x300.png'), size: 300, samples: 3 }
  ];

  const report = [];
  for (const target of targets) {
    const rgba = renderIconRgba(target.size, target.samples);
    const png = encodePng(target.size, target.size, rgba);
    fs.writeFileSync(target.file, png);
    report.push({ file: target.file, size: target.size, bytes: png.length });
  }

  return report;
}

const isDirectRun =
  Boolean(process.argv[1]) &&
  path.resolve(fileURLToPath(import.meta.url)).toLowerCase() ===
    path.resolve(process.argv[1]).toLowerCase();

if (isDirectRun) {
  const generated = generateAllIcons();
  for (const item of generated) {
    console.log(`[icons] ${item.size}x${item.size} -> ${item.file} (${item.bytes} bytes)`);
  }
}
