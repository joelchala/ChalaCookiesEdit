/**
 * @fileoverview Controlador de la interfaz popup de ChalaCookiesEdit (MV3).
 * Implementa detección segura de URL restringida, CRUD completo de cookies,
 * inspector JWT automático 100% local, bloqueo persistente e importación/exportación
 * en JSON y Netscape cookies.txt.
 */

import { SUITE_LINKS } from '../config.js';
import {
  buildCookieRemovalDetails,
  buildCookieSetDetails,
  detectAndParseCookies,
  exportCookiesToJson,
  exportCookiesToNetscape,
  getBlockedCookieKey,
  getCookiesForTabUrl,
  isRestrictedUrl,
  normalizeDomain
} from '../lib/cookie-formats.js';
import { formatJwtRelativeTime, inspectJwt } from '../lib/jwt-inspector.js';

/**
 * Helper i18n seguro con respaldo en español.
 * @param {string} key
 * @param {string} [fallback='']
 * @returns {string}
 */
function t(key, fallback = '') {
  try {
    const msg = chrome?.i18n?.getMessage?.(key);
    return msg || fallback || key;
  } catch {
    return fallback || key;
  }
}

/**
 * Determina el idioma activo ('es' | 'en').
 * @returns {'es' | 'en'}
 */
function getUiLocale() {
  try {
    const lang = chrome?.i18n?.getUILanguage?.() || navigator.language || 'es';
    return lang.toLowerCase().startsWith('en') ? 'en' : 'es';
  } catch {
    return 'es';
  }
}

/**
 * Comprueba si una regla de dominio bloqueada aplica al host activo.
 * @param {string} ruleDomain
 * @param {string} currentHost
 * @returns {boolean}
 */
function isDomainRelated(ruleDomain, currentHost) {
  const a = normalizeDomain(ruleDomain);
  const b = normalizeDomain(currentHost);
  if (!a || !b) return false;
  return a === b || b.endsWith(`.${a}`) || a.endsWith(`.${b}`);
}

/**
 * Convierte un timestamp Unix en segundos a cadena para input datetime-local.
 * @param {number | undefined} unixSeconds
 * @returns {string}
 */
