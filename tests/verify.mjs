/**
 * @fileoverview Suite integral de verificación para ChalaCookiesEdit (Suite Chala).
 * Utiliza exclusivamente APIs nativas de Node.js (node:assert/strict, node:fs,
 * node:path, node:child_process, node:zlib, node:url) sin dependencias externas.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  buildCookieRemovalDetails,
  buildCookieSetDetails,
  buildCookieUrl,
  classifyImportedCookies,
  detectAndParseCookies,
  exportCookiesToJson,
  exportCookiesToNetscape,
  getBlockedCookieKey,
  getCookiesForTabUrl,
  isPartitionedCookie,
  isRestrictedUrl,
  isValidCookieDomain,
  isValidHostname,
  parseCookiesFromJson,
  parseCookiesFromNetscape,
  resolveCookieStoreId
} from '../src/lib/cookie-formats.js';
import {
  formatJwtRelativeTime,
  inspectJwt,
  isLikelyJwt
} from '../src/lib/jwt-inspector.js';
import {
  BADGE_DEBOUNCE_MS,
  createBadgeScheduler,
  handleCookieChanged,
  handleMessage,
  loadBlockedCookies,
  updateBadgeForTab
} from '../src/background.js';
import { crc32 } from '../tools/generate-icons.mjs';
import { createZipBuffer } from '../tools/make-mv3.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;

/**
 * Ejecuta un bloque de prueba síncrono o asíncrono reportando progreso.
 * @param {string} name
 * @param {() => void | Promise<void>} fn
 */
async function runTest(name, fn) {
  await fn();
  passed += 1;
  console.log(`  [PASS] ${name}`);
}

/**
 * Recolecta recursivamente archivos con ciertas extensiones.
 * @param {string} dir
 * @param {string[]} exts
 * @returns {string[]}
 */
function collectByExt(dir, exts) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectByExt(full, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Codifica un objeto JSON en Base64URL para construir JWTs de prueba.
 * @param {Record<string, any>} obj
 * @returns {string}
 */
function toBase64UrlJson(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

console.log('=== ChalaCookiesEdit Verification Suite ===');

// 1. Sintaxis de todos los archivos JS/MJS
await runTest('1. Sintaxis válida (node --check) en src/, tools/ y tests/', () => {
  const jsFiles = [
    ...collectByExt(path.join(ROOT_DIR, 'src'), ['.js', '.mjs']),
    ...collectByExt(path.join(ROOT_DIR, 'tools'), ['.js', '.mjs']),
    ...collectByExt(path.join(ROOT_DIR, 'tests'), ['.js', '.mjs'])
  ];
  assert.ok(jsFiles.length >= 8, `Se esperaban al menos 8 archivos JS/MJS, encontrados: ${jsFiles.length}`);
  for (const file of jsFiles) {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  }
});

// 2. Estructura exacta de archivos obligatorios
await runTest('2. Estructura obligatoria de directorios y archivos presente', () => {
  const requiredPaths = [
    '.github/workflows/build.yml',
    '.gitignore',
    'LICENSE.txt',
    'PRIVACY.md',
    'README.md',
    'package.json',
    'dist/README.md',
    'dist/version',
    'docs/README.md',
    'docs/index.html',
    'src/manifest.json',
    'src/background.js',
    'src/config.js',
    'src/_locales/es/messages.json',
    'src/_locales/en/messages.json',
    'src/icons/icon.svg',
    'src/icons/icon16.png',
    'src/icons/icon32.png',
    'src/icons/icon48.png',
    'src/icons/icon128.png',
    'src/lib/cookie-formats.js',
    'src/lib/jwt-inspector.js',
    'src/popup/index.html',
    'src/popup/styles.css',
    'src/popup/app.js',
    'store/ficha-tienda.md',
    'store/ficha-chrome-web-store.md',
    'store/README-activos.md',
    'store/logo-300x300.png',
    'tests/verify.mjs',
    'tools/generate-icons.mjs',
    'tools/make-mv3.mjs',
    'tools/make-mv3.sh',
    'tools/make-clean.sh'
  ];

  for (const rel of requiredPaths) {
    const full = path.join(ROOT_DIR, rel);
    assert.ok(fs.existsSync(full), `Falta archivo requerido: ${rel}`);
  }
});

// 3. Validación de package.json (0 dependencias y Node >=22)
await runTest('3. package.json cumple cero dependencias, type: module y Node >=22', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.dependencies, undefined, 'No debe tener dependencies');
  assert.equal(pkg.devDependencies, undefined, 'No debe tener devDependencies');
  assert.match(String(pkg.engines?.node || ''), /22/);
  for (const script of ['build', 'icons', 'test', 'clean']) {
    assert.ok(typeof pkg.scripts?.[script] === 'string' && pkg.scripts[script].length > 0);
  }
});

