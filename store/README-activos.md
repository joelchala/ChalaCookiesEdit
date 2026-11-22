# Especificación de Activos Gráficos para Tiendas — ChalaCookiesEdit

Paleta oficial **"Escudo Cibernético" (Suite Chala)**:
- Fondo principal: `#0F172A`
- Superficies / Tarjetas: `#1E293B`
- Bordes: `#334155`
- Texto principal: `#F1F5F9` / Secundario: `#94A3B8`
- Acento primario (Esmeralda): `#10B981`
- Acento secundario (Cian): `#06B6D4`
- Alertas / Bloqueado: `#EF4444`

---

## Medidas Requeridas

| Archivo / Tipo | Dimensiones (px) | Formato | Tienda | Estado |
| :--- | :--- | :--- | :--- | :--- |
| `store/logo-300x300.png` | `300x300` | PNG (RGBA, sin pérdida) | Microsoft Edge Add-ons (Logo de tienda) | Generado automáticamente con `npm run icons` |
| Capturas de pantalla | `1280x800` | PNG o JPEG (24-bit sin alfa) | Chrome Web Store & Edge Add-ons (mínimo 2, recomendado 4) | Preparar capturas limpias del popup sobre un sitio web de prueba |
| Mosaico promocional pequeño | `440x280` | PNG o JPEG (sin alfa) | Chrome Web Store | Banner compacto Escudo Cibernético + logotipo |
| Mosaico promocional grande / Marquesina | `1400x560` | PNG o JPEG (sin alfa) | Chrome Web Store | Banner hero con resumen visual de CRUD + Inspector JWT + Netscape |

---

## Guión recomendado para capturas (`1280x800`)
1. **Vista principal del popup:** Listado de cookies con insignias `HttpOnly`, `Secure`, `Sesión` y contador en el badge.
2. **Inspector JWT local:** Cookie expandida mostrando Header, Payload formateado y etiqueta de vigencia (`exp`).
3. **Editor de cookies y regla `SameSite=None`:** Modal de edición mostrando el ajuste automático de `Secure=true`.
4. **Importar / Exportar y Bloqueo:** Vista de exportación JSON / Netscape `cookies.txt` y filtro de cookies bloqueadas.
