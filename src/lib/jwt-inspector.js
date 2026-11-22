/**
 * @fileoverview Detector y decodificador 100% local de tokens JWT (JSON Web Tokens)
 * usando Base64URL + UTF-8 TextDecoder sin llamadas de red ni librerías externas.
 */

const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

/**
 * Normaliza un valor de cookie quitando un posible prefijo "Bearer ".
 * @param {string} value
 * @returns {string}
 */
function stripBearerPrefix(value) {
  const trimmed = String(value ?? '').trim();
  if (/^bearer\s+/i.test(trimmed)) {
    return trimmed.replace(/^bearer\s+/i, '').trim();
  }
  return trimmed;
}

/**
 * Decodifica un segmento Base64URL a una cadena UTF-8.
 * @param {string} segment
 * @returns {string}
 */
export function decodeBase64Url(segment) {
  if (typeof segment !== 'string' || !segment || !BASE64URL_RE.test(segment)) {
    throw new Error('Segmento Base64URL inválido.');
  }

  if (segment.length % 4 === 1) {
    throw new Error('Longitud Base64URL inválida.');
  }

  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (base64.length % 4)) % 4;
  const padded = base64 + '='.repeat(padLength);

  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return utf8Decoder.decode(bytes);
}

/**
 * Intenta parsear un segmento Base64URL como objeto JSON plano (no arreglo ni primitivo).
 * @param {string} segment
 * @returns {Record<string, any> | null}
 */
function parseJwtJsonSegment(segment) {
  try {
    const decoded = decodeBase64Url(segment);
    const parsed = JSON.parse(decoded);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Verifica de manera estructural y semántica si un valor de cookie es un token JWT.
 * @param {string | null | undefined} value
 * @returns {boolean}
 */
export function isLikelyJwt(value) {
  if (typeof value !== 'string') return false;
  const token = stripBearerPrefix(value);
  if (!token) return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [headerSeg, payloadSeg, signatureSeg] = parts;
  if (!headerSeg || !payloadSeg || !signatureSeg) return false;
  if (!BASE64URL_RE.test(signatureSeg)) return false;

  const header = parseJwtJsonSegment(headerSeg);
  const payload = parseJwtJsonSegment(payloadSeg);
  return Boolean(header && payload);
}

/**
 * Inspecciona un token JWT y extrae header, payload, firma y estado de vigencia (`exp` / `nbf`).
 * Devuelve `null` si el valor no corresponde a un JWT válido.
 * @param {string | null | undefined} value
 * @param {number} [nowMs=Date.now()]
 * @returns {{
 *   isJwt: true,
 *   header: Record<string, any>,
 *   payload: Record<string, any>,
 *   signature: string,
 *   algorithm: string | null,
 *   type: string | null,
 *   issuedAt: string | null,
 *   notBefore: string | null,
 *   expiresAt: string | null,
 *   expTimestamp: number | null,
 *   status: 'valid' | 'expired' | 'not_yet_valid' | 'no_exp',
 *   isExpired: boolean,
 *   remainingSeconds: number | null
 * } | null}
 */
export function inspectJwt(value, nowMs = Date.now()) {
  if (typeof value !== 'string') return null;
  const token = stripBearerPrefix(value);
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerSeg, payloadSeg, signatureSeg] = parts;
  if (!headerSeg || !payloadSeg || !signatureSeg) return null;
  if (!BASE64URL_RE.test(signatureSeg)) return null;

  const header = parseJwtJsonSegment(headerSeg);
  const payload = parseJwtJsonSegment(payloadSeg);
  if (!header || !payload) return null;

  const toIsoOrNull = (unixSeconds) => {
    if (typeof unixSeconds !== 'number' || !Number.isFinite(unixSeconds)) return null;
    return new Date(unixSeconds * 1000).toISOString();
  };

  const nowSec = nowMs / 1000;
  const expTimestamp =
    typeof payload.exp === 'number' && Number.isFinite(payload.exp) ? payload.exp : null;
  const nbfTimestamp =
    typeof payload.nbf === 'number' && Number.isFinite(payload.nbf) ? payload.nbf : null;

  let status = 'no_exp';
  let isExpired = false;
  let remainingSeconds = null;

  if (expTimestamp !== null) {
    remainingSeconds = Math.floor(expTimestamp - nowSec);
    if (nowSec >= expTimestamp) {
      status = 'expired';
      isExpired = true;
    } else if (nbfTimestamp !== null && nowSec < nbfTimestamp) {
      status = 'not_yet_valid';
    } else {
      status = 'valid';
    }
  } else if (nbfTimestamp !== null && nowSec < nbfTimestamp) {
    status = 'not_yet_valid';
  }

  return {
    isJwt: true,
    header,
    payload,
    signature: signatureSeg,
    algorithm: typeof header.alg === 'string' ? header.alg : null,
    type: typeof header.typ === 'string' ? header.typ : null,
    issuedAt: toIsoOrNull(payload.iat),
    notBefore: toIsoOrNull(payload.nbf),
    expiresAt: toIsoOrNull(expTimestamp),
    expTimestamp,
    status,
    isExpired,
    remainingSeconds
  };
}

/**
 * Formatea la diferencia de tiempo de expiración del JWT en texto legible (ES / EN).
 * @param {number | null | undefined} remainingSeconds
 * @param {'es' | 'en'} [locale='es']
 * @returns {string}
 */
export function formatJwtRelativeTime(remainingSeconds, locale = 'es') {
  const isEn = String(locale).toLowerCase().startsWith('en');
  if (typeof remainingSeconds !== 'number' || !Number.isFinite(remainingSeconds)) {
    return isEn ? 'No exp claim' : 'Sin claim exp';
  }

  const expired = remainingSeconds <= 0;
  const abs = Math.abs(Math.floor(remainingSeconds));

  const days = Math.floor(abs / 86400);
  const hours = Math.floor((abs % 86400) / 3600);
  const minutes = Math.floor((abs % 3600) / 60);
  const seconds = abs % 60;

  let parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 && parts.length < 2) parts.push(`${minutes}m`);
  if (parts.length === 0) parts.push(`${seconds}s`);

  const duration = parts.join(' ');
  if (expired) {
    return isEn ? `Expired ${duration} ago` : `Expirado hace ${duration}`;
  }
  return isEn ? `Expires in ${duration}` : `Expira en ${duration}`;
}