// 4. Validación MV3 manifest.json y PNG reales (IHDR)
await runTest('4. manifest.json MV3 e iconos PNG válidos con dimensiones exactas', () => {
  const version = fs.readFileSync(path.join(ROOT_DIR, 'dist', 'version'), 'utf8').trim();
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'src', 'manifest.json'), 'utf8'));

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, version);
  assert.ok(
    typeof manifest.short_name === 'string' && manifest.short_name.length > 0 && manifest.short_name.length <= 12,
    `manifest.short_name debe tener entre 1 y 12 caracteres (actual: "${manifest.short_name}", longitud: ${manifest.short_name?.length})`
  );
  assert.equal(manifest.default_locale, 'es');
  assert.deepEqual(manifest.permissions, ['cookies', 'storage']);
  assert.equal(manifest.permissions.includes('activeTab'), false);
  assert.deepEqual(manifest.host_permissions, ['http://*/*', 'https://*/*']);
  assert.equal(manifest.host_permissions.includes('<all_urls>'), false);
  assert.equal(manifest.background?.service_worker, 'background.js');
  assert.equal(manifest.background?.type, 'module');

  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const expectedPngs = [
    { rel: 'src/icons/icon16.png', size: 16 },
    { rel: 'src/icons/icon32.png', size: 32 },
    { rel: 'src/icons/icon48.png', size: 48 },
    { rel: 'src/icons/icon128.png', size: 128 },
    { rel: 'store/logo-300x300.png', size: 300 }
  ];

  for (const item of expectedPngs) {
    const buf = fs.readFileSync(path.join(ROOT_DIR, item.rel));
    assert.ok(buf.subarray(0, 8).equals(pngSignature), `Firma PNG inválida en ${item.rel}`);
    assert.equal(buf.subarray(12, 16).toString('ascii'), 'IHDR');
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    assert.equal(width, item.size, `Ancho incorrecto en ${item.rel}`);
    assert.equal(height, item.size, `Alto incorrecto en ${item.rel}`);
  }
});

// 5. Validación i18n (paridad de claves y extDescription <= 132 caracteres)
await runTest('5. i18n completo (ES/EN), paridad de claves y descripción <= 132 chars', () => {
  const es = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'src', '_locales', 'es', 'messages.json'), 'utf8'));
  const en = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'src', '_locales', 'en', 'messages.json'), 'utf8'));

  const esKeys = Object.keys(es).sort();
  const enKeys = Object.keys(en).sort();
  assert.deepEqual(esKeys, enKeys, 'Las claves i18n de ES y EN deben coincidir exactamente');

  assert.ok(
    es.extDescription.message.length <= 132,
    `extDescription ES excede 132 chars: ${es.extDescription.message.length}`
  );
  assert.ok(
    en.extDescription.message.length <= 132,
    `extDescription EN excede 132 chars: ${en.extDescription.message.length}`
  );

  const popupHtml = fs.readFileSync(path.join(ROOT_DIR, 'src', 'popup', 'index.html'), 'utf8');
  for (const match of popupHtml.matchAll(/data-i18n(?:-[a-z]+)?="([^"]+)"/g)) {
    const key = match[1];
    assert.ok(es[key]?.message, `Falta clave i18n ES para ${key}`);
    assert.ok(en[key]?.message, `Falta clave i18n EN para ${key}`);
  }
});

