/**
 * @fileoverview Service Worker MV3 de ChalaCookiesEdit.
 * Gestiona cookies bloqueadas en tiempo real mediante chrome.cookies.onChanged,
 * actualiza el contador en el badge de la extensión por pestaña activa y atiende
 * mensajería interna desde el popup.
 */

import { BADGE_CONFIG, STORAGE_KEYS } from './config.js';
import {
  buildCookieRemovalDetails,
  getBlockedCookieKey,
  getCookiesForTabUrl,
  isRestrictedUrl,
  normalizeDomain
} from './lib/cookie-formats.js';

/**
 * Carga la lista de cookies bloqueadas desde storage.local normalizando entradas.
 * @param {{ get: Function }} storageArea
 * @returns {Promise<Array<{ key: string, domain: string, name: string, createdAt: string }>>}
 */
export async function loadBlockedCookies(storageArea) {
  if (!storageArea?.get) return [];
  const data = await storageArea.get(STORAGE_KEYS.BLOCKED_COOKIES);
  const rawList = data?.[STORAGE_KEYS.BLOCKED_COOKIES];
  if (!Array.isArray(rawList)) return [];

  const dedup = new Map();
  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const domain = normalizeDomain(item.domain);
    const name = String(item.name ?? '').trim();
    if (!domain || !name) continue;
    const key = getBlockedCookieKey(domain, name);
    if (!dedup.has(key)) {
      dedup.set(key, {
        key,
        domain,
        name,
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString()
      });
    }
  }
  return Array.from(dedup.values());
}

/**
 * Persiste la lista de cookies bloqueadas en storage.local.
 * @param {{ set: Function }} storageArea
 * @param {Array<{ key: string, domain: string, name: string, createdAt: string }>} list
 * @returns {Promise<void>}
 */
export async function saveBlockedCookies(storageArea, list) {
  if (!storageArea?.set) return;
  await storageArea.set({ [STORAGE_KEYS.BLOCKED_COOKIES]: list });
}

/**
 * Agrega una regla de bloqueo (dominio + nombre) y la guarda.
 * @param {{ get: Function, set: Function }} storageArea
 * @param {{ domain: string, name: string }} entry
 * @returns {Promise<Array<{ key: string, domain: string, name: string, createdAt: string }>>}
 */
export async function addBlockedCookie(storageArea, { domain, name }) {
  const normDomain = normalizeDomain(domain);
  const cleanName = String(name ?? '').trim();
  if (!normDomain || !cleanName) {
    throw new Error('Se requiere dominio y nombre válidos para bloquear una cookie.');
  }

  const list = await loadBlockedCookies(storageArea);
  const key = getBlockedCookieKey(normDomain, cleanName);
  if (!list.some((item) => item.key === key)) {
    list.push({
      key,
      domain: normDomain,
      name: cleanName,
      createdAt: new Date().toISOString()
    });
    await saveBlockedCookies(storageArea, list);
  }
  return list;
}

/**
 * Elimina una regla de bloqueo (dominio + nombre).
 * @param {{ get: Function, set: Function }} storageArea
 * @param {{ domain: string, name: string }} entry
 * @returns {Promise<Array<{ key: string, domain: string, name: string, createdAt: string }>>}
 */
export async function removeBlockedCookie(storageArea, { domain, name }) {
  const key = getBlockedCookieKey(domain, name);
  const list = await loadBlockedCookies(storageArea);
  const next = list.filter((item) => item.key !== key);
  if (next.length !== list.length) {
    await saveBlockedCookies(storageArea, next);
  }
  return next;
}

/**
 * Comprueba si una cookie coincide con alguna regla activa de bloqueo.
 * @param {Array<{ key: string, domain: string, name: string }>} blockedList
 * @param {{ domain?: string, name?: string } | null | undefined} cookie
 * @returns {boolean}
 */
export function isCookieBlocked(blockedList, cookie) {
  if (!Array.isArray(blockedList) || blockedList.length === 0 || !cookie) {
    return false;
  }
  const cookieKey = getBlockedCookieKey(cookie.domain, cookie.name);
  return blockedList.some((rule) => rule.key === cookieKey);
}