function toDatetimeLocalValue(unixSeconds) {
  if (typeof unixSeconds !== 'number' || !Number.isFinite(unixSeconds) || unixSeconds <= 0) {
    return '';
  }
  const date = new Date(unixSeconds * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/**
 * Convierte el valor de datetime-local a timestamp Unix en segundos.
 * @param {string} value
 * @returns {number | undefined}
 */
function fromDatetimeLocalValue(value) {
  if (!value) return undefined;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return undefined;
  return Math.floor(ms / 1000);
}

/**
 * Genera una firma única de cookie para rastrear elementos expandidos o reemplazos.
 * @param {Record<string, any>} cookie
 * @returns {string}
 */
function getCookieSignature(cookie) {
  return `${cookie.storeId || ''}::${cookie.domain}::${cookie.path}::${cookie.name}`;
}

/**
 * Crea un elemento HTML con clase y texto opcionales sin usar innerHTML inseguro.
 * @param {string} tag
 * @param {string} [className='']
 * @param {string} [text='']
 * @returns {HTMLElement}
 */
function createEl(tag, className = '', text = '') {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== '') el.textContent = text;
  return el;
}

const state = {
  activeTab: null,
  activeHost: '',
  restricted: false,
  cookies: [],
  blockedRules: [],
  filter: 'all',
  search: '',
  expandedKeys: new Set(),
  editorMode: 'create',
  editingOriginal: null,
  toastTimer: null
};

const dom = {
  domainPill: document.getElementById('domain-pill'),
  btnNewCookie: document.getElementById('btn-new-cookie'),
  btnIo: document.getElementById('btn-io'),
  btnReloadTab: document.getElementById('btn-reload-tab'),
  btnDeleteAll: document.getElementById('btn-delete-all'),
  restrictedView: document.getElementById('restricted-view'),
  restrictedUrl: document.getElementById('restricted-url'),
  mainView: document.getElementById('main-view'),
  searchInput: document.getElementById('search-input'),
  btnClearSearch: document.getElementById('btn-clear-search'),
  filterChips: Array.from(document.querySelectorAll('.filter-chip')),
  countAll: document.getElementById('count-all'),
  countHttpOnly: document.getElementById('count-httponly'),
  countSecure: document.getElementById('count-secure'),
  countSession: document.getElementById('count-session'),
  countBlocked: document.getElementById('count-blocked'),
  cookieList: document.getElementById('cookie-list'),
  emptyState: document.getElementById('empty-state'),
  emptyDesc: document.getElementById('empty-desc'),
  linkSuite: document.getElementById('link-suite'),
  linkCoposys: document.getElementById('link-coposys'),
  linkPaypal: document.getElementById('link-paypal'),
  modalEditor: document.getElementById('modal-editor'),
  editorTitle: document.getElementById('editor-title'),
  cookieForm: document.getElementById('cookie-form'),
  fieldName: document.getElementById('field-name'),
  fieldPath: document.getElementById('field-path'),
  fieldValue: document.getElementById('field-value'),
  fieldDomain: document.getElementById('field-domain'),
  fieldSameSite: document.getElementById('field-samesite'),
  fieldExpiration: document.getElementById('field-expiration'),
  fieldSession: document.getElementById('field-session'),
  fieldHttpOnly: document.getElementById('field-httponly'),
  fieldSecure: document.getElementById('field-secure'),
  sameSiteNotice: document.getElementById('samesite-notice'),
  editorError: document.getElementById('editor-error'),
  editorJwtDetails: document.getElementById('editor-jwt-details'),
  editorJwtStatus: document.getElementById('editor-jwt-status'),
  editorJwtMeta: document.getElementById('editor-jwt-meta'),
  editorJwtPayload: document.getElementById('editor-jwt-payload'),
  editorJwtHeader: document.getElementById('editor-jwt-header'),
  modalIo: document.getElementById('modal-io'),
  ioTabs: Array.from(document.querySelectorAll('[data-io-tab]')),
  ioPanelExport: document.getElementById('io-panel-export'),
  ioPanelImport: document.getElementById('io-panel-import'),
  btnCopyJson: document.getElementById('btn-copy-json'),
  btnDownloadJson: document.getElementById('btn-download-json'),
  btnCopyNetscape: document.getElementById('btn-copy-netscape'),
  btnDownloadNetscape: document.getElementById('btn-download-netscape'),
  exportPreview: document.getElementById('export-preview'),
  importTextarea: document.getElementById('import-textarea'),
  importFileInput: document.getElementById('import-file-input'),
  btnLoadFile: document.getElementById('btn-load-file'),
  btnApplyImport: document.getElementById('btn-apply-import'),
  importError: document.getElementById('import-error'),
  modalConfirm: document.getElementById('modal-confirm'),
  btnConfirmDeleteAll: document.getElementById('btn-confirm-delete-all'),
  toast: document.getElementById('toast')
};

/**
 * Aplica traducciones i18n al DOM estático y enlaces oficiales de Suite Chala.
 */
function applyTranslationsAndLinks() {
  for (const el of document.querySelectorAll('[data-i18n]')) {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key, el.textContent);
    }
  }
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) {
      el.setAttribute('placeholder', t(key, el.getAttribute('placeholder') || ''));
    }
  }
  for (const el of document.querySelectorAll('[data-i18n-title]')) {
    const key = el.getAttribute('data-i18n-title');
    if (key) {
      el.setAttribute('title', t(key, el.getAttribute('title') || ''));
    }
  }

  dom.linkSuite.href = SUITE_LINKS.suiteHome;
  dom.linkCoposys.href = SUITE_LINKS.coposys;
  dom.linkPaypal.href = SUITE_LINKS.paypal;
}

/**
 * Muestra una notificación tipo toast sin perder el foco del popup.
 * @param {string} message
 * @param {boolean} [isError=false]
 */
function showToast(message, isError = false) {
  if (state.toastTimer) {
    clearTimeout(state.toastTimer);
  }
  dom.toast.textContent = message;
  dom.toast.classList.toggle('toast-error', isError);
  dom.toast.classList.remove('hidden');

  state.toastTimer = setTimeout(() => {
    dom.toast.classList.add('hidden');
  }, 2600);
}

/**
 * Envía un mensaje al Service Worker devolviendo siempre un objeto seguro.
 * @param {Record<string, any>} payload
 * @returns {Promise<Record<string, any>>}
 */
async function sendBgMessage(payload) {
  try {
    return (await chrome.runtime.sendMessage(payload)) || { ok: false };
  } catch (err) {
    return { ok: false, error: err?.message || 'Service worker unavailable' };
  }
}

/**
 * Construye el bloque DOM del Inspector JWT para una cookie o editor.
 * @param {ReturnType<typeof inspectJwt>} jwtInfo
 * @returns {HTMLElement}
 */
