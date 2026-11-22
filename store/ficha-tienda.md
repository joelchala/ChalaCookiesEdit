# Ficha de Tienda — Microsoft Edge Add-ons (Bilingüe ES / EN)

---

## Español (ES)

### Nombre
**ChalaCookiesEdit — Editor y Gestor de Cookies**

### Descripción corta (115 caracteres <= 132)
Edita, inspecciona JWT, bloquea, importa y exporta cookies (JSON y Netscape) 100% local y sin rastreo. Suite Chala.

### Descripción detallada
**ChalaCookiesEdit** es una herramienta profesional para desarrolladores, analistas de QA y usuarios avanzados dentro de la **Suite Chala** (*Chalablock, ChalaVPN, ChalaTabs, ChalaDev, ChalaCookiesEdit*).

Permite gestionar las cookies de la pestaña activa con precisión, interfaz oscura **"Escudo Cibernético"** y privacidad absoluta:

- **CRUD completo:** Crea, edita, duplica y elimina cookies individuales o limpia todo el dominio en un clic.
- **Cumplimiento estricto MV3:** Fuerza automáticamente `Secure = true` al elegir `SameSite = None` y distingue entre cookies *host-only* y cookies compartidas con subdominios (`.dominio.com`).
- **Inspector JWT integrado 100 % local:** Decodifica tokens `header.payload.signature` sin salir de tu navegador y muestra el payload formateado junto con el estado de expiración (`exp`).
- **Bloqueo automático en tiempo real:** Marca cookies no deseados como bloqueados (`dominio + nombre`); el Service Worker los elimina instantáneamente si el sitio intenta regenerarlos.
- **Importación y Exportación profesional:** Exporta e importa en **JSON** y **Netscape `cookies.txt`** (compatible con `curl`, `wget` y `yt-dlp`, con soporte `#HttpOnly_`).
- **Contador en el badge y manejo seguro de URLs internas:** Muestra el número de cookies de la pestaña activa y presenta un aviso limpio en páginas `edge://`, `chrome://` o `about:`.

**Cero telemetría. Cero dependencias externas. Código abierto bajo licencia MIT.**

### Categoría recomendada
Herramientas para desarrolladores (Developer Tools)

---

## English (EN)

### Name
**ChalaCookiesEdit — Cookie Editor & Manager**

### Short description (124 chars <= 132)
Edit, inspect JWTs, block, import and export cookies (JSON & Netscape) 100% locally with zero tracking. Part of Suite Chala.

### Detailed Description
**ChalaCookiesEdit** is a local-first cookie management and JWT inspection utility from **Suite Chala** (*Chalablock, ChalaVPN, ChalaTabs, ChalaDev, ChalaCookiesEdit*).

Built with the **"Escudo Cibernético"** dark slate interface and zero external dependencies:

- **Complete Cookie CRUD:** Create, edit, duplicate, delete individual cookies, or clear all cookies for the current domain.
- **Strict Chromium/Edge Safety Rules:** Automatically sets `Secure = true` when `SameSite = None` is chosen and distinguishes host-only cookies from subdomain cookies (`.domain.com`).
- **Built-in 100% Local JWT Inspector:** Automatically detects `header.payload.signature` values, decodes Header & Payload in local memory, and highlights expiration status (`exp`).
- **Persistent Real-Time Blocking:** Block specific cookies by `domain + name`; the MV3 Service Worker automatically intercepts `chrome.cookies.onChanged` and removes them if recreated.
- **Bidirectional Import & Export:** Copy or download cookies in **JSON** or **Netscape `cookies.txt`** format (ready for `curl` and `yt-dlp`, including `#HttpOnly_`).
- **Live Tab Badge & Safe Restricted-URL Handling:** Displays active cookie counts and shows a clean notice on `edge://`, `chrome://`, and `about:` pages.

---

## Justificación de Permisos / Permissions Justification (Edge Review Notes)

- **`cookies`:** Requerido para listar, crear, editar, exportar, importar y eliminar cookies del dominio de la pestaña activa, y para escuchar `chrome.cookies.onChanged` y eliminar cookies bloqueadas por el usuario.
- **`activeTab`:** Requerido para leer la URL de la pestaña activa cuando el usuario abre la extensión o actualiza el badge, y para recargar la pestaña tras modificar cookies.
- **`storage`:** Requerido para persistir localmente en `chrome.storage.local` la lista de cookies bloqueadas (`dominio + nombre`).
- **`<all_urls>` (`host_permissions`):** Requerido por Chromium/Edge para que la API `chrome.cookies` pueda inspeccionar y modificar cookies en cualquier sitio `http://` o `https://` que el usuario esté visitando. La extensión no inyecta scripts de contenido ni realiza peticiones de red externas.
