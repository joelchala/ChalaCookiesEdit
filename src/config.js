/**
 * @fileoverview Configuración central de ChalaCookiesEdit (Suite Chala).
 * Paleta "Escudo Cibernético", prefijos de URL restringidas, claves de almacenamiento
 * y enlaces oficiales de la Suite Chala.
 */

export const APP_META = Object.freeze({
  name: 'ChalaCookiesEdit',
  suite: 'Suite Chala',
  author: 'Joel Rafael Chala García / Coposys',
  version: '1.0.0'
});

export const THEME_PALETTE = Object.freeze({
  bgPrimary: '#0F172A',
  bgSurface: '#1E293B',
  bgSurfaceHover: '#263549',
  border: '#334155',
  textPrimary: '#F1F5F9',
  textMuted: '#94A3B8',
  accentPrimary: '#10B981',
  accentSecondary: '#06B6D4',
  danger: '#EF4444',
  warning: '#F59E0B'
});

export const RESTRICTED_URL_PREFIXES = Object.freeze([
  'chrome://',
  'edge://',
  'about:',
  'chrome-extension://',
  'edge-extension://',
  'extension://',
  'devtools://',
  'view-source:',
  'file://',
  'brave://',
  'opera://',
  'vivaldi://',
  'moz-extension://',
  'data:',
  'blob:',
  'javascript:'
]);

export const STORAGE_KEYS = Object.freeze({
  BLOCKED_COOKIES: 'chala_blocked_cookies',
  PREFERENCES: 'chala_preferences'
});

export const BADGE_CONFIG = Object.freeze({
  backgroundColor: '#10B981',
  textColor: '#0F172A',
  blockedBackgroundColor: '#EF4444'
});

export const SUITE_LINKS = Object.freeze({
  suiteHome: 'https://chaladev.site',
  coposys: 'https://coposys.com.do',
  paypal: 'https://www.paypal.com/paypalme/coposys',
  apps: Object.freeze([
    'Chalablock',
    'ChalaVPN',
    'ChalaTabs',
    'ChalaDev',
    'ChalaCookiesEdit'
  ])
});