function buildJwtPanelElement(jwtInfo) {
  const locale = getUiLocale();
  const details = createEl('details', 'jwt-panel');
  const summary = createEl('summary', 'jwt-summary');

  const left = createEl('span', 'jwt-summary-left');
  left.appendChild(createEl('span', 'badge badge-jwt', t('badgeJwt', 'JWT')));
  left.appendChild(createEl('span', '', t('jwtInspectorTitle', 'Inspector JWT (100% local)')));
  summary.appendChild(left);

  const statusPill = createEl('span', 'jwt-status-pill');
  if (jwtInfo.status === 'expired') {
    statusPill.classList.add('jwt-status-expired');
    statusPill.textContent = t('jwtExpired', 'Expirado');
  } else if (jwtInfo.status === 'valid') {
    statusPill.classList.add('jwt-status-valid');
    statusPill.textContent = t('jwtValid', 'Vigente');
  } else if (jwtInfo.status === 'not_yet_valid') {
    statusPill.classList.add('jwt-status-neutral');
    statusPill.textContent = t('jwtNotYetValid', 'Aún no válido');
  } else {
    statusPill.classList.add('jwt-status-neutral');
    statusPill.textContent = t('jwtNoExp', 'Sin expiración');
  }
  summary.appendChild(statusPill);
  details.appendChild(summary);

  const content = createEl('div', 'jwt-content');
  const metaParts = [];
  if (jwtInfo.algorithm) metaParts.push(`alg: ${jwtInfo.algorithm}`);
  if (jwtInfo.expiresAt) {
    metaParts.push(`exp: ${jwtInfo.expiresAt} (${formatJwtRelativeTime(jwtInfo.remainingSeconds, locale)})`);
  } else {
    metaParts.push(formatJwtRelativeTime(null, locale));
  }
  content.appendChild(createEl('div', 'jwt-meta', metaParts.join(' · ')));

  const payloadBlock = createEl('div', 'jwt-block');
  payloadBlock.appendChild(createEl('span', 'jwt-block-label', t('jwtPayload', 'Payload')));
  payloadBlock.appendChild(createEl('pre', 'jwt-pre', JSON.stringify(jwtInfo.payload, null, 2)));
  content.appendChild(payloadBlock);

  const headerBlock = createEl('div', 'jwt-block');
  headerBlock.appendChild(createEl('span', 'jwt-block-label', t('jwtHeader', 'Header')));
  headerBlock.appendChild(createEl('pre', 'jwt-pre', JSON.stringify(jwtInfo.header, null, 2)));
  content.appendChild(headerBlock);

  details.appendChild(content);
  return details;
}

/**
 * Actualiza los contadores de los filtros rápidos.
 */
function updateFilterCounts() {
  const domainBlocked = state.blockedRules.filter((r) => isDomainRelated(r.domain, state.activeHost));
  dom.countAll.textContent = String(state.cookies.length);
  dom.countHttpOnly.textContent = String(state.cookies.filter((c) => c.httpOnly).length);
  dom.countSecure.textContent = String(state.cookies.filter((c) => c.secure).length);
  dom.countSession.textContent = String(state.cookies.filter((c) => c.session).length);
  dom.countBlocked.textContent = String(domainBlocked.length);
}

/**
 * Filtra las cookies según buscador y filtro seleccionado.
 * @returns {Array<Record<string, any>>}
 */
function getFilteredCookies() {
  const q = state.search.trim().toLowerCase();
  return state.cookies.filter((c) => {
    if (state.filter === 'httpOnly' && !c.httpOnly) return false;
    if (state.filter === 'secure' && !c.secure) return false;
    if (state.filter === 'session' && !c.session) return false;

    if (q) {
      const nameMatch = String(c.name || '').toLowerCase().includes(q);
      const valMatch = String(c.value || '').toLowerCase().includes(q);
      if (!nameMatch && !valMatch) return false;
    }
    return true;
  });
}

/**
 * Renderiza la vista de reglas bloqueadas para el dominio activo.
 */
