/**
 * @fileoverview Service Worker MV3 de ChalaCookiesEdit.
 * Gestiona cookies bloqueadas en tiempo real mediante chrome.cookies.onChanged
 * (aisladas por cookie store: normal / incógnito), actualiza el contador del badge
 * con debounce y filtrado por host activo, y atiende mensajería interna del popup.
 */

import { BADGE_CONFIG, STORAGE_KEYS } from './config.js';
import {
  buildCookieRemovalDetails,
  getAllCookiesWithPartitions,
  getBlockedCookieKey,
  getCookieIdentity,
  getCookiesForTabUrl,
  isDomainRelated,
  isRestrictedUrl,
  normalizeDomain,
  normalizeStoreId,
  resolveCookieStoreId
} from './lib/cookie-formats.js';

/** Retardo de debounce para recalcular el badge tras cambios de cookies (P1). */
export const BADGE_DEBOUNCE_MS = 400;

/** Cola para serializar operaciones read-modify-write sobre las reglas de bloqueo. */
let rulesQueue = Promise.resolve();

/**
 * Ejecuta una tarea de forma serializada respecto a otras modificaciones de reglas.
 * @template T
 * @param {() => Promise<T>} task
 * @returns {Promise<T>}
 */
function withRulesLock(task) {
  const run = rulesQueue.then(task, task);
  rulesQueue = run.catch(() => undefined);
  return run;
}

/**
 * Carga la lista de cookies bloqueadas desde storage.local normalizando entradas.
 * Las reglas heredadas sin storeId se asignan al store por defecto ('0').
 * @param {{ get: Function }} storageArea
 * @returns {Promise<Array<{ key: string, storeId: string, domain: string, name: string, createdAt: string }>>}
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
    const storeId = normalizeStoreId(item.storeId);
    const key = getBlockedCookieKey(domain, name, storeId);
    if (!dedup.has(key)) {
      dedup.set(key, {
        key,
        storeId,
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
 * @param {Array<Record<string, any>>} list
 * @returns {Promise<void>}
 */
export async function saveBlockedCookies(storageArea, list) {
  if (!storageArea?.set) return;
  await storageArea.set({ [STORAGE_KEYS.BLOCKED_COOKIES]: list });
}

/**
 * Agrega una regla de bloqueo (store + dominio + nombre) y la guarda.
 * @param {{ get: Function, set: Function }} storageArea
 * @param {{ domain: string, name: string, storeId?: string }} entry
 * @returns {Promise<Array<Record<string, any>>>}
 */
export function addBlockedCookie(storageArea, { domain, name, storeId }) {
  return withRulesLock(async () => {
    const normDomain = normalizeDomain(domain);
    const cleanName = String(name ?? '').trim();
    if (!normDomain || !cleanName) {
      throw new Error('Se requiere dominio y nombre válidos para bloquear una cookie.');
    }

    const normStore = normalizeStoreId(storeId);
    const list = await loadBlockedCookies(storageArea);
    const key = getBlockedCookieKey(normDomain, cleanName, normStore);
    if (!list.some((item) => item.key === key)) {
      list.push({
        key,
        storeId: normStore,
        domain: normDomain,
        name: cleanName,
        createdAt: new Date().toISOString()
      });
      await saveBlockedCookies(storageArea, list);
    }
    return list;
  });
}

/**
 * Elimina una regla de bloqueo (store + dominio + nombre).
 * @param {{ get: Function, set: Function }} storageArea
 * @param {{ domain: string, name: string, storeId?: string }} entry
 * @returns {Promise<Array<Record<string, any>>>}
 */
export function removeBlockedCookie(storageArea, { domain, name, storeId }) {
  return withRulesLock(async () => {
    const key = getBlockedCookieKey(domain, name, storeId);
    const list = await loadBlockedCookies(storageArea);
    const next = list.filter((item) => item.key !== key);
    if (next.length !== list.length) {
      await saveBlockedCookies(storageArea, next);
    }
    return next;
  });
}

/**
 * Comprueba si una cookie coincide con alguna regla activa de bloqueo de su mismo store.
 * @param {Array<{ key: string }>} blockedList
 * @param {{ domain?: string, name?: string, storeId?: string } | null | undefined} cookie
 * @returns {boolean}
 */
export function isCookieBlocked(blockedList, cookie) {
  if (!Array.isArray(blockedList) || blockedList.length === 0 || !cookie) {
    return false;
  }
  const cookieKey = getBlockedCookieKey(cookie.domain, cookie.name, cookie.storeId);
  return blockedList.some((rule) => rule.key === cookieKey);
}

/**
 * Actualiza el badge de la extensión para una pestaña concreta.
 * Limpia el badge en URLs restringidas o cuando el conteo es 0.
 * @param {any} chromeApi
 * @param {number} tabId
 * @param {string | null | undefined} tabUrl
 * @param {string} [storeId] Cookie store de la pestaña (se resuelve si se omite).
 * @returns {Promise<number>}
 */
