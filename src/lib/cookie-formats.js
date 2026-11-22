/**
 * @fileoverview Utilidades puras y locales para validación de URLs restringidas,
 * construcción segura de parámetros chrome.cookies y conversión bidireccional
 * JSON / Netscape cookies.txt. Sin dependencias externas.
 */

import { RESTRICTED_URL_PREFIXES } from '../config.js';

const VALID_SAMESITE = new Set(['no_restriction', 'lax', 'strict', 'unspecified']);

/**
 * Determina si una URL corresponde a una página interna o restringida del navegador
 * donde la API chrome.cookies no puede operar.
 * @param {string | null | undefined} url
 * @returns {boolean}
 */
export function isRestrictedUrl(url) {
  if (typeof url !== 'string') return true;
  const trimmed = url.trim();
  if (!trimmed) return true;

  const lower = trimmed.toLowerCase();
  for (const prefix of RESTRICTED_URL_PREFIXES) {
    if (lower.startsWith(prefix)) {
      return true;
    }
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return true;
    }
    if (!parsed.hostname) {
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

/**
 * Normaliza un nombre de dominio quitando punto inicial, espacios y pasando a minúsculas.
 * @param {string | null | undefined} domain
 * @returns {string}
 */
export function normalizeDomain(domain) {
  return String(domain ?? '').trim().toLowerCase().replace(/^\.+/, '');
}

/**
 * Genera la clave única de bloqueo para una cookie (dominio normalizado + nombre).
 * @param {string | null | undefined} domain
 * @param {string | null | undefined} name
 * @returns {string}
 */
export function getBlockedCookieKey(domain, name) {
  return `${normalizeDomain(domain)}::${String(name ?? '')}`;
}

/**
 * Normaliza valores SameSite aceptados por chrome.cookies.
 * @param {string | null | undefined} sameSite
 * @returns {'no_restriction' | 'lax' | 'strict' | 'unspecified'}
 */
export function normalizeSameSite(sameSite) {
  const raw = String(sameSite ?? '').trim().toLowerCase();
  if (raw === 'none' || raw === 'no_restriction') return 'no_restriction';
  if (raw === 'lax') return 'lax';
  if (raw === 'strict') return 'strict';
  if (VALID_SAMESITE.has(raw)) return /** @type {any} */ (raw);
  return 'unspecified';
}

/**
 * Construye una URL válida para chrome.cookies.set / chrome.cookies.remove.
 * Usa https:// si `secure` es true o si el protocolo de respaldo es https; en caso contrario http://.
 * @param {{ domain?: string, path?: string, secure?: boolean }} cookie
 * @param {string} [fallbackProtocol='https:']
 * @returns {string}
 */
export function buildCookieUrl(cookie, fallbackProtocol = 'https:') {
  const cleanDomain = String(cookie?.domain ?? '').trim().replace(/^\.+/, '');
  if (!cleanDomain) {
    throw new Error('Se requiere un dominio válido para construir la URL de la cookie.');
  }

  const rawPath = String(cookie?.path ?? '/').trim() || '/';
  const cleanPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;

  const useHttps =
    Boolean(cookie?.secure) ||
    String(fallbackProtocol ?? '').trim().toLowerCase().startsWith('https');

  return `${useHttps ? 'https://' : 'http://'}${cleanDomain}${cleanPath}`;
}

/**
 * Construye el payload estricto y seguro para chrome.cookies.set:
 * - Si sameSite === 'no_restriction', fuerza secure = true y URL https://.
 * - Si domain está vacío o coincide con el host exacto de la pestaña, crea cookie host-only
 *   omitiendo la propiedad `domain`.
 * - Si domain empieza con '.', incluye `domain` para compartir con subdominios.
 * - Nunca deja propiedades `undefined`.
 * @param {Record<string, any>} cookieInput
 * @param {{ tabUrl?: string, tabProtocol?: string, tabHost?: string }} [options]
 * @returns {Record<string, any>}
 */
export function buildCookieSetDetails(cookieInput, options = {}) {
  const name = String(cookieInput?.name ?? '').trim();
  if (!name) {
    throw new Error('El nombre de la cookie es obligatorio.');
  }

  const value = cookieInput?.value === undefined || cookieInput?.value === null
    ? ''
    : String(cookieInput.value);

  let fallbackProtocol = options.tabProtocol || 'https:';
  let exactTabHost = options.tabHost || '';

  if (options.tabUrl && !isRestrictedUrl(options.tabUrl)) {
    const parsedTab = new URL(options.tabUrl);
    fallbackProtocol = parsedTab.protocol;
    if (!exactTabHost) {
      exactTabHost = parsedTab.hostname;
    }
  }

  const sameSite = normalizeSameSite(cookieInput?.sameSite);
  let secure = Boolean(cookieInput?.secure);
  if (sameSite === 'no_restriction') {
    secure = true;
  }

  const rawPath = String(cookieInput?.path ?? '/').trim() || '/';
  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;

  const rawDomain = String(cookieInput?.domain ?? '').trim();
  let targetHost = '';
  let includeDomain = false;
  let domainValue = '';

  if (rawDomain === '') {
    targetHost = exactTabHost.trim().replace(/^\.+/, '');
  } else if (rawDomain.startsWith('.')) {
    targetHost = rawDomain.replace(/^\.+/, '');
    includeDomain = true;
    domainValue = `.${targetHost}`;
  } else if (exactTabHost && rawDomain.toLowerCase() === exactTabHost.toLowerCase()) {
    targetHost = exactTabHost.trim();
  } else if (cookieInput?.hostOnly === false) {
    targetHost = rawDomain;
    includeDomain = true;
    domainValue = rawDomain;
  } else {
    targetHost = rawDomain;
  }

  if (!targetHost) {
    throw new Error('No se pudo determinar el dominio de destino para la cookie.');
  }

  const url = buildCookieUrl({ domain: targetHost, path, secure }, fallbackProtocol);

  /** @type {Record<string, any>} */
  const details = {
    url,
    name,
    value,
    path,
    secure,
    httpOnly: Boolean(cookieInput?.httpOnly),
    sameSite
  };

  if (includeDomain && domainValue) {
    details.domain = domainValue;
  }

  const isSession = Boolean(cookieInput?.session);
  if (!isSession && cookieInput?.expirationDate !== undefined && cookieInput?.expirationDate !== null && cookieInput?.expirationDate !== '') {
    const exp = Number(cookieInput.expirationDate);
    if (Number.isFinite(exp) && exp > 0) {
      details.expirationDate = exp;
    }
  }

  if (typeof cookieInput?.storeId === 'string' && cookieInput.storeId.trim()) {
    details.storeId = cookieInput.storeId.trim();
  }

  return details;
}

/**
 * Construye los parámetros seguros para chrome.cookies.remove.
 * @param {{ name: string, domain?: string, path?: string, secure?: boolean, storeId?: string }} cookie
 * @param {string} [fallbackProtocol='https:']
 * @returns {{ url: string, name: string, storeId?: string }}
 */
export function buildCookieRemovalDetails(cookie, fallbackProtocol = 'https:') {
  const details = {
    url: buildCookieUrl(cookie, fallbackProtocol),
    name: String(cookie?.name ?? '')
  };
  if (typeof cookie?.storeId === 'string' && cookie.storeId.trim()) {
    details.storeId = cookie.storeId.trim();
  }
  return details;
}

/**
 * Obtiene y deduplica todas las cookies asociadas a la URL de la pestaña activa
 * (incluyendo subdominios/cookies de dominio).
 * @param {{ getAll: Function }} cookiesApi
 * @param {string} tabUrl
 * @returns {Promise<Array<Record<string, any>>>}
 */
export async function getCookiesForTabUrl(cookiesApi, tabUrl) {
  if (isRestrictedUrl(tabUrl) || !cookiesApi?.getAll) {
    return [];
  }

  const parsed = new URL(tabUrl);
  const [byUrl, byDomain] = await Promise.all([
    cookiesApi.getAll({ url: tabUrl }),
    cookiesApi.getAll({ domain: parsed.hostname })
  ]);

  const map = new Map();
  for (const cookie of [...(byUrl || []), ...(byDomain || [])]) {
    const key = `${cookie.storeId || ''}::${cookie.domain}::${cookie.path}::${cookie.name}`;
    if (!map.has(key)) {
      map.set(key, cookie);
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const nameCmp = String(a.name).localeCompare(String(b.name));
    if (nameCmp !== 0) return nameCmp;
    return String(a.domain).localeCompare(String(b.domain));
  });
}

/**
 * Normaliza un objeto de cookie a un formato portable estándar.
 * @param {Record<string, any>} raw
 * @returns {Record<string, any>}
 */
function normalizePortableCookie(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Entrada de cookie inválida.');
  }

  const name = String(raw.name ?? '').trim();
  const domain = String(raw.domain ?? '').trim();
  if (!name) {
    throw new Error('Toda cookie exportada/importada debe tener un nombre válido.');
  }

  const pathRaw = String(raw.path ?? '/').trim() || '/';
  const path = pathRaw.startsWith('/') ? pathRaw : `/${pathRaw}`;
  const sameSite = normalizeSameSite(raw.sameSite);
  const secure = sameSite === 'no_restriction' ? true : Boolean(raw.secure);
  const httpOnly = Boolean(raw.httpOnly);
  const hasValidExp =
    raw.expirationDate !== undefined &&
    raw.expirationDate !== null &&
    raw.expirationDate !== '' &&
    Number.isFinite(Number(raw.expirationDate)) &&
    Number(raw.expirationDate) > 0;

  const session = raw.session !== undefined ? Boolean(raw.session) : !hasValidExp;
  const hostOnly = raw.hostOnly !== undefined
    ? Boolean(raw.hostOnly)
    : !domain.startsWith('.');

  /** @type {Record<string, any>} */
  const normalized = {
    name,
    value: raw.value === undefined || raw.value === null ? '' : String(raw.value),
    domain,
    hostOnly,
    path,
    secure,
    httpOnly,
    sameSite,
    session
  };

  if (!session && hasValidExp) {
    normalized.expirationDate = Number(raw.expirationDate);
  }

  if (typeof raw.storeId === 'string' && raw.storeId.trim()) {
    normalized.storeId = raw.storeId.trim();
  }

  return normalized;
}

/**
 * Exporta una lista de cookies a JSON formateado o compacto.
 * @param {Array<Record<string, any>>} cookies
 * @param {boolean} [pretty=true]
 * @returns {string}
 */
export function exportCookiesToJson(cookies, pretty = true) {
  const list = Array.isArray(cookies) ? cookies.map(normalizePortableCookie) : [];
  return JSON.stringify(list, null, pretty ? 2 : 0);
}

/**
 * Parsea cookies desde una cadena JSON (acepta arreglo, objeto { cookies: [] } o cookie única).
 * @param {string} jsonText
 * @returns {Array<Record<string, any>>}
 */
export function parseCookiesFromJson(jsonText) {
  if (typeof jsonText !== 'string' || !jsonText.trim()) {
    throw new Error('El contenido JSON está vacío.');
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error(`JSON inválido: ${err.message}`);
  }

  let items;
  if (Array.isArray(parsed)) {
    items = parsed;
  } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.cookies)) {
    items = parsed.cookies;
  } else if (parsed && typeof parsed === 'object') {
    items = [parsed];
  } else {
    throw new Error('El JSON debe contener un arreglo de cookies o un objeto válido.');
  }

  return items.map(normalizePortableCookie);
}