function renderBlockedRulesList() {
  dom.cookieList.innerHTML = '';
  const q = state.search.trim().toLowerCase();
  const rules = state.blockedRules
    .filter((r) => isDomainRelated(r.domain, state.activeHost))
    .filter((r) => !q || r.name.toLowerCase().includes(q) || r.domain.toLowerCase().includes(q));

  if (rules.length === 0) {
    dom.emptyDesc.textContent = t('emptyBlockedDesc', 'No hay reglas de bloqueo activas para este dominio.');
    dom.emptyState.classList.remove('hidden');
    return;
  }

  dom.emptyState.classList.add('hidden');
  for (const rule of rules) {
    const card = createEl('article', 'cookie-card is-blocked');
    card.setAttribute('role', 'listitem');

    const head = createEl('div', 'cookie-card-head');
    const info = createEl('div', 'cookie-main-info');
    const nameRow = createEl('div', 'cookie-name-row');
    nameRow.appendChild(createEl('span', 'cookie-name', rule.name));
    info.appendChild(nameRow);
    info.appendChild(createEl('div', 'cookie-domain-meta', rule.domain));

    const badges = createEl('div', 'badge-row');
    badges.appendChild(createEl('span', 'badge badge-blocked', t('badgeBlocked', 'Bloqueada')));
    info.appendChild(badges);

    const actions = createEl('div', 'cookie-quick-actions');
    const unblockBtn = createEl('button', 'mini-btn', t('btnUnblock', 'Desbloquear'));
    unblockBtn.type = 'button';
    unblockBtn.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      await unblockCookieRule(rule.domain, rule.name);
    });
    actions.appendChild(unblockBtn);

    head.appendChild(info);
    head.appendChild(actions);
    card.appendChild(head);
    dom.cookieList.appendChild(card);
  }
}

/**
 * Renderiza la lista principal de cookies del dominio activo.
 */
function renderCookieList() {
  updateFilterCounts();

  if (state.filter === 'blocked') {
    renderBlockedRulesList();
    return;
  }

  dom.cookieList.innerHTML = '';
  const items = getFilteredCookies();

  if (items.length === 0) {
    dom.emptyDesc.textContent = t(
      'emptyDesc',
      'Este dominio no tiene cookies visibles o el filtro actual no devuelve resultados.'
    );
    dom.emptyState.classList.remove('hidden');
    return;
  }

  dom.emptyState.classList.add('hidden');
  const blockedSet = new Set(state.blockedRules.map((r) => r.key));

  for (const cookie of items) {
    const sig = getCookieSignature(cookie);
    const isExpanded = state.expandedKeys.has(sig);
    const isBlocked = blockedSet.has(getBlockedCookieKey(cookie.domain, cookie.name));
    const jwtInfo = inspectJwt(cookie.value);

    const card = createEl('article', `cookie-card${isBlocked ? ' is-blocked' : ''}`);
    card.setAttribute('role', 'listitem');

    const head = createEl('div', 'cookie-card-head');
    head.addEventListener('click', () => {
      if (state.expandedKeys.has(sig)) {
        state.expandedKeys.delete(sig);
      } else {
        state.expandedKeys.add(sig);
      }
      renderCookieList();
    });

    const info = createEl('div', 'cookie-main-info');
    const nameRow = createEl('div', 'cookie-name-row');
    nameRow.appendChild(createEl('span', 'cookie-name', cookie.name));
    info.appendChild(nameRow);
    info.appendChild(createEl('div', 'cookie-domain-meta', `${cookie.domain}${cookie.path || '/'}`));

    const badges = createEl('div', 'badge-row');
    if (cookie.httpOnly) {
      badges.appendChild(createEl('span', 'badge badge-httponly', t('badgeHttpOnly', 'HttpOnly')));
    }
    if (cookie.secure) {
      badges.appendChild(createEl('span', 'badge badge-secure', t('badgeSecure', 'Secure')));
    }
    if (cookie.session) {
      badges.appendChild(createEl('span', 'badge badge-session', t('badgeSession', 'Sesión')));
    }
    if (cookie.hostOnly) {
      badges.appendChild(createEl('span', 'badge badge-hostonly', t('badgeHostOnly', 'Host-only')));
    }
    if (jwtInfo) {
      badges.appendChild(createEl('span', 'badge badge-jwt', t('badgeJwt', 'JWT')));
    }
    if (isBlocked) {
      badges.appendChild(createEl('span', 'badge badge-blocked', t('badgeBlocked', 'Bloqueada')));
    }
    info.appendChild(badges);

    const actions = createEl('div', 'cookie-quick-actions');

    const editBtn = createEl('button', 'mini-btn', '✎');
    editBtn.type = 'button';
    editBtn.title = t('btnEdit', 'Editar');
    editBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      openEditorModal('edit', cookie);
    });
    actions.appendChild(editBtn);

    const dupBtn = createEl('button', 'mini-btn', '⧉');
    dupBtn.type = 'button';
    dupBtn.title = t('btnDuplicate', 'Duplicar');
    dupBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      openEditorModal('duplicate', cookie);
    });
    actions.appendChild(dupBtn);

    const blockBtn = createEl('button', 'mini-btn mini-btn-warn', isBlocked ? '✓' : '⊘');
    blockBtn.type = 'button';
    blockBtn.title = isBlocked ? t('btnUnblock', 'Desbloquear') : t('btnBlock', 'Bloquear');
    blockBtn.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      if (isBlocked) {
        await unblockCookieRule(cookie.domain, cookie.name);
      } else {
        await blockCookieRule(cookie);
      }
    });
    actions.appendChild(blockBtn);

    const delBtn = createEl('button', 'mini-btn mini-btn-danger', '✕');
    delBtn.type = 'button';
    delBtn.title = t('btnDelete', 'Eliminar');
    delBtn.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      await deleteSingleCookie(cookie);
    });
    actions.appendChild(delBtn);

    head.appendChild(info);
    head.appendChild(actions);
    card.appendChild(head);

    if (isExpanded) {
      const details = createEl('div', 'cookie-details');

      const valueBox = createEl('div', 'value-box');
      valueBox.appendChild(createEl('p', 'value-text', cookie.value || ''));
      const copyBtn = createEl('button', 'mini-btn', t('btnCopy', 'Copiar'));
      copyBtn.type = 'button';
      copyBtn.addEventListener('click', async () => {
        await copyToClipboard(cookie.value || '');
      });
      valueBox.appendChild(copyBtn);
      details.appendChild(valueBox);

      const meta = createEl('div', 'meta-grid');
      const expText = cookie.session
        ? t('badgeSession', 'Sesión')
        : cookie.expirationDate
          ? new Date(cookie.expirationDate * 1000).toLocaleString()
          : '—';

      const appendMeta = (label, val) => {
        const cell = createEl('div');
        cell.appendChild(createEl('strong', '', `${label}: `));
        cell.appendChild(document.createTextNode(val));
        meta.appendChild(cell);
      };

      appendMeta('SameSite', cookie.sameSite || 'unspecified');
      appendMeta(t('labelExpiration', 'Expiración'), expText);
      details.appendChild(meta);

      if (jwtInfo) {
        details.appendChild(buildJwtPanelElement(jwtInfo));
      }

      card.appendChild(details);
    }

    dom.cookieList.appendChild(card);
  }
}