// 6. Validación de fichas store y PRIVACY.md
await runTest('6. Fichas de tienda, activos y PRIVACY.md contienen justificaciones y medidas', () => {
  const edgeDoc = fs.readFileSync(path.join(ROOT_DIR, 'store', 'ficha-tienda.md'), 'utf8');
  const cwsDoc = fs.readFileSync(path.join(ROOT_DIR, 'store', 'ficha-chrome-web-store.md'), 'utf8');
  const assetsDoc = fs.readFileSync(path.join(ROOT_DIR, 'store', 'README-activos.md'), 'utf8');
  const privacyDoc = fs.readFileSync(path.join(ROOT_DIR, 'PRIVACY.md'), 'utf8');

  for (const doc of [edgeDoc, cwsDoc, privacyDoc]) {
    assert.ok(doc.includes('cookies'), 'Falta referencia a permiso cookies');
    assert.ok(doc.includes('http://*/*'), 'Falta justificación de http://*/*');
    assert.ok(doc.includes('https://*/*'), 'Falta justificación de https://*/*');
  }

  for (const dim of ['1280x800', '440x280', '1400x560', '300x300']) {
    assert.ok(assetsDoc.includes(dim), `Falta dimensión ${dim} en store/README-activos.md`);
  }
});

// 7. Seguridad CSP en src/
await runTest('7. Cumplimiento estricto CSP en src/ (sin inline scripts, on*= ni eval)', () => {
  const popupHtml = fs.readFileSync(path.join(ROOT_DIR, 'src', 'popup', 'index.html'), 'utf8');
  assert.equal(/\son[a-z]+\s*=/i.test(popupHtml), false, 'No debe haber handlers inline on*= en popup HTML');

  for (const m of popupHtml.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    assert.ok(/\bsrc\s*=/.test(m[1]), 'Todo <script> en src/popup/index.html debe ser externo');
    assert.equal(m[2].trim(), '', 'No se permiten scripts inline en src/popup/index.html');
  }

  for (const file of collectByExt(path.join(ROOT_DIR, 'src'), ['.js', '.mjs'])) {
    const code = fs.readFileSync(file, 'utf8');
    assert.equal(/\beval\s*\(/.test(code), false, `Uso prohibido de eval() en ${file}`);
    assert.equal(/\bnew\s+Function\s*\(/.test(code), false, `Uso prohibido de new Function() en ${file}`);
  }
});

// 8. Pruebas unitarias de cookie-formats.js
await runTest('8. cookie-formats.js: URLs restringidas, set rules, JSON y Netscape round-trip', async () => {
  assert.equal(isRestrictedUrl('chrome://extensions'), true);
  assert.equal(isRestrictedUrl('edge://settings'), true);
  assert.equal(isRestrictedUrl('about:blank'), true);
  assert.equal(isRestrictedUrl('chrome-extension://abcdef/popup.html'), true);
  assert.equal(isRestrictedUrl(''), true);
  assert.equal(isRestrictedUrl('https://app.example.com/dashboard'), false);
  assert.equal(isRestrictedUrl('http://localhost:8080/'), false);

  assert.equal(
    buildCookieUrl({ domain: '.api.example.com', path: 'v1/auth', secure: true }, 'http:'),
    'https://api.example.com/v1/auth'
  );
  assert.equal(
    buildCookieUrl({ domain: 'localhost', path: '/', secure: false }, 'http:'),
    'http://localhost/'
  );

  // Regla SameSite=no_restriction -> fuerza secure=true y https://
  const noneDetails = buildCookieSetDetails(
    {
      name: 'cross_site',
      value: 'v1',
      domain: 'example.com',
      path: '/',
      sameSite: 'no_restriction',
      secure: false
    },
    { tabUrl: 'http://example.com/login' }
  );
  assert.equal(noneDetails.secure, true);
  assert.ok(noneDetails.url.startsWith('https://'));
  assert.equal('domain' in noneDetails, false, 'Host-only no debe incluir propiedad domain');

  // Subdominio con punto inicial -> incluye domain
  const subDetails = buildCookieSetDetails(
    {
      name: 'shared',
      value: 'ok',
      domain: '.example.com',
      path: '/app',
      session: true
    },
    { tabUrl: 'https://sub.example.com/' }
  );
  assert.equal(subDetails.domain, '.example.com');
  assert.equal(subDetails.url, 'https://example.com/app');
  assert.equal('expirationDate' in subDetails, false, 'Cookie de sesión no debe enviar expirationDate');

  // Round-trip JSON y Netscape cookies.txt
  const sampleCookies = [
    {
      name: 'sid',
      value: 'abc=123\tpart',
      domain: '.example.com',
      hostOnly: false,
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
      session: false,
      expirationDate: 1893456000
    },
    {
      name: 'prefs',
      value: 'dark',
      domain: 'app.example.com',
      hostOnly: true,
      path: '/panel',
      secure: false,
      httpOnly: false,
      sameSite: 'strict',
      session: true
    }
  ];

  const jsonStr = exportCookiesToJson(sampleCookies);
  const parsedJson = parseCookiesFromJson(jsonStr);
  assert.equal(parsedJson.length, 2);
  assert.equal(parsedJson[0].name, 'sid');
  assert.equal(parsedJson[1].session, true);

  const netscapeStr = exportCookiesToNetscape(sampleCookies);
  assert.ok(netscapeStr.includes('#HttpOnly_.example.com\tTRUE\t/\tTRUE\t1893456000\tsid\tabc=123\tpart'));
  const parsedNetscape = parseCookiesFromNetscape(netscapeStr);
  assert.equal(parsedNetscape.length, 2);
  assert.equal(parsedNetscape[0].httpOnly, true);
  assert.equal(parsedNetscape[0].hostOnly, false);
  assert.equal(parsedNetscape[0].value, 'abc=123\tpart');
  assert.equal(parsedNetscape[1].hostOnly, true);
  assert.equal(parsedNetscape[1].session, true);

  assert.equal(detectAndParseCookies(jsonStr).format, 'json');
  assert.equal(detectAndParseCookies(netscapeStr).format, 'netscape');

  // Deduplicación getCookiesForTabUrl
  const mockCookiesApi = {
    async getAll(query) {
      if (query.url) return [sampleCookies[0], sampleCookies[1]];
      return [sampleCookies[0]];
    }
  };
  const merged = await getCookiesForTabUrl(mockCookiesApi, 'https://app.example.com/panel');
  assert.equal(merged.length, 2);
});

// 9. Pruebas unitarias de jwt-inspector.js
await runTest('9. jwt-inspector.js: detección, decodificación UTF-8 y verificación exp/nbf', () => {
  const nowMs = 1_700_000_000_000;
  const nowSec = Math.floor(nowMs / 1000);

  const validJwt = [
    toBase64UrlJson({ alg: 'HS256', typ: 'JWT' }),
    toBase64UrlJson({ sub: 'u-1', name: 'Joel Chala García', iat: nowSec - 60, exp: nowSec + 3600 }),
    'sig_part_123'
  ].join('.');

  assert.equal(isLikelyJwt(validJwt), true);
  const infoValid = inspectJwt(validJwt, nowMs);
  assert.ok(infoValid);
  assert.equal(infoValid.status, 'valid');
  assert.equal(infoValid.isExpired, false);
  assert.equal(infoValid.payload.name, 'Joel Chala García');
  assert.equal(infoValid.remainingSeconds, 3600);
  assert.ok(formatJwtRelativeTime(infoValid.remainingSeconds, 'es').startsWith('Expira en'));

  const expiredJwt = [
    toBase64UrlJson({ alg: 'RS256', typ: 'JWT' }),
    toBase64UrlJson({ sub: 'u-2', exp: nowSec - 120 }),
    'sig_part_456'
  ].join('.');
  const infoExpired = inspectJwt(`Bearer ${expiredJwt}`, nowMs);
  assert.ok(infoExpired);
  assert.equal(infoExpired.status, 'expired');
  assert.equal(infoExpired.isExpired, true);
  assert.ok(formatJwtRelativeTime(infoExpired.remainingSeconds, 'en').startsWith('Expired'));

  const noExpJwt = [
    toBase64UrlJson({ alg: 'HS256' }),
    toBase64UrlJson({ role: 'admin' }),
    'sig_part_789'
  ].join('.');
  const infoNoExp = inspectJwt(noExpJwt, nowMs);
  assert.ok(infoNoExp);
  assert.equal(infoNoExp.status, 'no_exp');
  assert.equal(infoNoExp.expiresAt, null);

  assert.equal(isLikelyJwt('simple_session_value'), false);
  assert.equal(inspectJwt('abc.def'), null);
  assert.equal(inspectJwt(''), null);
});

// 10. Pruebas unitarias de background.js con API chrome simulada
await runTest('10. background.js: bloqueo onChanged, prevención de bucle, desbloqueo y badge', async () => {
  const store = {};
  const removedCalls = [];
  const badgeCalls = [];
  const activeCookies = [
    { name: 'tracker', value: '1', domain: '.Example.COM', path: '/', secure: true },
    { name: 'sid', value: 'ok', domain: 'example.com', path: '/', secure: true }
  ];

  const mockChrome = {
    storage: {
      local: {
        async get(key) {
          return { [key]: store[key] };
        },
        async set(obj) {
          Object.assign(store, obj);
        }
      }
    },
    cookies: {
      async getAll() {
        return activeCookies;
      },
      async remove(details) {
        removedCalls.push(details);
        return details;
      }
    },
    tabs: {
      async query() {
        return [{ id: 7, url: 'https://example.com/home' }];
      }
    },
    action: {
      async setBadgeText(args) {
        badgeCalls.push(args);
      },
      async setBadgeBackgroundColor() {},
      async setBadgeTextColor() {}
    }
  };

  const cacheRef = { list: null };

  // Bloqueo inicial
  const blockRes = await handleMessage(
    mockChrome,
    {
      type: 'BLOCK_COOKIE',
      domain: '.Example.COM',
      name: 'tracker',
      cookie: activeCookies[0]
    },
    cacheRef
  );
  assert.equal(blockRes.ok, true);
  assert.equal(blockRes.blocked.length, 1);
  assert.equal(removedCalls.length, 1);
  assert.equal(removedCalls[0].name, 'tracker');

  const stored = await loadBlockedCookies(mockChrome.storage.local);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].domain, 'example.com');

  // El sitio intenta recrear la cookie bloqueada -> debe eliminarse automáticamente
  const recreateRes = await handleCookieChanged(
    mockChrome,
    {
      removed: false,
      cookie: { name: 'tracker', value: 'new', domain: 'example.com', path: '/', secure: true }
    },
    cacheRef
  );
  assert.equal(recreateRes.removed, true);
  assert.equal(removedCalls.length, 2);

  // Evento removed: true no debe reintentar cookies.remove (sin bucle infinito)
  const removedEventRes = await handleCookieChanged(
    mockChrome,
    {
      removed: true,
      cookie: { name: 'tracker', value: 'new', domain: 'example.com', path: '/', secure: true }
    },
    cacheRef
  );
  assert.equal(removedEventRes.removed, false);
  assert.equal(removedCalls.length, 2);

  // Desbloqueo
  const unblockRes = await handleMessage(
    mockChrome,
    { type: 'UNBLOCK_COOKIE', domain: 'example.com', name: 'tracker' },
    cacheRef
  );
  assert.equal(unblockRes.ok, true);
  assert.equal(unblockRes.blocked.length, 0);

  const afterUnblock = await handleCookieChanged(
    mockChrome,
    {
      removed: false,
      cookie: { name: 'tracker', value: 'ok', domain: 'example.com', path: '/', secure: true }
    },
    cacheRef
  );
  assert.equal(afterUnblock.removed, false);

  // Badge en URL normal y en URL restringida
  const normalCount = await updateBadgeForTab(mockChrome, 7, 'https://example.com/');
  assert.equal(normalCount, 2);
  assert.equal(badgeCalls.at(-1).text, '2');

  const restrictedCount = await updateBadgeForTab(mockChrome, 7, 'chrome://settings');
  assert.equal(restrictedCount, 0);
  assert.equal(badgeCalls.at(-1).text, '');
});

