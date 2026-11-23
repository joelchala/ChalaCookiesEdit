# ChalaCookiesEdit

**ChalaCookiesEdit** es una extensión Manifest V3 (Chromium / Google Chrome / Microsoft Edge) perteneciente a la **Suite Chala** (junto a *Chalablock*, *ChalaVPN*, *ChalaTabs*, *ChalaDev*, *ChalaReader* y *ChalaScrape*). Permite editar, crear, duplicar, inspeccionar tokens JWT, gestionar cookies particionadas (CHIPS), bloquear en tiempo real, importar y exportar cookies de forma **100 % local**, con interfaz clásica clara en naranja y negro, sin dependencias externas en producción ni telemetría.

---

## Características principales

- **Principio de mínimo privilegio y detección de URLs restringidas:** Opera únicamente sobre sitios `http://*/*` y `https://*/*` (sin `<all_urls>`, sin `activeTab` redundante y sin `content_scripts`) y muestra un aviso limpio en páginas protegidas (`chrome://`, `edge://`, `about:`, `chrome-extension://`, etc.).
- **Interfaz clásica clara (Naranja y Negro):** Diseño limpio de alto contraste con buscador instantáneo por nombre/valor y filtros rápidos (`Todas`, `HttpOnly`, `Secure`, `Sesión`, `Bloqueadas`).
- **CRUD completo con reglas estrictas MV3, CHIPS e Incógnito:**
  - Crear, editar, duplicar y eliminar cookies individuales o limpiar todas las del dominio con confirmación.
  - **Soporte CHIPS (Cookies Particionadas):** Lee, edita y elimina cookies con `partitionKey` (`topLevelSite`) mostrando la insignia `Partitioned`.
  - **Aislamiento de Modo Incógnito:** Resuelve el `storeId` real de la pestaña activa mediante `chrome.cookies.getAllCookieStores()` para aislar sesiones normales e incógnito.
  - Si `SameSite = no_restriction` (`None`) o la cookie es particionada, fuerza automáticamente `Secure = true` y esquema `https://`.
  - Distingue cookies *host-only* frente a cookies compartidas con subdominios (`.ejemplo.com`).
- **Inspector JWT 100 % local (en lista y en editor en vivo):** Detecta automáticamente tokens `header.payload.signature` (incluso con prefijo `Bearer `), decodifica en Base64URL + UTF-8 sin red y muestra `Header`, `Payload`, algoritmo y vigencia (`exp` / `nbf`).
- **Bloqueo persistente en tiempo real:** Las reglas (`storeId:dominio:nombre`) se guardan en `chrome.storage.local` y el Service Worker las intercepta y elimina al instante mediante `chrome.cookies.onChanged` si el sitio intenta recrearlas.
- **Importación y exportación bidireccional con protección Cross-Domain:**
  - **JSON** (portapapeles o descarga `.json`).
  - **Netscape `cookies.txt`** (compatible con `curl`, `wget` y `yt-dlp`, incluyendo soporte `#HttpOnly_`).
  - **Validación estricta de dominio y protección contra *Session Fixation*:** Rechaza dominios maliciosos (`@`, `:`, `/`, credenciales embebidas), filtra por defecto al dominio activo/subdominios y muestra una advertencia de seguridad exigiendo confirmación explícita si el lote incluye dominios externos.
- **Badge optimizado por pestaña:** Muestra el contador de cookies activas con filtrado por host activo y *debounce* de 400 ms en el Service Worker.

---

## Versión y lanzamientos (`v1.0.0`)