/**
 * Copia texto al portapapeles con feedback visual.
 * @param {string} text
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(t('toastCopied', 'Copiado al portapapeles'));
  } catch {
    showToast(t('toastError', 'No se pudo copiar'), true);
  }
}

/**
 * Descarga un archivo local generado en memoria (JSON o cookies.txt).
 * @param {string} filename
 * @param {string} content
 * @param {string} mimeType
 */
function triggerDownload(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Recarga cookies y reglas bloqueadas desde Chrome y refresca el popup.
 */
async function refreshData() {
  if (!state.activeTab || state.restricted) return;

  const [cookies, bgRes] = await Promise.all([
    getCookiesForTabUrl(chrome.cookies, state.activeTab.url),
    sendBgMessage({ type: 'GET_BLOCKED_COOKIES' })
  ]);

  state.cookies = cookies;
  state.blockedRules = Array.isArray(bgRes?.blocked) ? bgRes.blocked : [];
  dom.domainPill.textContent = `${state.activeHost} (${cookies.length})`;

  await sendBgMessage({
    type: 'REFRESH_BADGE',
    tabId: state.activeTab.id,
    tabUrl: state.activeTab.url
  });

  renderCookieList();
}

/**
 * Elimina una única cookie.
 * @param {Record<string, any>} cookie
 */
async function deleteSingleCookie(cookie) {
  try {
    const fallbackProtocol = state.activeTab?.url ? new URL(state.activeTab.url).protocol : 'https:';
    const details = buildCookieRemovalDetails(cookie, fallbackProtocol);
    await chrome.cookies.remove(details);
    showToast(t('toastDeleted', 'Cookie eliminada'));
    await refreshData();
  } catch (err) {
    showToast(err?.message || t('toastError', 'Error al eliminar'), true);
  }
}

/**
 * Bloquea una cookie persistiendo la regla en el Service Worker.
 * @param {Record<string, any>} cookie
 */
async function blockCookieRule(cookie) {
  const res = await sendBgMessage({
    type: 'BLOCK_COOKIE',
    domain: cookie.domain,
    name: cookie.name,
    cookie
  });
  if (res?.ok) {
    showToast(t('toastBlocked', 'Cookie bloqueada y eliminada'));
    await refreshData();
  } else {
    showToast(res?.error || t('toastError', 'Error al bloquear'), true);
  }
}

/**
 * Desbloquea una regla de cookie.
 * @param {string} domain
 * @param {string} name
 */
async function unblockCookieRule(domain, name) {
  const res = await sendBgMessage({
    type: 'UNBLOCK_COOKIE',
    domain,
    name
  });
  if (res?.ok) {
    showToast(t('toastUnblocked', 'Cookie desbloqueada'));
    await refreshData();
  } else {
    showToast(res?.error || t('toastError', 'Error al desbloquear'), true);
  }
}

/**
 * Sincroniza la vista previa de JWT dentro del modal editor.
 */
function updateEditorJwtPreview() {
  const jwtInfo = inspectJwt(dom.fieldValue.value);
  if (!jwtInfo) {
    dom.editorJwtDetails.classList.add('hidden');
    return;
  }

  const locale = getUiLocale();
  dom.editorJwtDetails.classList.remove('hidden');
  dom.editorJwtStatus.className = 'jwt-status-pill';
  if (jwtInfo.status === 'expired') {
    dom.editorJwtStatus.classList.add('jwt-status-expired');
    dom.editorJwtStatus.textContent = t('jwtExpired', 'Expirado');
  } else if (jwtInfo.status === 'valid') {
    dom.editorJwtStatus.classList.add('jwt-status-valid');
    dom.editorJwtStatus.textContent = t('jwtValid', 'Vigente');
  } else {
    dom.editorJwtStatus.classList.add('jwt-status-neutral');
    dom.editorJwtStatus.textContent =
      jwtInfo.status === 'not_yet_valid'
        ? t('jwtNotYetValid', 'Aún no válido')
        : t('jwtNoExp', 'Sin expiración');
  }

  const expMeta = jwtInfo.expiresAt
    ? `${jwtInfo.expiresAt} (${formatJwtRelativeTime(jwtInfo.remainingSeconds, locale)})`
    : formatJwtRelativeTime(null, locale);
  dom.editorJwtMeta.textContent = `${jwtInfo.algorithm ? `alg: ${jwtInfo.algorithm} · ` : ''}exp: ${expMeta}`;
  dom.editorJwtPayload.textContent = JSON.stringify(jwtInfo.payload, null, 2);
  dom.editorJwtHeader.textContent = JSON.stringify(jwtInfo.header, null, 2);
}

/**
 * Aplica la regla obligatoria SameSite=no_restriction -> Secure=true en el formulario.
 */
function syncSameSiteSecureConstraint() {
  const isNone = dom.fieldSameSite.value === 'no_restriction';
  dom.sameSiteNotice.classList.toggle('hidden', !isNone);
  if (isNone) {
    dom.fieldSecure.checked = true;
  }
}

/**
 * Abre el modal editor en modo crear, editar o duplicar.
 * @param {'create' | 'edit' | 'duplicate'} mode
 * @param {Record<string, any> | null} [cookie=null]
 */
function openEditorModal(mode, cookie = null) {
  state.editorMode = mode;
  state.editingOriginal = mode === 'edit' ? cookie : null;
  dom.editorError.classList.add('hidden');

  if (mode === 'create') {
    dom.editorTitle.textContent = t('modalCreateTitle', 'Nueva cookie');
    dom.fieldName.value = '';
    dom.fieldValue.value = '';
    dom.fieldDomain.value = state.activeHost;
    dom.fieldPath.value = '/';
    dom.fieldSameSite.value = 'lax';
    dom.fieldSession.checked = false;
    dom.fieldExpiration.value = toDatetimeLocalValue(Math.floor(Date.now() / 1000) + 86400 * 30);
    dom.fieldHttpOnly.checked = false;
    dom.fieldSecure.checked = state.activeTab?.url?.startsWith('https://') || false;
  } else {
    dom.editorTitle.textContent =
      mode === 'edit'
        ? t('modalEditTitle', 'Editar cookie')
        : t('modalDuplicateTitle', 'Duplicar cookie');

    dom.fieldName.value = mode === 'duplicate' ? `${cookie.name}_copy` : cookie.name;
    dom.fieldValue.value = cookie.value || '';
    dom.fieldDomain.value = cookie.hostOnly ? normalizeDomain(cookie.domain) : cookie.domain;
    dom.fieldPath.value = cookie.path || '/';
    dom.fieldSameSite.value = cookie.sameSite || 'unspecified';
    dom.fieldSession.checked = Boolean(cookie.session);
    dom.fieldExpiration.value = cookie.session
      ? ''
      : toDatetimeLocalValue(cookie.expirationDate);
    dom.fieldHttpOnly.checked = Boolean(cookie.httpOnly);
    dom.fieldSecure.checked = Boolean(cookie.secure);
  }

  dom.fieldExpiration.disabled = dom.fieldSession.checked;
  syncSameSiteSecureConstraint();
  updateEditorJwtPreview();
  dom.modalEditor.classList.remove('hidden');
  dom.fieldName.focus();
}

/**
 * Abre el modal Importar/Exportar actualizando la vista previa de exportación.
 */
function openIoModal() {
  dom.importError.classList.add('hidden');
  dom.exportPreview.textContent = exportCookiesToJson(state.cookies, true);
  switchIoTab('export');
  dom.modalIo.classList.remove('hidden');
}

/**
 * Cambia entre las pestañas Exportar / Importar.
 * @param {'export' | 'import'} tabName
 */
function switchIoTab(tabName) {
  for (const btn of dom.ioTabs) {
    btn.classList.toggle('active', btn.getAttribute('data-io-tab') === tabName);
  }
  dom.ioPanelExport.classList.toggle('hidden', tabName !== 'export');
  dom.ioPanelImport.classList.toggle('hidden', tabName !== 'import');
}

/**
 * Cierra un modal por id.
 * @param {string} modalId
 */
function closeModal(modalId) {
  document.getElementById(modalId)?.classList.add('hidden');
}

/**
 * Inicializa todos los listeners de eventos de la UI.
 */
function bindUiEvents() {
  dom.searchInput.addEventListener('input', () => {
    state.search = dom.searchInput.value;
    dom.btnClearSearch.classList.toggle('hidden', !state.search);
    renderCookieList();
  });

  dom.btnClearSearch.addEventListener('click', () => {
    state.search = '';
    dom.searchInput.value = '';
    dom.btnClearSearch.classList.add('hidden');
    renderCookieList();
  });

  for (const chip of dom.filterChips) {
    chip.addEventListener('click', () => {
      state.filter = chip.getAttribute('data-filter') || 'all';
      for (const c of dom.filterChips) {
        c.classList.toggle('active', c === chip);
      }
      renderCookieList();
    });
  }

  dom.btnNewCookie.addEventListener('click', () => openEditorModal('create'));
  dom.btnIo.addEventListener('click', () => openIoModal());
  dom.btnReloadTab.addEventListener('click', async () => {
    if (state.activeTab?.id !== undefined) {
      await chrome.tabs.reload(state.activeTab.id);
      window.close();
    }
  });
  dom.btnDeleteAll.addEventListener('click', () => {
    dom.modalConfirm.classList.remove('hidden');
  });

  for (const btn of document.querySelectorAll('[data-close-modal]')) {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-close-modal');
      if (id) closeModal(id);
    });
  }

  dom.fieldSession.addEventListener('change', () => {
    dom.fieldExpiration.disabled = dom.fieldSession.checked;
  });

  dom.fieldSameSite.addEventListener('change', syncSameSiteSecureConstraint);
  dom.fieldSecure.addEventListener('change', () => {
    if (dom.fieldSameSite.value === 'no_restriction' && !dom.fieldSecure.checked) {
      dom.fieldSecure.checked = true;
      dom.sameSiteNotice.classList.remove('hidden');
    }
  });

  dom.fieldValue.addEventListener('input', updateEditorJwtPreview);

  dom.cookieForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    dom.editorError.classList.add('hidden');

    try {
      const isSession = dom.fieldSession.checked;
      const expSeconds = isSession ? undefined : fromDatetimeLocalValue(dom.fieldExpiration.value);

      const details = buildCookieSetDetails(
        {
          name: dom.fieldName.value,
          value: dom.fieldValue.value,
          domain: dom.fieldDomain.value,
          path: dom.fieldPath.value,
          sameSite: dom.fieldSameSite.value,
          session: isSession,
          expirationDate: expSeconds,
          httpOnly: dom.fieldHttpOnly.checked,
          secure: dom.fieldSecure.checked,
          storeId: state.editingOriginal?.storeId
        },
        { tabUrl: state.activeTab?.url }
      );

      const created = await chrome.cookies.set(details);
      if (!created) {
        throw new Error(t('toastError', 'No se pudo guardar la cookie'));
      }

      if (state.editorMode === 'edit' && state.editingOriginal) {
        if (getCookieSignature(state.editingOriginal) !== getCookieSignature(created)) {
          const fallbackProtocol = state.activeTab?.url
            ? new URL(state.activeTab.url).protocol
            : 'https:';
          await chrome.cookies.remove(buildCookieRemovalDetails(state.editingOriginal, fallbackProtocol));
        }
      }

      closeModal('modal-editor');
      showToast(t('toastSaved', 'Cookie guardada correctamente'));
      await refreshData();
    } catch (err) {
      dom.editorError.textContent = err?.message || t('toastError', 'Error al guardar');
      dom.editorError.classList.remove('hidden');
    }
  });

  for (const tab of dom.ioTabs) {
    tab.addEventListener('click', () => {
      switchIoTab(tab.getAttribute('data-io-tab') || 'export');
    });
  }

  dom.btnCopyJson.addEventListener('click', async () => {
    const content = exportCookiesToJson(state.cookies, true);
    dom.exportPreview.textContent = content;
    await copyToClipboard(content);
  });

  dom.btnDownloadJson.addEventListener('click', () => {
    const content = exportCookiesToJson(state.cookies, true);
    triggerDownload(`${state.activeHost || 'cookies'}.cookies.json`, content, 'application/json');
  });

  dom.btnCopyNetscape.addEventListener('click', async () => {
    try {
      const content = exportCookiesToNetscape(state.cookies);
      dom.exportPreview.textContent = content;
      await copyToClipboard(content);
    } catch (err) {
      showToast(err?.message || t('toastError', 'Error al exportar'), true);
    }
  });

  dom.btnDownloadNetscape.addEventListener('click', () => {
    try {
      const content = exportCookiesToNetscape(state.cookies);
      triggerDownload(`${state.activeHost || 'cookies'}.cookies.txt`, content, 'text/plain');
    } catch (err) {
      showToast(err?.message || t('toastError', 'Error al exportar'), true);
    }
  });

  dom.btnLoadFile.addEventListener('click', () => {
    dom.importFileInput.click();
  });

  dom.importFileInput.addEventListener('change', async () => {
    const file = dom.importFileInput.files?.[0];
    if (!file) return;
    dom.importTextarea.value = await file.text();
    dom.importFileInput.value = '';
  });

  dom.btnApplyImport.addEventListener('click', async () => {
    dom.importError.classList.add('hidden');
    try {
      const { cookies } = detectAndParseCookies(dom.importTextarea.value);
      let importedCount = 0;
      let failedCount = 0;

      for (const item of cookies) {
        try {
          const details = buildCookieSetDetails(item, { tabUrl: state.activeTab?.url });
          const res = await chrome.cookies.set(details);
          if (res) importedCount += 1;
          else failedCount += 1;
        } catch {
          failedCount += 1;
        }
      }

      if (importedCount === 0) {
        throw new Error(t('toastError', 'Ninguna cookie pudo ser importada para este contexto.'));
      }

      closeModal('modal-io');
      dom.importTextarea.value = '';
      showToast(
        failedCount > 0
          ? `${t('toastImported', 'Cookies importadas')}: ${importedCount} (omitidas: ${failedCount})`
          : `${t('toastImported', 'Cookies importadas')}: ${importedCount}`
      );
      await refreshData();
    } catch (err) {
      dom.importError.textContent = err?.message || t('toastError', 'Formato inválido');
      dom.importError.classList.remove('hidden');
    }
  });

  dom.btnConfirmDeleteAll.addEventListener('click', async () => {
    try {
      const fallbackProtocol = state.activeTab?.url ? new URL(state.activeTab.url).protocol : 'https:';
      await Promise.all(
        state.cookies.map((c) => chrome.cookies.remove(buildCookieRemovalDetails(c, fallbackProtocol)))
      );
      closeModal('modal-confirm');
      showToast(t('toastCleared', 'Cookies del dominio eliminadas'));
      await refreshData();
    } catch (err) {
      closeModal('modal-confirm');
      showToast(err?.message || t('toastError', 'Error al limpiar cookies'), true);
    }
  });
}

