# Ficha de Tienda — Chrome Web Store (CWS)

## 1. Información Principal / Store Listing

- **Nombre (ES):** ChalaCookiesEdit — Editor y Gestor de Cookies
- **Name (EN):** ChalaCookiesEdit — Cookie Editor & Manager
- **Descripción breve ES (115 chars <= 132):** Edita, inspecciona JWT, bloquea, importa y exporta cookies (JSON y Netscape) 100% local y sin rastreo. Suite Chala.
- **Short description EN (124 chars <= 132):** Edit, inspect JWTs, block, import and export cookies (JSON & Netscape) 100% locally with zero tracking. Part of Suite Chala.
- **Categoría:** Herramientas para desarrolladores / Developer Tools
- **Idioma predeterminado:** Español (`es`), con soporte completo en Inglés (`en`)

### Descripción Completa (ES / EN)
**ChalaCookiesEdit** es un editor avanzado de cookies, inspector JWT local y bloqueador persistente para Google Chrome y navegadores Chromium (Manifest V3), parte de la **Suite Chala**.

**Funciones incluidas:**
1. **Edición completa (CRUD):** Crea, edita, duplica, busca y filtra cookies (`Todas`, `HttpOnly`, `Secure`, `Sesión`, `Bloqueadas`).
2. **Inspector JWT local:** Decodifica tokens `header.payload.signature` sin internet ni servidores externos y calcula si el token sigue vigente o ha expirado (`exp`).
3. **Bloqueo persistente:** Bloquea cookies por `dominio + nombre` y elimínalas automáticamente mediante Service Worker (`chrome.cookies.onChanged`) si el sitio vuelve a crearlas.
4. **Exportación e importación JSON y Netscape `cookies.txt`:** Compatible con herramientas CLI como `curl`, `wget` y `yt-dlp`.
5. **Privacidad total:** Sin analíticas, sin rastreo, sin dependencias externas de npm ni servidores remotos.

---

## 2. Declaración de Propósito Único (Single Purpose Description)

**EN (for CWS Review Form):**
ChalaCookiesEdit has a single purpose: enabling users and web developers to inspect, create, edit, block, import, and export browser cookies (including local JWT payload inspection) for the active website tab, 100% locally within the browser.

**ES:**
ChalaCookiesEdit tiene un único propósito: permitir a usuarios y desarrolladores web inspeccionar, crear, editar, bloquear, importar y exportar cookies del navegador (incluyendo inspección local de JWT) para la pestaña web activa, de forma 100 % local.

---

## 3. Justificación Detallada de Permisos y `host_permissions` (CWS Privacy Practices)

### Permiso `cookies`
- **Justificación:** La funcionalidad central de la extensión depende de la API `chrome.cookies` (`getAll`, `getAllCookieStores`, `set`, `remove`, `onChanged`) para mostrar las cookies del dominio activo (incluyendo cookies particionadas CHIPS y aislamiento por `storeId` en modo incógnito), aplicar ediciones/importaciones solicitadas por el usuario, exportarlas a JSON o Netscape `cookies.txt`, actualizar el contador en el badge y eliminar automáticamente aquellas cookies marcadas como bloqueadas por el usuario.

### `host_permissions`: `http://*/*` y `https://*/*`
- **Justificación:** Siguiendo el principio de mínimo privilegio (en lugar de `<all_urls>` y prescindiendo del permiso redundante `activeTab`), la extensión solicita únicamente los esquemas web `http://*/*` y `https://*/*`. En Manifest V3, la API `chrome.cookies` exige permisos de host para los dominios cuyas cookies se leen o modifican, y estos mismos permisos permiten consultar la URL de la pestaña activa para mostrar las cookies del sitio y actualizar el contador del badge. La extensión **no accede a `file://`**, **no declara `content_scripts`**, **no inyecta código en páginas web** y **no realiza ninguna conexión HTTP/WebSocket saliente**. Además, excluye de forma explícita esquemas internos (`chrome://`, `edge://`, `about:`, `chrome-extension://`).

### Permiso `storage`
- **Justificación:** Necesario para almacenar localmente en `chrome.storage.local` las reglas de bloqueo de cookies (`storeId + dominio + nombre`) configuradas por el usuario. No se utiliza `storage.sync` ni servidores externos.

### Uso de código remoto (Remote Code)
- **No utiliza código remoto.** Todo el código JavaScript reside empaquetado dentro de `src/` sin `eval()`, sin scripts externos y sin dependencias de terceros.
