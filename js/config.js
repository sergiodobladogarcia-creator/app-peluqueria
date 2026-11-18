// ============================================================
//  CONFIGURACIÓN DE LA PELUQUERÍA
//  Todo lo que cambia de un negocio a otro está aquí.
//  Cambia los textos entre comillas y guarda el archivo.
// ============================================================

window.CONFIG = {
  // --- Marca ---
  nombre: "Barber Studio",          // Nombre que sale arriba
  lema: "Cortes que se notan.",     // Frase de portada
  ciudad: "Tu ciudad",
  instagram: "barberstudio",        // Usuario de Instagram, sin @
  whatsapp: "600 000 000",          // Teléfono que se muestra
  direccion: "Calle Mayor 12",
  valoracion: 4.9,
  numResenas: 312,

  // Portada: pon aquí la ruta de una foto o un vídeo de la carpeta img/
  // Ejemplos: "img/portada.jpg"  o  "img/portada.mp4". Vacío = portada de color.
  portada: "",

  // --- Horario (0 = domingo, 1 = lunes ... 6 = sábado). null = cerrado ---
  horario: {
    0: null,
    1: [["10:00", "14:00"], ["16:00", "21:00"]],
    2: [["10:00", "14:00"], ["16:00", "21:00"]],
    3: [["10:00", "14:00"], ["16:00", "21:00"]],
    4: [["10:00", "14:00"], ["16:00", "21:00"]],
    5: [["10:00", "21:00"]],
    6: [["09:00", "14:00"]],
  },
  intervaloMin: 30, // cada cuántos minutos empieza un hueco

  // --- Equipo ---
  equipo: [
    { id: "alex", nombre: "Álex", rol: "Fundador · Fades", color: "#d6a74e" },
    { id: "dani", nombre: "Dani", rol: "Barba y navaja", color: "#9fb7a2" },
  ],

  // --- Servicios (precio en euros, duración en minutos) ---
  servicios: [
    { id: "clasico", cat: "Corte", nombre: "Corte clásico", min: 30, precio: 15, desc: "Tijera y máquina, lavado y peinado." },
    { id: "fade", cat: "Corte", nombre: "Skin fade", min: 40, precio: 16, desc: "Degradado a piel con acabado a navaja." },
    { id: "nino", cat: "Corte", nombre: "Corte niño", min: 25, precio: 12, desc: "Hasta 12 años." },
    { id: "barba", cat: "Barba", nombre: "Arreglo de barba", min: 20, precio: 10, desc: "Perfilado, degradado y aceite." },
    { id: "navaja", cat: "Barba", nombre: "Afeitado a navaja", min: 30, precio: 14, desc: "Toalla caliente y navaja clásica." },
    { id: "combo", cat: "Combos", nombre: "Skin fade + barba", min: 60, precio: 22, desc: "El combo más pedido.", top: true },
    { id: "vip", cat: "Combos", nombre: "Experiencia completa", min: 75, precio: 30, desc: "Corte, barba, lavado y mascarilla." },
    { id: "color", cat: "Color", nombre: "Mechas / decoloración", min: 90, precio: 45, desc: "Precio orientativo según largo." },
  ],

  // --- Trabajos (galería). tipo: "foto" o "video". estilo: debe estar en "estilos". ---
  // src: ruta del archivo en img/ (ej. "img/fade1.jpg" o "img/reel1.mp4"). Vacío = imagen de ejemplo.
  estilos: ["Fade", "Clásico", "Barba", "Color"],
  trabajos: [
    { titulo: "Skin fade", estilo: "Fade", tipo: "video", src: "", servicio: "fade" },
    { titulo: "Corte clásico", estilo: "Clásico", tipo: "foto", src: "", servicio: "clasico" },
    { titulo: "Barba perfilada", estilo: "Barba", tipo: "foto", src: "", servicio: "barba" },
    { titulo: "Platino", estilo: "Color", tipo: "video", src: "", servicio: "color" },
    { titulo: "Mid fade", estilo: "Fade", tipo: "foto", src: "", servicio: "fade" },
    { titulo: "Pompadour", estilo: "Clásico", tipo: "foto", src: "", servicio: "clasico" },
    { titulo: "Barba degradada", estilo: "Barba", tipo: "video", src: "", servicio: "combo" },
    { titulo: "Mechas", estilo: "Color", tipo: "foto", src: "", servicio: "color" },
    { titulo: "Crop texturizado", estilo: "Fade", tipo: "foto", src: "", servicio: "fade" },
    { titulo: "Side part", estilo: "Clásico", tipo: "video", src: "", servicio: "clasico" },
    { titulo: "Afeitado a navaja", estilo: "Barba", tipo: "foto", src: "", servicio: "navaja" },
    { titulo: "Burst fade", estilo: "Fade", tipo: "foto", src: "", servicio: "fade" },
  ],

  // --- Reseñas (ejemplos: cámbialas por reseñas reales de Google) ---
  resenas: [
    { nombre: "Marcos R.", texto: "El mejor fade que me han hecho. Reservar desde el móvil es comodísimo.", estrellas: 5 },
    { nombre: "Iván G.", texto: "Puntuales, buen ambiente y te explican qué corte te queda mejor.", estrellas: 5 },
    { nombre: "Javi M.", texto: "Llevo un año viniendo y siempre sales como en las fotos de Instagram.", estrellas: 5 },
  ],

  // --- Fidelidad ---
  sellosParaPremio: 5,
  premio: "El 6º corte con un 50 % de descuento",
};