/**
 * Punto de entrada del popup: detecta pestaña activa y maneja URLs restringidas sin errores.
 */
async function init() {
  applyTranslationsAndLinks();
  bindUiEvents();

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs?.[0] || null;
    state.activeTab = activeTab;

    if (!activeTab?.url || isRestrictedUrl(activeTab.url)) {
      state.restricted = true;
      dom.domainPill.textContent = 'URL restringida';
      dom.restrictedUrl.textContent = activeTab?.url || 'about:blank';
      dom.restrictedView.classList.remove('hidden');
      dom.mainView.classList.add('hidden');
      dom.btnNewCookie.disabled = true;
      dom.btnIo.disabled = true;
      dom.btnDeleteAll.disabled = true;
      dom.btnReloadTab.disabled = !activeTab?.id;
      return;
    }

    const parsed = new URL(activeTab.url);
    state.activeHost = parsed.hostname;
    state.restricted = false;
    dom.restrictedView.classList.add('hidden');
    dom.mainView.classList.remove('hidden');

    await refreshData();
  } catch (err) {
    state.restricted = true;
    dom.restrictedUrl.textContent = err?.message || 'about:blank';
    dom.restrictedView.classList.remove('hidden');
    dom.mainView.classList.add('hidden');
  }
}

void init();
