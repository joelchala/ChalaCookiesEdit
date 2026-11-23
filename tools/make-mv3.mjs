/**
 * @fileoverview Empaquetador MV3 nativo en Node.js puro (>=22) para ChalaCookiesEdit.
 * Copia src/ hacia dist/build/ChalaCookiesEdit.chromium/ y construye archivos .zip
 * estándar PKZIP en store/paquetes/ sin dependencias externas ni comandos zip/powershell.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { crc32 } from './generate-icons.mjs';

/**
 * Convierte una fecha JS a formato DOS (tiempo y fecha de 16 bits).
 * @param {Date} date
 * @returns {{ dosTime: number, dosDate: number }}
 */
function toDosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  const dosTime = ((hours & 0x1f) << 11) | ((minutes & 0x3f) << 5) | (seconds & 0x1f);
  const dosDate = (((year - 1980) & 0x7f) << 9) | ((month & 0x0f) << 5) | (day & 0x1f);
  return { dosTime, dosDate };
}

/**
 * Construye un archivo ZIP estándar PKZIP a partir de un arreglo de entradas { name, data, mtime }.
 * Usa compresión DEFLATE (método 8) o STORE (método 0) si no reduce tamaño.
 * @param {Array<{ name: string, data: Buffer | Uint8Array | string, mtime?: Date }>} entries
 * @returns {Buffer}
 */
export function createZipBuffer(entries) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const entry of entries) {
    const posixName = String(entry.name).replace(/\\/g, '/').replace(/^\/+/, '');
    const nameBuf = Buffer.from(posixName, 'utf8');
    const rawData = Buffer.isBuffer(entry.data)
      ? entry.data
      : typeof entry.data === 'string'
        ? Buffer.from(entry.data, 'utf8')
        : Buffer.from(entry.data);

    const crc = crc32(rawData);
    const deflated = zlib.deflateRawSync(rawData, { level: 9 });
    const useDeflate = deflated.length < rawData.length;
    const method = useDeflate ? 8 : 0;
    const payload = useDeflate ? deflated : rawData;

    const { dosTime, dosDate } = toDosDateTime(entry.mtime instanceof Date ? entry.mtime : new Date());
    const gpFlag = 0x0800; // UTF-8 filename encoding

    // Local File Header (30 bytes + filename)
    const lfh = Buffer.allocUnsafe(30);
    lfh.writeUInt32LE(0x04034b50, 0); // signature
    lfh.writeUInt16LE(20, 4); // version needed to extract (2.0)
    lfh.writeUInt16LE(gpFlag, 6);
    lfh.writeUInt16LE(method, 8);
    lfh.writeUInt16LE(dosTime, 10);
    lfh.writeUInt16LE(dosDate, 12);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(payload.length, 18);
    lfh.writeUInt32LE(rawData.length, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28); // extra field length

    localParts.push(lfh, nameBuf, payload);

    // Central Directory File Header (46 bytes + filename)
    const cdfh = Buffer.allocUnsafe(46);
    cdfh.writeUInt32LE(0x02014b50, 0); // signature
    cdfh.writeUInt16LE(20, 4); // version made by
    cdfh.writeUInt16LE(20, 6); // version needed
    cdfh.writeUInt16LE(gpFlag, 8);
    cdfh.writeUInt16LE(method, 10);
    cdfh.writeUInt16LE(dosTime, 12);
    cdfh.writeUInt16LE(dosDate, 14);
    cdfh.writeUInt32LE(crc, 16);
    cdfh.writeUInt32LE(payload.length, 20);
    cdfh.writeUInt32LE(rawData.length, 24);
    cdfh.writeUInt16LE(nameBuf.length, 28);
    cdfh.writeUInt16LE(0, 30); // extra length
    cdfh.writeUInt16LE(0, 32); // comment length
    cdfh.writeUInt16LE(0, 34); // disk number start
    cdfh.writeUInt16LE(0, 36); // internal attributes
    cdfh.writeUInt32LE(0, 38); // external attributes
    cdfh.writeUInt32LE(localOffset, 42);

    centralParts.push(cdfh, nameBuf);
    localOffset += lfh.length + nameBuf.length + payload.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.allocUnsafe(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // start disk
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(localOffset, 16);
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localParts, centralDir, eocd]);
}

