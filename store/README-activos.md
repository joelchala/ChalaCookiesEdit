# Especificación de Activos Gráficos para Tiendas — ChalaCookiesEdit

Paleta oficial **Clásico Claro (Naranja y Negro — Suite Chala)**:
- Fondo principal: `#FAF7F2`
- Superficies / Tarjetas: `#FFFFFF`
- Bordes: `#E4DDD3`
- Texto principal: `#111111` / Secundario: `#57534E`
- Acento primario (Naranja): `#EA580C`
- Acento secundario (Negro): `#18181B`
- Alertas / Bloqueado: `#DC2626`

---

## Medidas Requeridas y Archivos Generados

| Archivo / Tipo | Dimensiones (px) | Formato | Tienda | Estado |
| :--- | :--- | :--- | :--- | :--- |
| `store/logo-300x300.png` | `300x300` | PNG | Microsoft Edge Add-ons (Logotipo de extensión) | Generado (`npm run icons`) |
| `store/promo-440x280.png` | `440x280` | PNG | Microsoft Edge Add-ons & Chrome Web Store (Pequeña ficha promocional) | Generado |
| `store/promo-1400x560.png` | `1400x560` | PNG | Microsoft Edge Add-ons & Chrome Web Store (Gran baldosa promocional) | Generado |
| `store/screenshot-1-1280x800.png` | `1280x800` | PNG | Chrome Web Store & Edge Add-ons (Captura 1: Vista principal + Inspector JWT + CHIPS) | Generado |
| `store/screenshot-2-1280x800.png` | `1280x800` | PNG | Chrome Web Store & Edge Add-ons (Captura 2: Editor MV3 + Importar/Exportar seguro) | Generado |
| `store/screenshot-3-1280x800.png` | `1280x800` | PNG | Chrome Web Store & Edge Add-ons (Captura 3: Bloqueo automático en tiempo real) | Generado |
| `store/screenshot-4-1280x800.png` | `1280x800` | PNG | Chrome Web Store & Edge Add-ons (Captura 4: Exportación JSON y Netscape cookies.txt) | Generado |
| `store/screenshot-5-1280x800.png` | `1280x800` | PNG | Chrome Web Store & Edge Add-ons (Captura 5: Cookies Particionadas CHIPS y editor JWT en vivo) | Generado |
| `store/screenshot-6-1280x800.png` | `1280x800` | PNG | Chrome Web Store & Edge Add-ons (Captura 6: Avisos limpios en URLs internas y borrado seguro) | Generado |

---

## Guión recomendado para capturas (`1280x800`)
1. **Vista principal del popup:** Listado de cookies con insignias `HttpOnly`, `Secure`, `Sesión` y contador en el badge.
2. **Inspector JWT local:** Cookie expandida mostrando Header, Payload formateado y etiqueta de vigencia (`exp`).
3. **Editor de cookies y regla `SameSite=None`:** Modal de edición mostrando el ajuste automático de `Secure=true`.
4. **Importar / Exportar y Bloqueo:** Vista de exportación JSON / Netscape `cookies.txt` y filtro de cookies bloqueadas.