/**
 * Exporta cookies al formato estándar Netscape HTTP Cookie File (cookies.txt),
 * compatible con curl, wget y yt-dlp.
 * @param {Array<Record<string, any>>} cookies
 * @returns {string}
 */
export function exportCookiesToNetscape(cookies) {
  const lines = [
    '# Netscape HTTP Cookie File',
    '# https://curl.se/docs/http-cookies.html',
    '# Generated by ChalaCookiesEdit (Suite Chala)',
    ''
  ];

  const list = Array.isArray(cookies) ? cookies : [];
  for (const raw of list) {
    const cookie = normalizePortableCookie(raw);
    if (!cookie.domain) {
      throw new Error(`La cookie "${cookie.name}" no tiene dominio para exportar a formato Netscape.`);
    }

    const includeSubdomains = cookie.hostOnly === false || cookie.domain.startsWith('.');
    let domainField = cookie.domain;
    if (includeSubdomains && !domainField.startsWith('.')) {
      domainField = `.${domainField}`;
    } else if (!includeSubdomains && domainField.startsWith('.')) {
      domainField = domainField.replace(/^\.+/, '');
    }

    if (cookie.httpOnly) {
      domainField = `#HttpOnly_${domainField}`;
    }

    const flag = includeSubdomains ? 'TRUE' : 'FALSE';
    const pathField = cookie.path || '/';
    const secureField = cookie.secure ? 'TRUE' : 'FALSE';
    const expirationField =
      !cookie.session && typeof cookie.expirationDate === 'number'
        ? String(Math.floor(cookie.expirationDate))
        : '0';
    const safeName = cookie.name.replace(/[\r\n\t]/g, '');
    const safeValue = cookie.value.replace(/[\r\n]/g, '');

    lines.push(
      [domainField, flag, pathField, secureField, expirationField, safeName, safeValue].join('\t')
    );
  }

  return `${lines.join('\n')}\n`;
}

