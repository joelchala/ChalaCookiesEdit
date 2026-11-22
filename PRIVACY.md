# Política de Privacidad / Privacy Policy — ChalaCookiesEdit

**Última actualización / Last updated:** 2026-11-21  
**Responsable / Maintainer:** Joel Rafael Chala García / Coposys ([chaladev.site](https://chaladev.site) · [coposys.com.do](https://coposys.com.do))

---

## Español (ES)

### 1. Principio de privacidad local (Cero telemetría)
**ChalaCookiesEdit** funciona **100 % en el navegador del usuario**. La extensión:
- **NO** recopila, transmite, vende ni comparte cookies, tokens JWT, historial de navegación ni datos personales con servidores propios o de terceros.
- **NO** utiliza analíticas, rastreadores, SDKs publicitarios ni llamadas de red en segundo plano.
- Toda decodificación de tokens JWT, exportación (JSON / Netscape `cookies.txt`) e importación ocurre exclusivamente en memoria local.

### 2. Almacenamiento local
La extensión utiliza únicamente `chrome.storage.local` para guardar:
- La lista de reglas de cookies bloqueadas (`dominio + nombre`) definidas manualmente por el usuario.
- Preferencias locales de interfaz si se configuran.

Estos datos permanecen en tu dispositivo y se eliminan por completo al desinstalar la extensión o desbloquear las cookies.

### 3. Tabla detallada de permisos

| Permiso / Host | Uso técnico exacto | Alcance y privacidad |
| :--- | :--- | :--- |
| `cookies` | Leer, crear, editar, duplicar, exportar, importar y eliminar cookies mediante `chrome.cookies`, además de escuchar `chrome.cookies.onChanged` para borrar cookies marcadas como bloqueadas. | Solo se ejecuta sobre el dominio solicitado por el usuario o sobre cookies explícitamente bloqueadas en `chrome.storage.local`. |
| `activeTab` | Consultar la URL de la pestaña activa al abrir el popup o al actualizar el contador del badge, y permitir recargar la pestaña tras modificar cookies. | Nunca rastrea ni envía URLs visitadas fuera del dispositivo. |
| `storage` | Persistir localmente las reglas de bloqueo de cookies (`dominio + nombre`) en `chrome.storage.local`. | Almacenamiento estrictamente local sin sincronización remota. |
| `<all_urls>` (`host_permissions`) | Necesario en Chromium/Edge MV3 para que `chrome.cookies` pueda leer, modificar y bloquear cookies de cualquier dominio web (`http://` / `https://`) que el usuario decida inspeccionar o gestionar. | La extensión no inyecta scripts en páginas web (`content_scripts` no declarados) ni realiza peticiones HTTP salientes. |

---

## English (EN)

### 1. Local-First Privacy Commitment (Zero Telemetry)
**ChalaCookiesEdit** operates **100% locally inside your browser**. The extension:
- **DOES NOT** collect, transmit, sell, or share cookies, JWT payloads, browsing history, or personal data with any first-party or third-party servers.
- **DOES NOT** include analytics, tracking pixels, advertising SDKs, or background network calls.
- All JWT inspection, JSON/Netscape `cookies.txt` export, and cookie import operations run strictly in local memory.

### 2. Local Storage
The extension uses `chrome.storage.local` solely to store:
- User-defined cookie blocking rules (`domain + name`).
- Local UI preferences when applicable.

This data never leaves your device and is permanently removed when you unblock rules or uninstall the extension.

### 3. Detailed Permissions Table

| Permission / Host | Exact Technical Purpose | Privacy Scope |
| :--- | :--- | :--- |
| `cookies` | Read, create, edit, duplicate, export, import, and remove cookies via `chrome.cookies`, and listen to `chrome.cookies.onChanged` to auto-delete user-blocked cookies. | Operates strictly on the active domain inspected by the user or on explicit user-configured blocking rules. |
| `activeTab` | Identify the active tab URL when opening the popup or refreshing the badge counter, and reload the current tab on user request. | URLs are never logged or transmitted outside the browser. |
| `storage` | Persist user-configured cookie blocklists (`domain + name`) in `chrome.storage.local`. | Strictly local device storage. |
| `<all_urls>` (`host_permissions`) | Required by Chromium/Edge Manifest V3 so `chrome.cookies` can access, edit, and enforce block rules across any `http://` or `https://` site the user chooses to inspect. | No `content_scripts` are injected into web pages and no outbound network requests are made. |
