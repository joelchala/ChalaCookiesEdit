# ChalaCookiesEdit

**ChalaCookiesEdit** es una extensión Manifest V3 (Chromium / Google Chrome / Microsoft Edge) perteneciente a la **Suite Chala** (junto a *Chalablock*, *ChalaVPN*, *ChalaTabs* y *ChalaDev*). Permite editar, crear, duplicar, inspeccionar tokens JWT, bloquear, importar y exportar cookies de forma **100 % local**, sin dependencias externas en producción ni telemetría.

---

## Características principales

- **Detección automática de pestaña y URLs restringidas:** Opera sobre el dominio activo (incluyendo subdominios) y muestra un aviso limpio en páginas protegidas (`chrome://`, `edge://`, `about:`, `chrome-extension://`, etc.) sin errores en consola.
- **Buscador y filtros instantáneos:** Filtra por nombre o valor y mediante accesos rápidos (`Todas`, `HttpOnly`, `Secure`, `Sesión`, `Bloqueadas`).
- **CRUD completo con reglas estrictas MV3:**
  - Crear, editar, duplicar y eliminar cookies individuales o limpiar todas las del dominio.
  - Si `SameSite = no_restriction` (`None`), fuerza automáticamente `Secure = true` y esquema `https://` para cumplir las políticas de Chromium.
  - Distingue cookies *host-only* (campo dominio vacío o igual al host exacto) frente a cookies compartidas con subdominios (dominio con punto inicial `.ejemplo.com`).
- **Inspector JWT 100 % local:** Detecta automáticamente cookies cuyo valor tenga formato `header.payload.signature` (incluso con prefijo `Bearer `), decodifica en Base64URL + UTF-8 sin red y muestra `Header`, `Payload`, algoritmo y vigencia (`exp` / `nbf`).
- **Bloqueo persistente en tiempo real:** Las cookies marcadas como bloqueadas (`dominio + nombre`) se guardan en `chrome.storage.local` y el Service Worker las intercepta y elimina automáticamente mediante `chrome.cookies.onChanged` si el sitio intenta recrearlas.
- **Importación y exportación bidireccional:**
  - **JSON** (portapapeles o descarga `.json`).
  - **Netscape `cookies.txt`** (compatible con `curl`, `wget` y `yt-dlp`, incluyendo soporte `#HttpOnly_`).
- **Badge por pestaña:** Muestra en el icono de la extensión el contador de cookies activas de la pestaña actual.

---

## Versión y lanzamientos (`v1.0.0`)

- **Versión actual:** `v1.0.0` (sincronizada en `dist/version`, `package.json` y `src/manifest.json`).
- **Release en GitHub:** [Release v1.0.0](https://github.com/joelchala/ChalaCookiesEdit/releases/tag/v1.0.0) con paquetes listos para tienda adjuntos (`ChalaCookiesEdit_1.0.0.chromium.zip` y `ChalaCookiesEdit_1.0.0.edge.zip`).
- **CI/CD automático:** Cada push a `main` ejecuta `generate-icons.mjs`, `tests/verify.mjs` y `make-mv3.mjs`; los tags `v*` publican automáticamente el Release en GitHub.

---

## Compatibilidad

| Componente / Plataforma | Requisito o soporte | Notas |
| :--- | :--- | :--- |
| **Google Chrome / Chromium** | `>= 109` (`minimum_chrome_version`) | Manifest V3 con Service Worker ES module (`"type": "module"`). |
| **Microsoft Edge** | `>= 109` (basado en Chromium) | Compatible con carga descomprimida y paquete `.edge.zip`. |
| **Node.js (Build & Tests)** | `>= 22.0.0` | Cero `dependencies` y cero `devDependencies`; probado en Windows, macOS y Linux. |
| **Formatos de intercambio** | JSON y Netscape `cookies.txt` | Compatible con `curl`, `wget` y `yt-dlp` (incluye `#HttpOnly_`). |
| **Reglas de seguridad MV3** | `SameSite=None` y URLs internas | Fuerza `Secure=true` + `https://` en `SameSite=None`; omite `chrome://`, `edge://`, `about:` y `chrome-extension://`. |

---

## Requisitos y estructura

- **Node.js >= 22** (cero `dependencies` y cero `devDependencies`).

```text
ChalaCookiesEdit/
├── .github/workflows/build.yml
├── dist/
│   ├── README.md
│   ├── version
│   └── build/ChalaCookiesEdit.chromium/
├── docs/
│   ├── README.md
│   └── index.html
├── src/
│   ├── _locales/{es,en}/messages.json
│   ├── icons/
│   ├── lib/{cookie-formats.js,jwt-inspector.js}
│   ├── popup/{index.html,styles.css,app.js}
│   ├── background.js
│   ├── config.js
│   └── manifest.json
├── store/
│   ├── ficha-tienda.md
│   ├── ficha-chrome-web-store.md
│   ├── README-activos.md
│   └── paquetes/
├── tests/verify.mjs
└── tools/{generate-icons.mjs,make-mv3.mjs,make-mv3.sh,make-clean.sh}
```

---

## Comandos de compilación y verificación

```bash
# 1. Generar iconos PNG y SVG nativos (Node.js puro)
npm run icons

# 2. Ejecutar la suite integral de pruebas (node:assert)
npm test

# 3. Compilar build descomprimido y paquetes .zip para Chrome y Edge
npm run build

# 4. Limpiar artefactos generados (dist/build y store/paquetes)
npm run clean
```

---

## Instalación en modo desarrollador

Consulta la guía paso a paso en [dist/README.md](dist/README.md) para cargar la carpeta `dist/build/ChalaCookiesEdit.chromium/` en Google Chrome o Microsoft Edge.

---

## Privacidad y Licencia

- **Política de privacidad (ES / EN):** [PRIVACY.md](PRIVACY.md)
- **Licencia:** MIT — © 2026 Joel Rafael Chala García / Coposys ([chaladev.site](https://chaladev.site) · [coposys.com.do](https://coposys.com.do))