// 11. Validación binaria PKZIP del empaquetador nativo (tools/make-mv3.mjs)
await runTest('11. createZipBuffer genera estructura PKZIP estándar e inflado exacto', () => {
  const sampleEntries = [
    { name: 'manifest.json', data: Buffer.from('{"manifest_version":3,"name":"Test"}', 'utf8') },
    { name: 'sub/UTF8-árbol.txt', data: Buffer.from('Contenido repetitivo '.repeat(40), 'utf8') }
  ];

  const zip = createZipBuffer(sampleEntries);

  // End of Central Directory en los últimos 22 bytes (comentario=0)
  const eocdOffset = zip.length - 22;
  assert.equal(zip.readUInt32LE(eocdOffset), 0x06054b50, 'Firma EOCD inválida');
  const totalEntries = zip.readUInt16LE(eocdOffset + 10);
  const cdOffset = zip.readUInt32LE(eocdOffset + 16);
  assert.equal(totalEntries, sampleEntries.length);

  let cursor = cdOffset;
  for (let i = 0; i < totalEntries; i += 1) {
    assert.equal(zip.readUInt32LE(cursor), 0x02014b50, 'Firma Central Directory inválida');
    const method = zip.readUInt16LE(cursor + 10);
    const expectedCrc = zip.readUInt32LE(cursor + 16);
    const compSize = zip.readUInt32LE(cursor + 20);
    const nameLen = zip.readUInt16LE(cursor + 28);
    const extraLen = zip.readUInt16LE(cursor + 30);
    const commentLen = zip.readUInt16LE(cursor + 32);
    const localOffset = zip.readUInt32LE(cursor + 42);

    const entryName = zip.subarray(cursor + 46, cursor + 46 + nameLen).toString('utf8');
    assert.equal(entryName, sampleEntries[i].name);

    // Verificar Local File Header y descomprimir
    assert.equal(zip.readUInt32LE(localOffset), 0x04034b50, 'Firma Local File Header inválida');
    const lfhNameLen = zip.readUInt16LE(localOffset + 26);
    const lfhExtraLen = zip.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + lfhNameLen + lfhExtraLen;
    const compData = zip.subarray(dataStart, dataStart + compSize);

    const inflated = method === 8 ? zlib.inflateRawSync(compData) : compData;
    assert.equal(crc32(inflated), expectedCrc);
    assert.ok(inflated.equals(sampleEntries[i].data));

    cursor += 46 + nameLen + extraLen + commentLen;
  }
});

