# Guía de carga descomprimida y actualización manual — ChalaCookiesEdit

## 1. Compilar la versión local

Desde la raíz del proyecto (`ChalaCookiesEdit/`), con **Node.js >= 22** instalado:

```bash
npm run icons
npm test
npm run build
```

Este proceso copia los archivos distribuibles de `src/` en `dist/build/ChalaCookiesEdit.chromium/` y genera los paquetes listos para tienda en `store/paquetes/`.

---

## 2. Cargar extensión descomprimida en Google Chrome / Chromium

1. Abre `chrome://extensions/` en la barra de direcciones.
2. Activa el interruptor **Modo de desarrollador** (*Developer mode*) en la esquina superior derecha.
3. Haz clic en **Cargar descomprimida** (*Load unpacked*).
4. Selecciona la carpeta:
   `dist/build/ChalaCookiesEdit.chromium`
5. Fija **ChalaCookiesEdit** en la barra de herramientas para ver el contador de cookies en tiempo real.

---

## 3. Cargar extensión descomprimida en Microsoft Edge

1. Abre `edge://extensions/`.
2. Activa **Modo de desarrollador** (*Developer mode*) en el panel lateral izquierdo o superior.
3. Haz clic en **Cargar descomprimida** (*Load unpacked*).
4. Selecciona la carpeta `dist/build/ChalaCookiesEdit.chromium`.

---

## 4. Actualización manual tras cambios

1. Ejecuta nuevamente `npm run build` (y `npm test` para validar integridad).
2. Ve a `chrome://extensions/` o `edge://extensions/`.
3. Pulsa el botón de **Recargar (↻)** en la tarjeta de **ChalaCookiesEdit**.