/**
 * Recolecta recursivamente todos los archivos dentro de un directorio ordenados de forma determinista.
 * @param {string} baseDir
 * @param {string} [currentDir=baseDir]
 * @returns {Array<{ relativePath: string, fullPath: string, stat: fs.Stats }>}
 */
function collectFilesRecursive(baseDir, currentDir = baseDir) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));

  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFilesRecursive(baseDir, fullPath));
    } else if (entry.isFile()) {
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      files.push({ relativePath, fullPath, stat: fs.statSync(fullPath) });
    }
  }
  return files;
}

/**
 * Transforma un manifiesto MV3 de Chromium/Edge a formato compatible con Mozilla Firefox (AMO).
 * @param {Record<string, any>} manifest
 * @param {string} [geckoId='chalacookiesedit@chaladev.site']
 * @returns {Record<string, any>}
 */
export function toFirefoxManifest(manifest, geckoId = 'chalacookiesedit@chaladev.site') {
  const ff = structuredClone(manifest);
  ff.browser_specific_settings = {
    ...(ff.browser_specific_settings || {}),
    gecko: {
      ...(ff.browser_specific_settings?.gecko || {}),
      id: geckoId,
      strict_min_version: '113.0'
    }
  };
  if (ff.background && ff.background.service_worker) {
    const { service_worker: sw, ...rest } = ff.background;
    ff.background = {
      scripts: [sw],
      ...rest
    };
  }
  return ff;
}

/**
 * Extrae el contenido de una entrada específica desde un buffer ZIP estándar PKZIP.
 * @param {Buffer} zipBuffer
 * @param {string} targetName
 * @returns {Buffer | null}
 */
