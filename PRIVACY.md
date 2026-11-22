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
| `cookies` | Leer, crear, editar, duplicar, exportar, importar y eliminar cookies (incluyendo cookies particionadas CHIPS y aislamiento por `storeId` en modo incógnito) mediante `chrome.cookies`, además de escuchar `chrome.cookies.onChanged` para borrar cookies marcadas como bloqueadas. | Solo se ejecuta sobre el dominio solicitado por el usuario o sobre cookies explícitamente bloqueadas en `chrome.storage.local`. |
| `storage` | Persistir localmente las reglas de bloqueo de cookies (`storeId + dominio + nombre`) en `chrome.storage.local`. | Almacenamiento estrictamente local sin sincronización remota. |
| `http://*/*`, `https://*/*` (`host_permissions`) | Principio de mínimo privilegio (en lugar de `<all_urls>` y sin requerir `activeTab`): necesario en Chromium/Edge MV3 para que `chrome.cookies` pueda leer, modificar y bloquear cookies de cualquier sitio web `http://` o `https://` que el usuario decida inspeccionar, y para conocer la URL de la pestaña activa al actualizar el badge. | Excluye esquemas no web (`file://`, `ftp://`, `chrome://`, `edge://`, `about:`). La extensión no declara `content_scripts` ni realiza peticiones HTTP salientes. |

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
| `cookies` | Read, create, edit, duplicate, export, import, and remove cookies (including CHIPS partitioned cookies and incognito `storeId` isolation) via `chrome.cookies`, and listen to `chrome.cookies.onChanged` to auto-delete user-blocked cookies. | Operates strictly on the active domain inspected by the user or on explicit user-configured blocking rules. |
| `storage` | Persist user-configured cookie blocklists (`storeId + domain + name`) in `chrome.storage.local`. | Strictly local device storage. |
| `http://*/*`, `https://*/*` (`host_permissions`) | Least-privilege scope (replacing `<all_urls>` and removing the redundant `activeTab` permission): required by Chromium/Edge Manifest V3 so `chrome.cookies` can access, edit, and enforce block rules across any `http://` or `https://` site the user chooses to inspect, and to read the active tab URL for the badge counter. | Excludes non-web schemes (`file://`, `ftp://`, `chrome://`, `edge://`, `about:`). No `content_scripts` are injected and no outbound network requests are made. |