/**
 * Actualiza el badge de la extensión para una pestaña concreta.
 * Limpia el badge en URLs restringidas o cuando el conteo es 0.
 * @param {any} chromeApi
 * @param {number} tabId
 * @param {string | null | undefined} tabUrl
 * @returns {Promise<number>}
 */
export async function updateBadgeForTab(chromeApi, tabId, tabUrl) {
  if (typeof tabId !== 'number' || tabId < 0 || !chromeApi?.action) {
    return 0;
  }

  try {
    if (isRestrictedUrl(tabUrl)) {
      await chromeApi.action.setBadgeText({ tabId, text: '' });
      return 0;
    }

    const cookies = await getCookiesForTabUrl(chromeApi.cookies, tabUrl);
    const count = cookies.length;
    const text = count === 0 ? '' : count > 999 ? '999+' : String(count);

    await chromeApi.action.setBadgeText({ tabId, text });
    if (count > 0) {
      await chromeApi.action.setBadgeBackgroundColor({
        tabId,
        color: BADGE_CONFIG.backgroundColor
      });
      if (typeof chromeApi.action.setBadgeTextColor === 'function') {
        await chromeApi.action.setBadgeTextColor({
          tabId,
          color: BADGE_CONFIG.textColor
        });
      }
    }
    return count;
  } catch {
    return 0;
  }
}

/**
 * Refresca el badge de la pestaña activa de la ventana actual.
 * @param {any} chromeApi
 * @returns {Promise<void>}
 */
export async function refreshActiveTabBadge(chromeApi) {
  try {
    if (!chromeApi?.tabs?.query) return;
    const tabs = await chromeApi.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs?.[0];
    if (activeTab?.id !== undefined) {
      await updateBadgeForTab(chromeApi, activeTab.id, activeTab.url);
    }
  } catch {
    // Silencioso si no hay ventana activa o la pestaña se cerró
  }
}

/**
 * Maneja el evento chrome.cookies.onChanged:
 * si se creó/actualizó una cookie bloqueada (`!changeInfo.removed`), la elimina automáticamente.
 * @param {any} chromeApi
 * @param {{ removed?: boolean, cookie?: Record<string, any> }} changeInfo
 * @param {{ list: Array<any> | null }} [blockedCacheRef]
 * @returns {Promise<{ removed: boolean, details?: Record<string, any> }>}
 */
export async function handleCookieChanged(chromeApi, changeInfo, blockedCacheRef = { list: null }) {
  if (!changeInfo || !changeInfo.cookie) {
    return { removed: false };
  }

  if (changeInfo.removed) {
    await refreshActiveTabBadge(chromeApi);
    return { removed: false };
  }

  if (!Array.isArray(blockedCacheRef.list)) {
    blockedCacheRef.list = await loadBlockedCookies(chromeApi?.storage?.local);
  }

  if (isCookieBlocked(blockedCacheRef.list, changeInfo.cookie)) {
    const details = buildCookieRemovalDetails(changeInfo.cookie);
    try {
      await chromeApi.cookies.remove(details);
    } catch {
      // Ignorar si ya fue removida por otra operación simultánea
    }
    await refreshActiveTabBadge(chromeApi);
    return { removed: true, details };
  }

  await refreshActiveTabBadge(chromeApi);
  return { removed: false };
}

/**
 * Procesa mensajes enviados desde el popup hacia el Service Worker.
 * @param {any} chromeApi
 * @param {Record<string, any>} message
 * @param {{ list: Array<any> | null }} [blockedCacheRef]
 * @returns {Promise<Record<string, any>>}
 */