// 12. S1 y S2: Validación estricta de dominio y protección contra Session Fixation
await runTest('12. S1/S2: rechazo de dominios maliciosos (a.com@evil.com) y filtrado cross-domain', () => {
  assert.equal(isValidHostname('example.com'), true);
  assert.equal(isValidHostname('sub-1.api.example.com'), true);
  assert.equal(isValidCookieDomain('.example.com'), true);

  for (const bad of [
    'a.com@evil.com',
    'user:pass@evil.com',
    'example.com:8080',
    'example.com/path',
    'example.com?x=1',
    'example.com#hash',
    'exa mple.com',
    '-bad.example.com',
    'bad-.example.com',
    'example..com'
  ]) {
    assert.equal(isValidCookieDomain(bad), false, `Debió rechazar dominio: "${bad}"`);
    assert.throws(() => buildCookieUrl({ domain: bad, path: '/' }), /Dominio de cookie inválido/);
    assert.throws(
      () => buildCookieSetDetails({ name: 'sid', value: '1', domain: bad }, { tabUrl: 'https://a.com/' }),
      /Dominio de cookie inválido/
    );
  }
  assert.equal(isValidCookieDomain(''), false);
  assert.throws(() => buildCookieUrl({ domain: '', path: '/' }), /dominio válido/);

  // Ruta con query/fragmento embebido también se rechaza
  assert.throws(() => buildCookieUrl({ domain: 'example.com', path: '/a?b=1' }), /Ruta de cookie inválida/);

  // Clasificación de importación (S1): solo el host activo y sus subdominios entran por defecto
  const batch = [
    { name: 'ok_exact', value: '1', domain: 'app.example.com' },
    { name: 'ok_sub', value: '1', domain: '.sub.app.example.com' },
    { name: 'ok_empty', value: '1', domain: '' },
    { name: 'ext_parent', value: '1', domain: '.example.com' },
    { name: 'ext_other', value: '1', domain: 'mibanco.com' },
    { name: 'bad_inj', value: '1', domain: 'app.example.com@evil.com' }
  ];
  const classified = classifyImportedCookies(batch, 'app.example.com');
  assert.deepEqual(
    classified.allowed.map((c) => c.name),
    ['ok_exact', 'ok_sub', 'ok_empty']
  );
  assert.deepEqual(
    classified.external.map((c) => c.name),
    ['ext_parent', 'ext_other']
  );
  assert.deepEqual(classified.externalDomains, ['example.com', 'mibanco.com']);
  assert.deepEqual(
    classified.invalid.map((c) => c.name),
    ['bad_inj']
  );
});

