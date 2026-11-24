# Invitación · Angie Silupu · 22

Invitación web interactiva (HTML + CSS + JS puro, sin dependencias).

## Estructura
```
invitacion-angie-silupu-22/
├── index.html
├── styles.css
├── app.js                     ← AUDIO_CONFIG, EVENT_CONFIG, SHEETS_CONFIG arriba del archivo
├── assets/
│   ├── README-assets.txt      ← guía de canción y fotos
│   └── fotos/
└── google-apps-script/
    └── Code.gs                ← script para Google Sheets
```

## Probar en VS Code
1. Abre la carpeta en VS Code.
2. Instala la extensión **Live Server** → clic derecho en `index.html` → *Open with Live Server*.
   (Con Live Server el audio y el fade funcionan igual que en producción.)
3. Para probar en tu celular: misma red Wi-Fi → abre `http://IP-de-tu-PC:5500`.

## Conectar Google Sheets
Hoja ya creada: https://docs.google.com/spreadsheets/d/1q7fHTTMMDMy7xhvBpFIQijSL_StoA7X6wW9VRuUaNyc/edit
(pestañas **Confirmaciones** y **Resumen**).
1. En la hoja: Extensiones → Apps Script → pega `google-apps-script/Code.gs` → Guardar.
2. Implementar → Nueva implementación → Aplicación web · Ejecutar como: Yo · Acceso: Cualquier persona → Autorizar.
3. Copia la URL `/exec` en `app.js` → `SHEETS_CONFIG.endpoint`.
Sin URL, el formulario funciona en modo demo (no guarda nada).

## Invitación personalizada
Agrega `?para=Nombre` al enlace: `https://tu-dominio/?para=Valeria%20Castillo`
→ la portada saluda "Hola, Valeria" y el formulario ya trae su nombre.

## Publicar
Sube la carpeta a Vercel / Netlify / GitHub Pages (es un sitio estático).