export async function handleMessage(chromeApi, message, blockedCacheRef = { list: null }) {
  const type = message?.type;

  switch (type) {
    case 'GET_BLOCKED_COOKIES': {
      const list = await loadBlockedCookies(chromeApi?.storage?.local);
      blockedCacheRef.list = list;
      return { ok: true, blocked: list };
    }

    case 'BLOCK_COOKIE': {
      const domain = message?.domain ?? message?.cookie?.domain;
      const name = message?.name ?? message?.cookie?.name;
      const list = await addBlockedCookie(chromeApi?.storage?.local, { domain, name });
      blockedCacheRef.list = list;

      if (chromeApi?.cookies) {
        const cleanDomain = normalizeDomain(domain);
        const targetName = String(name ?? '').trim();
        const removedKeys = new Set();

        if (message?.cookie) {
          const details = buildCookieRemovalDetails(message.cookie);
          removedKeys.add(`${details.url}::${details.name}`);
          try {
            await chromeApi.cookies.remove(details);
          } catch {
            // Ignorar fallo si ya no existe
          }
        }

        if (typeof chromeApi.cookies.getAll === 'function' && cleanDomain && targetName) {
          try {
            const matching = await chromeApi.cookies.getAll({
              domain: cleanDomain,
              name: targetName
            });
            for (const c of matching || []) {
              if (c.name !== targetName || normalizeDomain(c.domain) !== cleanDomain) continue;
              const details = buildCookieRemovalDetails(c);
              const sig = `${details.url}::${details.name}`;
              if (!removedKeys.has(sig)) {
                removedKeys.add(sig);
                await chromeApi.cookies.remove(details);
              }
            }
          } catch {
            // Ignorar fallos transitorios al limpiar copias
          }
        }
      }

      await refreshActiveTabBadge(chromeApi);
      return { ok: true, blocked: list };
    }

    case 'UNBLOCK_COOKIE': {
      const domain = message?.domain;
      const name = message?.name;
      const list = await removeBlockedCookie(chromeApi?.storage?.local, { domain, name });
      blockedCacheRef.list = list;
      await refreshActiveTabBadge(chromeApi);
      return { ok: true, blocked: list };
    }

    case 'REFRESH_BADGE': {
      if (typeof message?.tabId === 'number' && typeof message?.tabUrl === 'string') {
        await updateBadgeForTab(chromeApi, message.tabId, message.tabUrl);
      } else {
        await refreshActiveTabBadge(chromeApi);
      }
      return { ok: true };
    }

    default:
      return { ok: false, error: `Tipo de mensaje no soportado: ${String(type ?? '')}` };
  }
}

/**
 * Registra todos los listeners del Service Worker en el entorno Chrome/Edge MV3.
 * @param {any} chromeApi
 * @returns {void}
 */
export function registerBackgroundListeners(chromeApi) {
  /** @type {{ list: Array<any> | null }} */
  const blockedCacheRef = { list: null };

  const warmCacheAndBadge = async () => {
    blockedCacheRef.list = await loadBlockedCookies(chromeApi?.storage?.local);
    await refreshActiveTabBadge(chromeApi);
  };

  chromeApi.cookies?.onChanged?.addListener((changeInfo) => {
    void handleCookieChanged(chromeApi, changeInfo, blockedCacheRef);
  });

  chromeApi.storage?.onChanged?.addListener((changes, areaName) => {
    if (areaName === 'local' && changes?.[STORAGE_KEYS.BLOCKED_COOKIES]) {
      void loadBlockedCookies(chromeApi.storage.local).then((list) => {
        blockedCacheRef.list = list;
      });
    }
  });

  chromeApi.tabs?.onActivated?.addListener(async ({ tabId }) => {
    try {
      const tab = await chromeApi.tabs.get(tabId);
      await updateBadgeForTab(chromeApi, tabId, tab?.url);
    } catch {
      // Pestaña no disponible
    }
  });

  chromeApi.tabs?.onUpdated?.addListener((tabId, changeInfo, tab) => {
    if (tab?.active && (changeInfo.url || changeInfo.status === 'complete')) {
      void updateBadgeForTab(chromeApi, tabId, changeInfo.url || tab.url);
    }
  });

  chromeApi.runtime?.onInstalled?.addListener(() => {
    void warmCacheAndBadge();
  });

  chromeApi.runtime?.onStartup?.addListener(() => {
    void warmCacheAndBadge();
  });

  chromeApi.runtime?.onMessage?.addListener((message, _sender, sendResponse) => {
    handleMessage(chromeApi, message, blockedCacheRef)
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: err?.message || 'Error interno' }));
    return true;
  });
}

if (typeof chrome !== 'undefined' && chrome?.cookies && chrome?.runtime?.onMessage) {
  registerBackgroundListeners(chrome);
}