export function extractZipEntry(zipBuffer, targetName) {
  let eocdOffset = -1;
  for (let i = zipBuffer.length - 22; i >= Math.max(0, zipBuffer.length - 65557); i -= 1) {
    if (zipBuffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error('Archivo ZIP inválido: falta firma EOCD');
  }
  const totalEntries = zipBuffer.readUInt16LE(eocdOffset + 10);
  const cdOffset = zipBuffer.readUInt32LE(eocdOffset + 16);

  let cursor = cdOffset;
  for (let i = 0; i < totalEntries; i += 1) {
    if (zipBuffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error('Archivo ZIP inválido: Central Directory corrupto');
    }
    const method = zipBuffer.readUInt16LE(cursor + 10);
    const compSize = zipBuffer.readUInt32LE(cursor + 20);
    const nameLen = zipBuffer.readUInt16LE(cursor + 28);
    const extraLen = zipBuffer.readUInt16LE(cursor + 30);
    const commentLen = zipBuffer.readUInt16LE(cursor + 32);
    const localOffset = zipBuffer.readUInt32LE(cursor + 42);
    const entryName = zipBuffer.subarray(cursor + 46, cursor + 46 + nameLen).toString('utf8');

    if (entryName === targetName) {
      const lfhNameLen = zipBuffer.readUInt16LE(localOffset + 26);
      const lfhExtraLen = zipBuffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + lfhNameLen + lfhExtraLen;
      const compData = zipBuffer.subarray(dataStart, dataStart + compSize);
      return method === 8 ? zlib.inflateRawSync(compData) : Buffer.from(compData);
    }
    cursor += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

/**
 * Compila dist/build/ChalaCookiesEdit.chromium/ y genera los paquetes .zip para Chromium, Edge y Firefox (AMO).
 * @param {string} [rootDir]
 * @returns {{ version: string, unpackedDir: string, packages: string[], fileCount: number }}
 */
export function buildMv3Packages(rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')) {
  const versionPath = path.join(rootDir, 'dist', 'version');
  const srcDir = path.join(rootDir, 'src');
  const manifestPath = path.join(srcDir, 'manifest.json');
  const unpackedDir = path.join(rootDir, 'dist', 'build', 'ChalaCookiesEdit.chromium');
  const packagesDir = path.join(rootDir, 'store', 'paquetes');
  const buildDir = path.join(rootDir, 'dist', 'build');

  const version = fs.readFileSync(versionPath, 'utf8').trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Versión inválida en dist/version: "${version}"`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.version !== version) {
    throw new Error(`Desajuste de versión: manifest.json=${manifest.version} vs dist/version=${version}`);
  }

  for (const size of [16, 32, 48, 128]) {
    const iconFile = path.join(srcDir, 'icons', `icon${size}.png`);
    if (!fs.existsSync(iconFile)) {
      throw new Error(`Falta el icono requerido ${iconFile}. Ejecuta "npm run icons" primero.`);
    }
  }

  fs.rmSync(unpackedDir, { recursive: true, force: true });
  fs.mkdirSync(unpackedDir, { recursive: true });
  fs.cpSync(srcDir, unpackedDir, { recursive: true });

  const files = collectFilesRecursive(unpackedDir);
  const zipEntries = files.map((file) => ({
    name: file.relativePath,
    data: fs.readFileSync(file.fullPath),
    mtime: file.stat.mtime
  }));

  const zipBuffer = createZipBuffer(zipEntries);
  const firefoxManifestBuf = Buffer.from(`${JSON.stringify(toFirefoxManifest(manifest), null, 2)}\n`, 'utf8');
  const firefoxEntries = zipEntries.map((entry) =>
    entry.name === 'manifest.json'
      ? { name: entry.name, data: firefoxManifestBuf, mtime: entry.mtime }
      : entry
  );
  const firefoxZipBuffer = createZipBuffer(firefoxEntries);

  fs.mkdirSync(packagesDir, { recursive: true });
  fs.mkdirSync(buildDir, { recursive: true });
  const chromiumZip = path.join(packagesDir, `ChalaCookiesEdit_${version}.chromium.zip`);
  const edgeZip = path.join(packagesDir, `ChalaCookiesEdit_${version}.edge.zip`);
  const firefoxZip = path.join(packagesDir, `ChalaCookiesEdit_${version}.firefox.zip`);
  const buildChromiumZip = path.join(buildDir, `ChalaCookiesEdit_${version}.chromium.zip`);
  const buildEdgeZip = path.join(buildDir, `ChalaCookiesEdit_${version}.edge.zip`);
  const buildFirefoxZip = path.join(buildDir, `ChalaCookiesEdit_${version}.firefox.zip`);

  for (const outPath of [chromiumZip, edgeZip, buildChromiumZip, buildEdgeZip]) {
    fs.writeFileSync(outPath, zipBuffer);
  }
  for (const outPath of [firefoxZip, buildFirefoxZip]) {
    fs.writeFileSync(outPath, firefoxZipBuffer);
  }

  return {
    version,
    unpackedDir,
    packages: [chromiumZip, edgeZip, firefoxZip],
    fileCount: zipEntries.length
  };
}

const isDirectRun =
  Boolean(process.argv[1]) &&
  path.resolve(fileURLToPath(import.meta.url)).toLowerCase() ===
    path.resolve(process.argv[1]).toLowerCase();

if (isDirectRun) {
  const result = buildMv3Packages();
  console.log(`[build] ChalaCookiesEdit v${result.version} (${result.fileCount} archivos)`);
  console.log(`[build] Descomprimido -> ${result.unpackedDir}`);
  for (const pkg of result.packages) {
    const size = fs.statSync(pkg).size;
    console.log(`[build] Paquete ZIP -> ${pkg} (${size} bytes)`);
  }
}