export async function updateBadgeForTab(chromeApi, tabId, tabUrl, storeId) {
  if (typeof tabId !== 'number' || tabId < 0 || !chromeApi?.action) {
    return 0;
  }

  try {
    if (isRestrictedUrl(tabUrl)) {
      await chromeApi.action.setBadgeText({ tabId, text: '' });
      return 0;
    }

    const effectiveStoreId = storeId ?? (await resolveCookieStoreId(chromeApi.cookies, tabId));
    const cookies = await getCookiesForTabUrl(chromeApi.cookies, tabUrl, {
      storeId: effectiveStoreId
    });
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
 * Obtiene el host de una URL http(s) o cadena vacía.
 * @param {string | null | undefined} url
 * @returns {string}
 */
function hostFromUrl(url) {
  if (isRestrictedUrl(url)) return '';
  try {
    return new URL(String(url)).hostname;
  } catch {
    return '';
  }
}

/**
 * Refresca el badge de la pestaña activa de la última ventana enfocada.
 * @param {any} chromeApi
 * @returns {Promise<{ tabId: number, host: string, storeId: string | undefined } | null>}
 */
export async function refreshActiveTabBadge(chromeApi) {
  try {
    if (!chromeApi?.tabs?.query) return null;
    const tabs = await chromeApi.tabs.query({ active: true, lastFocusedWindow: true });
    const activeTab = tabs?.[0];
    if (activeTab?.id === undefined) return null;
    const storeId = await resolveCookieStoreId(chromeApi.cookies, activeTab.id);
    await updateBadgeForTab(chromeApi, activeTab.id, activeTab.url, storeId);
    return { tabId: activeTab.id, host: hostFromUrl(activeTab.url), storeId };
  } catch {
    // Silencioso si no hay ventana activa o la pestaña se cerró
    return null;
  }
}

/**
 * Decide si un cambio de cookie afecta al badge de la pestaña activa (P1).
 * Si aún no se conoce el host activo, devuelve true para poder descubrirlo.
 * @param {{ host?: string, storeId?: string } | null | undefined} context
 * @param {{ domain?: string, storeId?: string } | null | undefined} cookie
 * @returns {boolean}
 */
export function shouldRefreshBadgeForCookie(context, cookie) {
  if (!cookie) return false;
  if (!context?.host) return true;
  if (
    context.storeId &&
    typeof cookie.storeId === 'string' &&
    cookie.storeId &&
    cookie.storeId !== context.storeId
  ) {
    return false;
  }
  return isDomainRelated(cookie.domain, context.host);
}

/**
 * Crea un planificador con debounce para actualizar el badge (P1).
 * @param {any} chromeApi
 * @param {{ delayMs?: number, setTimer?: Function, clearTimer?: Function }} [options]
 */
export function createBadgeScheduler(chromeApi, options = {}) {
  const delayMs = options.delayMs ?? BADGE_DEBOUNCE_MS;
  const setTimer = options.setTimer ?? setTimeout;
  const clearTimer = options.clearTimer ?? clearTimeout;

  /** @type {{ tabId: number | null, host: string, storeId: string | undefined }} */
  const context = { tabId: null, host: '', storeId: undefined };
  let timer = null;

  const applyContext = (ctx) => {
    if (!ctx) return;
    context.tabId = ctx.tabId;
    context.host = ctx.host;
    context.storeId = ctx.storeId;
  };

  const flush = async () => {
    timer = null;
    applyContext(await refreshActiveTabBadge(chromeApi));
  };

  const schedule = () => {
    if (timer !== null) clearTimer(timer);
    timer = setTimer(() => {
      void flush();
    }, delayMs);
  };

  return {
    context,
    schedule,
    flush,
    /** @returns {boolean} si se programó una actualización */
    notifyCookieChange(cookie) {
      if (!shouldRefreshBadgeForCookie(context, cookie)) return false;
      schedule();
      return true;
    },
    /**
     * Actualiza inmediatamente el badge de una pestaña concreta y fija el contexto activo.
     * @param {number} tabId
     * @param {string | undefined} url
     */
    async updateTab(tabId, url) {
      const storeId = await resolveCookieStoreId(chromeApi.cookies, tabId);
      applyContext({ tabId, host: hostFromUrl(url), storeId });
      return updateBadgeForTab(chromeApi, tabId, url, storeId);
    },
    cancel() {
      if (timer !== null) clearTimer(timer);
      timer = null;
    }
  };
}

/**
 * Maneja el evento chrome.cookies.onChanged:
 * si se creó/actualizó una cookie bloqueada (`!changeInfo.removed`) en su store, la elimina.
 * El badge se recalcula con debounce solo si el cambio afecta al host activo.
 * @param {any} chromeApi
 * @param {{ removed?: boolean, cookie?: Record<string, any> }} changeInfo
 * @param {{ list: Array<any> | null }} [blockedCacheRef]
 * @param {{ notifyCookieChange: Function } | null} [badgeScheduler]
 * @returns {Promise<{ removed: boolean, details?: Record<string, any> }>}
 */
export async function handleCookieChanged(
  chromeApi,
  changeInfo,
  blockedCacheRef = { list: null },
  badgeScheduler = null
) {
  if (!changeInfo || !changeInfo.cookie) {
    return { removed: false };
  }

  const notifyBadge = () => {
    badgeScheduler?.notifyCookieChange?.(changeInfo.cookie);
  };

  if (changeInfo.removed) {
    notifyBadge();
    return { removed: false };
  }

  if (!Array.isArray(blockedCacheRef.list)) {
    blockedCacheRef.list = await loadBlockedCookies(chromeApi?.storage?.local);
  }

  if (isCookieBlocked(blockedCacheRef.list, changeInfo.cookie)) {
    let details;
    try {
      details = buildCookieRemovalDetails(changeInfo.cookie);
      await chromeApi.cookies.remove(details);
    } catch {
      // Ignorar si ya fue removida por otra operación simultánea o el host no es válido
    }
    notifyBadge();
    return { removed: true, details };
  }

  notifyBadge();
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
      const storeId = normalizeStoreId(message?.storeId ?? message?.cookie?.storeId);
      const list = await addBlockedCookie(chromeApi?.storage?.local, { domain, name, storeId });
      blockedCacheRef.list = list;

      if (chromeApi?.cookies) {
        const cleanDomain = normalizeDomain(domain);
        const targetName = String(name ?? '').trim();
        const removedKeys = new Set();

        if (message?.cookie) {
          try {
            const details = buildCookieRemovalDetails(message.cookie, 'https:', { storeId });
            removedKeys.add(getCookieIdentity({ ...message.cookie, storeId: details.storeId }));
            await chromeApi.cookies.remove(details);
          } catch {
            // Ignorar fallo si ya no existe
          }
        }

        if (typeof chromeApi.cookies.getAll === 'function' && cleanDomain && targetName) {
          try {
            const matching = await getAllCookiesWithPartitions(chromeApi.cookies, {
              domain: cleanDomain,
              name: targetName,
              storeId: message?.storeId ?? message?.cookie?.storeId
            });
            for (const c of matching || []) {
              if (c.name !== targetName || normalizeDomain(c.domain) !== cleanDomain) continue;
              if (normalizeStoreId(c.storeId) !== storeId) continue;
              const sig = getCookieIdentity({ ...c, storeId: c.storeId || storeId });
              if (removedKeys.has(sig) || removedKeys.has(getCookieIdentity(c))) continue;
              removedKeys.add(sig);
              await chromeApi.cookies.remove(buildCookieRemovalDetails(c, 'https:', { storeId }));
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
      const list = await removeBlockedCookie(chromeApi?.storage?.local, {
        domain: message?.domain,
        name: message?.name,
        storeId: message?.storeId
      });
      blockedCacheRef.list = list;
      await refreshActiveTabBadge(chromeApi);
      return { ok: true, blocked: list };
    }

    case 'REFRESH_BADGE': {
      if (typeof message?.tabId === 'number' && typeof message?.tabUrl === 'string') {
        await updateBadgeForTab(
          chromeApi,
          message.tabId,
          message.tabUrl,
          typeof message?.storeId === 'string' ? message.storeId : undefined
        );
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
  const badge = createBadgeScheduler(chromeApi);

  const warmCacheAndBadge = async () => {
    blockedCacheRef.list = await loadBlockedCookies(chromeApi?.storage?.local);
    await badge.flush();
  };

  chromeApi.cookies?.onChanged?.addListener((changeInfo) => {
    void handleCookieChanged(chromeApi, changeInfo, blockedCacheRef, badge);
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
      await badge.updateTab(tabId, tab?.url);
    } catch {
      // Pestaña no disponible
    }
  });

  chromeApi.tabs?.onUpdated?.addListener((tabId, changeInfo, tab) => {
    if (tab?.active && (changeInfo.url || changeInfo.status === 'complete')) {
      void badge.updateTab(tabId, changeInfo.url || tab.url);
    }
  });

  chromeApi.windows?.onFocusChanged?.addListener(() => {
    badge.schedule();
  });

  chromeApi.runtime?.onInstalled?.addListener(() => {
    void warmCacheAndBadge();
  });

  chromeApi.runtime?.onStartup?.addListener(() => {
    void warmCacheAndBadge();
  });

  chromeApi.runtime?.onMessage?.addListener((message, sender, sendResponse) => {
    // Solo se aceptan mensajes de contextos propios de la extensión (defensa en profundidad).
    if (sender?.id && chromeApi.runtime?.id && sender.id !== chromeApi.runtime.id) {
      return false;
    }
    handleMessage(chromeApi, message, blockedCacheRef)
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: err?.message || 'Error interno' }));
    return true;
  });
}

if (typeof chrome !== 'undefined' && chrome?.cookies && chrome?.runtime?.onMessage) {
  registerBackgroundListeners(chrome);
}
