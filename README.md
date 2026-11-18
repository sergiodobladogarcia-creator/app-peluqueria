# App de peluquería

Web app para móvil con reservas reales, y panel del peluquero para gestionarlo todo.

- **App de clientes:** `index.html` → reservar (servicio, profesional, día, hora), carta de precios,
  trabajos (fotos y vídeos), mis citas (cambiar / cancelar) y tarjeta de fidelidad.
- **Panel del peluquero:** `panel.html` → agenda por profesional, nuevas citas, estados
  (hecha / no vino / cancelada), bloquear huecos y vacaciones, clientes, servicios y precios,
  equipo y horario, subir fotos y vídeos, datos del negocio.

## Base de datos
Supabase, proyecto `app-peluqueria` (id `nlqtgnzwpjotdnwwlxtm`, plan gratuito).
- Los clientes reservan sin cuenta a través de la función `reservar`, que comprueba horario,
  huecos libres y límites. No pueden leer las citas de otros.
- La **primera cuenta** que se crea en `panel.html` queda como dueño (tabla `admins`).
- Las fotos y vídeos se guardan en el almacenamiento `trabajos`.

## Cómo le llegan las reservas
1. Al momento en la agenda del panel, con sonido y aviso del navegador si el panel está abierto.
2. El cliente, al reservar, tiene un botón para avisar por WhatsApp a la peluquería.
3. Desde el panel, el peluquero confirma, recuerda o pide reseña por WhatsApp con un toque
   (mensaje ya escrito).

Siguiente paso posible: avisos automáticos por WhatsApp o correo con n8n y la API de WhatsApp Business.

## Verla en el ordenador
Desde el Escritorio: `python -m http.server 5174 --directory app-peluqueria` y abre http://localhost:5174