// 13. B1 y B2: Cookies particionadas (CHIPS) y aislamiento de storeId (modo incógnito)
await runTest('13. B1/B2: soporte de partitionKey (CHIPS) y aislamiento por storeId en incógnito', async () => {
  const mockCookiesApi = {
    calls: [],
    async getAllCookieStores() {
      return [
        { id: '0', tabIds: [1, 2] },
        { id: '1', tabIds: [99] }
      ];
    },
    async getAll(query) {
      this.calls.push(query);
      if (query.url) {
        return [
          {
            name: 'embed_state',
            value: 'unpartitioned',
            domain: '.widget.example.com',
            path: '/',
            secure: true,
            storeId: query.storeId
          },
          {
            name: 'embed_state',
            value: 'partitioned_val',
            domain: '.widget.example.com',
            path: '/',
            secure: true,
            storeId: query.storeId,
            partitionKey: { topLevelSite: 'https://news.site', hasCrossSiteAncestor: true }
          }
        ];
      }
      return [];
    }
  };

  const incognitoStore = await resolveCookieStoreId(mockCookiesApi, 99);
  assert.equal(incognitoStore, '1');

  const list = await getCookiesForTabUrl(mockCookiesApi, 'https://widget.example.com/', {
    storeId: incognitoStore
  });
  // Mismo nombre/dominio pero distinta partitionKey -> ambas se conservan sin colisionar
  assert.equal(list.length, 2);
  assert.ok(mockCookiesApi.calls.every((q) => q.storeId === '1' && 'partitionKey' in q));
  assert.equal(isPartitionedCookie(list[0]), false);
  assert.equal(isPartitionedCookie(list[1]), true);

  // Set y remove preservan partitionKey y el storeId de la pestaña
  const setDetails = buildCookieSetDetails(
    {
      name: '__Host-chips',
      value: 'v',
      domain: 'widget.example.com',
      path: '/',
      secure: false,
      storeId: '0',
      partitionKey: { topLevelSite: 'https://news.site' }
    },
    { tabUrl: 'https://widget.example.com/', storeId: '1' }
  );
  assert.equal(setDetails.storeId, '1', 'options.storeId debe prevalecer sobre el storeId del payload');
  assert.equal(setDetails.secure, true, 'CHIPS requiere Secure=true');
  assert.deepEqual(setDetails.partitionKey, { topLevelSite: 'https://news.site' });

  const rmDetails = buildCookieRemovalDetails(list[1], 'https:');
  assert.equal(rmDetails.storeId, '1');
  assert.deepEqual(rmDetails.partitionKey, {
    topLevelSite: 'https://news.site',
    hasCrossSiteAncestor: true
  });

  // Clave de bloqueo aislada por store: ${storeId}:${domain}:${name}
  assert.equal(getBlockedCookieKey('.Example.com', 'tracker', '1'), '1:example.com:tracker');
  assert.equal(getBlockedCookieKey('example.com', 'tracker'), '0:example.com:tracker');
});