/**
 * Parsea un archivo Netscape cookies.txt soportando el prefijo #HttpOnly_ y tabulaciones en valores.
 * @param {string} text
 * @returns {Array<Record<string, any>>}
 */
export function parseCookiesFromNetscape(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('El texto en formato Netscape está vacío.');
  }

  const results = [];
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    let httpOnly = false;
    let workingLine = rawLine;

    if (trimmed.startsWith('#HttpOnly_')) {
      httpOnly = true;
      workingLine = trimmed.slice('#HttpOnly_'.length);
    } else if (trimmed.startsWith('#')) {
      continue;
    }

    const parts = workingLine.split('\t');
    if (parts.length < 7) {
      throw new Error(`Línea ${i + 1} inválida en formato Netscape (se esperaban 7 columnas separadas por tabulador).`);
    }

    const rawDomain = parts[0].trim();
    const includeSubdomains = parts[1].trim().toUpperCase() === 'TRUE';
    const rawPath = parts[2].trim() || '/';
    const secure = parts[3].trim().toUpperCase() === 'TRUE';
    const expNum = Number(parts[4].trim());
    const name = parts[5].trim();
    const value = parts.slice(6).join('\t');

    if (!rawDomain || !name) {
      throw new Error(`Línea ${i + 1} en formato Netscape carece de dominio o nombre de cookie.`);
    }

    let domain = rawDomain;
    if (includeSubdomains && !domain.startsWith('.')) {
      domain = `.${domain}`;
    } else if (!includeSubdomains && domain.startsWith('.')) {
      domain = domain.replace(/^\.+/, '');
    }

    const isSession = !Number.isFinite(expNum) || expNum <= 0;

    /** @type {Record<string, any>} */
    const entry = {
      name,
      value,
      domain,
      hostOnly: !includeSubdomains,
      path: rawPath.startsWith('/') ? rawPath : `/${rawPath}`,
      secure,
      httpOnly,
      sameSite: 'unspecified',
      session: isSession
    };

    if (!isSession) {
      entry.expirationDate = expNum;
    }

    results.push(normalizePortableCookie(entry));
  }

  if (results.length === 0) {
    throw new Error('No se encontraron cookies válidas en el texto Netscape proporcionado.');
  }

  return results;
}

/**
 * Autodetecta si el texto recibido corresponde a JSON o Netscape cookies.txt y lo parsea.
 * @param {string} rawText
 * @returns {{ format: 'json' | 'netscape', cookies: Array<Record<string, any>> }}
 */
export function detectAndParseCookies(rawText) {
  if (typeof rawText !== 'string' || !rawText.trim()) {
    throw new Error('Pega o carga un contenido válido para importar cookies.');
  }

  const trimmed = rawText.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return {
      format: 'json',
      cookies: parseCookiesFromJson(trimmed)
    };
  }

  return {
    format: 'netscape',
    cookies: parseCookiesFromNetscape(rawText)
  };
}
