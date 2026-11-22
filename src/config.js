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
  bgPrimary: '#FAF7F2',
  bgSurface: '#FFFFFF',
  bgSurfaceHover: '#FFF1E0',
  border: '#E4DDD3',
  textPrimary: '#111111',
  textMuted: '#57534E',
  accentPrimary: '#EA580C',
  accentSecondary: '#18181B',
  danger: '#DC2626',
  warning: '#D97706'
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
  backgroundColor: '#EA580C',
  textColor: '#FFFFFF',
  blockedBackgroundColor: '#111111'
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