// 14. P1 y S4: Debounce/filtrado del badge en background.js y endurecimiento de build.yml
await runTest('14. P1/S4: filtrado por host + debounce 400ms del badge y pines SHA en GitHub Actions', async () => {
  assert.equal(BADGE_DEBOUNCE_MS, 400);

  let scheduledFn = null;
  let scheduledDelay = null;
  let clearedCount = 0;
  let badgeRefreshCount = 0;

  const mockChrome = {
    cookies: {
      async getAllCookieStores() {
        return [{ id: '0', tabIds: [7] }];
      },
      async getAll() {
        return [{ name: 'a', value: '1', domain: 'example.com', path: '/' }];
      }
    },
    tabs: {
      async query() {
        return [{ id: 7, url: 'https://app.example.com/panel' }];
      }
    },
    action: {
      async setBadgeText() {
        badgeRefreshCount += 1;
      },
      async setBadgeBackgroundColor() {},
      async setBadgeTextColor() {}
    }
  };

  const scheduler = createBadgeScheduler(mockChrome, {
    setTimer(fn, ms) {
      scheduledFn = fn;
      scheduledDelay = ms;
      return 123;
    },
    clearTimer() {
      clearedCount += 1;
    }
  });

  await scheduler.updateTab(7, 'https://app.example.com/panel');
  assert.equal(badgeRefreshCount, 1);

  // Cambio en un dominio ajeno -> ignorado sin programar timer
  await handleCookieChanged(
    mockChrome,
    { removed: false, cookie: { name: 'ad', domain: '.doubleclick.net', storeId: '0' } },
    { list: [] },
    scheduler
  );
  assert.equal(scheduledFn, null);

  // Cambio en otro cookie store (incógnito) -> ignorado
  await handleCookieChanged(
    mockChrome,
    { removed: false, cookie: { name: 'sid', domain: 'app.example.com', storeId: '1' } },
    { list: [] },
    scheduler
  );
  assert.equal(scheduledFn, null);

  // Dos cambios seguidos en el dominio activo -> debounce de 400 ms (cancela el primero)
  await handleCookieChanged(
    mockChrome,
    { removed: false, cookie: { name: 'sid', domain: '.example.com', storeId: '0' } },
    { list: [] },
    scheduler
  );
  await handleCookieChanged(
    mockChrome,
    { removed: false, cookie: { name: 'sid2', domain: 'app.example.com', storeId: '0' } },
    { list: [] },
    scheduler
  );
  assert.equal(scheduledDelay, 400);
  assert.equal(clearedCount, 1);
  assert.equal(badgeRefreshCount, 1);

  scheduledFn();
  await scheduler.flush();
  assert.equal(badgeRefreshCount, 3);

  // S4: Verificación estática del workflow de GitHub Actions
  const wf = fs.readFileSync(path.join(ROOT_DIR, '.github', 'workflows', 'build.yml'), 'utf8');
  assert.match(wf, /^permissions:\s*\r?\n\s+contents:\s*read\b/m);
  const usesLines = [...wf.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)/gm)].map((m) => m[1]);
  assert.ok(usesLines.length >= 4);
  for (const ref of usesLines) {
    assert.match(ref, /^[^@]+@[0-9a-f]{40}$/, `Action no fijada a SHA completo: ${ref}`);
  }
});

console.log(`\nResultado: ${passed} pruebas aprobadas (0 fallidas).`);
