/**
 * @fileoverview Generador nativo de iconos PNG y SVG para ChalaCookiesEdit (Suite Chala).
 * Utiliza exclusivamente APIs nativas de Node.js (node:fs, node:path, node:zlib, node:url)
 * sin dependencias externas.
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

/**
 * Evalúa la distancia firmada aproximada al contorno del escudo cibernético.
 * Valores <= 0 están dentro del escudo.
 * @param {number} x Normalizado [0, 1]
 * @param {number} y Normalizado [0, 1]
 * @returns {number}
 */
function shieldSignedDistance(x, y) {
  const dx = Math.abs(x - 0.5);
  const topY = 0.08 + 0.06 * Math.pow(dx / 0.39, 1.5);
  if (y < topY) {
    return topY - y;
  }

  let halfWidth;
  if (y <= 0.48) {
    halfWidth = 0.39 - (y - 0.08) * 0.05;
  } else {
    const t = Math.min(1, (y - 0.48) / 0.44);
    halfWidth = 0.37 * Math.pow(1 - t, 0.72);
  }

  if (y > 0.92) {
    return Math.hypot(dx, y - 0.92);
  }

  return dx - halfWidth;
}

/**
 * Calcula el color RGBA [0..255] de un subpíxel del emblema Escudo + Cookie.
 * @param {number} x
 * @param {number} y
 * @returns {[number, number, number, number]}
 */
function sampleEmblemPixel(x, y) {
  const distShield = shieldSignedDistance(x, y);
  if (distShield > 0) {
    return [0, 0, 0, 0];
  }

  // Borde exterior esmeralda (#10B981)
  if (distShield > -0.052) {
    return [16, 185, 129, 255];
  }

  // Borde sutil interior cian (#06B6D4)
  if (distShield > -0.072) {
    return [6, 182, 212, 230];
  }

  // Fondo del escudo: #0F172A con gradiente sutil hacia #1E293B en el centro
  const centerDist = Math.hypot(x - 0.5, y - 0.48);
  const glow = Math.max(0, 1 - centerDist / 0.45);
  let r = Math.round(15 + glow * 15);
  let g = Math.round(23 + glow * 18);
  let b = Math.round(42 + glow * 26);

  // Cookie central con mordida superior derecha
  const cx = 0.5;
  const cy = 0.52;
  const cookieRadius = 0.21;
  const biteDist = Math.hypot(x - 0.65, y - 0.39);
  const cookieDist = Math.hypot(x - cx, y - cy);

  if (cookieDist <= cookieRadius && biteDist > 0.082) {
    if (cookieDist >= cookieRadius - 0.032) {
      // Aro cian de la cookie (#06B6D4)
      return [6, 182, 212, 255];
    }

    // Cuerpo cookie (#1E293B)
    r = 30;
    g = 41;
    b = 59;

    // Chispas de datos esmeralda y cian
    const chips = [
      { x: 0.43, y: 0.46, rad: 0.034, color: [16, 185, 129] },
      { x: 0.55, y: 0.56, rad: 0.036, color: [16, 185, 129] },
      { x: 0.45, y: 0.60, rad: 0.028, color: [6, 182, 212] },
      { x: 0.54, y: 0.45, rad: 0.024, color: [241, 245, 249] }
    ];

    for (const chip of chips) {
      if (Math.hypot(x - chip.x, y - chip.y) <= chip.rad) {
        return [chip.color[0], chip.color[1], chip.color[2], 255];
      }
    }
  }

  return [r, g, b, 255];
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
 * Genera el archivo SVG maestro del emblema Escudo Cibernético + Cookie.
 * @returns {string}
 */
export function buildMasterSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" fill="none">
  <defs>
    <linearGradient id="shieldBg" x1="16" y1="12" x2="112" y2="118" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#1E293B" />
      <stop offset="100%" stop-color="#0F172A" />
    </linearGradient>
    <mask id="cookieBite">
      <rect width="128" height="128" fill="#FFFFFF" />
      <circle cx="83" cy="50" r="10.5" fill="#000000" />
    </mask>
  </defs>
  <path
    d="M64 10L110 26V60C110 88.5 90.4 109.2 64 118C37.6 109.2 18 88.5 18 60V26L64 10Z"
    fill="url(#shieldBg)"
    stroke="#10B981"
    stroke-width="6"
    stroke-linejoin="round"
  />
  <path
    d="M64 16L104 30V60C104 84.8 87.2 103.1 64 111.2C40.8 103.1 24 84.8 24 60V30L64 16Z"
    stroke="#06B6D4"
    stroke-opacity="0.55"
    stroke-width="2"
    stroke-linejoin="round"
  />
  <g mask="url(#cookieBite)">
    <circle cx="64" cy="66" r="26" fill="#1E293B" stroke="#06B6D4" stroke-width="4" />
    <circle cx="55" cy="59" r="4.2" fill="#10B981" />
    <circle cx="70" cy="72" r="4.5" fill="#10B981" />
    <circle cx="57" cy="77" r="3.5" fill="#06B6D4" />
    <circle cx="69" cy="57" r="3" fill="#F1F5F9" />
  </g>
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
    { file: path.join(storeDir, 'logo-300x300.png'), size: 300, samples: 2 }
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
