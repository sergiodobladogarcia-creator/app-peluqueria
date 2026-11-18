# App de peluquería (demo)

Web app para móvil: reservas, servicios, trabajos (fotos y Reels) y panel del peluquero.
Sin instalación: HTML, CSS y JS. Las reservas de la demo se guardan en el propio móvil.

## Personalizarla para un peluquero
Todo se cambia en `js/config.js`:
- `nombre`, `lema`, `ciudad`, `instagram`, `whatsapp`, `direccion`, valoración.
- `horario`, `equipo` y `servicios` (precio y duración).
- `trabajos`: copia sus fotos o vídeos a `img/` y pon la ruta en `src`,
  por ejemplo `src: "img/fade1.jpg"` o `src: "img/reel1.mp4"` (con `tipo: "video"`).
- `portada`: una foto o vídeo para la cabecera (`"img/portada.mp4"`).
- Cambia también `name` en `manifest.webmanifest` y el `<title>` de `index.html`.

## Verla en el ordenador
Desde la carpeta del Escritorio: `python -m http.server 5174 --directory app-peluqueria`
y abre http://localhost:5174

## Panel del peluquero
Mis citas → «¿Eres el peluquero? Abre el panel». Agenda por día y profesional,
bloquear huecos y reiniciar los datos de ejemplo.