- **Versión actual:** `v1.0.0` (sincronizada en `dist/version`, `package.json`, `src/config.js` y `src/manifest.json`).
- **Release en GitHub:** [Release v1.0.0](https://github.com/joelchala/ChalaCookiesEdit/releases/tag/v1.0.0) con paquetes listos para tienda adjuntos (`ChalaCookiesEdit_1.0.0.chromium.zip` y `ChalaCookiesEdit_1.0.0.edge.zip`).
- **CI/CD endurecido:** Permisos de mínimo privilegio (`contents: read` global y `contents: write` aislado al job de release en tags `v*`) y GitHub Actions fijadas por SHA de commit completo.

---

## Compatibilidad

| Componente / Plataforma | Requisito o soporte | Notas |
| :--- | :--- | :--- |
| **Google Chrome / Chromium** | `>= 109` (`minimum_chrome_version`) | Manifest V3 con Service Worker ES module (`"type": "module"`). |
| **Microsoft Edge** | `>= 109` (basado en Chromium) | Compatible con carga descomprimida y paquete `.edge.zip`. |
| **Cookies Particionadas (CHIPS)** | Chromium `>= 119` (con fallback `< 119`) | Consulta `partitionKey: {}` y preserva `partitionKey` en edición/borrado. |
| **Node.js (Build & Tests)** | `>= 22.0.0` | Cero `dependencies` y cero `devDependencies`; suite de 14 pruebas integrales. |
| **Formatos de intercambio** | JSON y Netscape `cookies.txt` | Compatible con `curl`, `wget` y `yt-dlp` (incluye `#HttpOnly_`). |

---

## Requisitos y estructura

- **Node.js >= 22** (cero `dependencies` y cero `devDependencies`).

```text
ChalaCookiesEdit/
├── .github/workflows/build.yml
├── dist/
│   ├── README.md
│   ├── version
│   └── build/
│       ├── ChalaCookiesEdit.chromium/
│       ├── ChalaCookiesEdit_1.0.0.chromium.zip
│       └── ChalaCookiesEdit_1.0.0.edge.zip
├── docs/
│   ├── README.md
│   └── index.html
├── src/
│   ├── _locales/{es,en}/messages.json
│   ├── icons/{icon.svg,icon16.png,icon32.png,icon48.png,icon128.png}
│   ├── lib/{cookie-formats.js,jwt-inspector.js}
│   ├── popup/{index.html,styles.css,app.js}
│   ├── background.js
│   ├── config.js
│   └── manifest.json
├── store/
│   ├── ficha-tienda.md
│   ├── ficha-chrome-web-store.md
│   ├── README-activos.md
│   ├── logo-300x300.png
│   ├── promo-440x280.png
│   ├── promo-1400x560.png
│   ├── screenshot-{1..6}-1280x800.png
│   └── paquetes/
├── tests/verify.mjs
└── tools/{generate-icons.mjs,make-mv3.mjs,make-mv3.sh,make-clean.sh}
```

---

## Comandos de compilación y verificación

```bash
# 1. Generar iconos PNG y SVG nativos (Node.js puro)
npm run icons

# 2. Ejecutar la suite integral de 14 pruebas (node:assert)
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

## Suite Chala

**ChalaCookiesEdit** forma parte de la **Suite Chala** de extensiones para navegador enfocadas en privacidad, rendimiento y productividad:

- **[Chalablock](https://github.com/joelchala/Chalablock)** — Bloqueador de anuncios y rastreadores ligero (Manifest V3)
- **[ChalaCookiesEdit](https://github.com/joelchala/ChalaCookiesEdit)** — Editor de cookies local con soporte CHIPS, incógnito, bloqueo e inspector JWT
- **[ChalaDev](https://github.com/joelchala/ChalaDev)** — Suite de utilidades locales en el Side Panel para desarrolladores y diseñadores UI/UX
- **[ChalaReader](https://github.com/joelchala/ChalaReader)** — Modo lectura limpio con Shadow DOM, temas visuales, Markdown, PDF y guardado offline
- **[ChalaScrape](https://github.com/joelchala/ChalaScrape)** — Extractor visual de tablas, listas y tarjetas web a Excel (`.xlsx`) y CSV
- **[ChalaTabs](https://github.com/joelchala/ChalaTabs)** — Gestor de pestañas en espacios de trabajo, ahorro de RAM y buscador instantáneo
- **[ChalaVPN](https://github.com/joelchala/ChalaVPN)** — Proxy HTTPS/SOCKS5 con protección contra fugas de WebRTC

---

## Privacidad y Licencia

- **Política de privacidad (ES / EN):** [PRIVACY.md](PRIVACY.md)
- **Licencia:** MIT — © 2026 Joel Rafael Chala García / Coposys ([chaladev.site](https://chaladev.site) · [coposys.com.do](https://coposys.com.do))
