// Conexión con la base de datos (Supabase). La clave publicable es pública por diseño:
// los permisos los controla la base de datos (RLS y funciones).
window.SB = window.supabase.createClient(
  "https://nlqtgnzwpjotdnwwlxtm.supabase.co",
  "sb_publishable_ugEyEFm9p_nINBO9NnvLnQ_JKf9SOZQ"
);

// Utilidades compartidas por la app y el panel
window.UT = {
  pad: (n) => String(n).padStart(2, "0"),
  toMin(t) { const [h, m] = String(t).split(":").map(Number); return h * 60 + m; },
  fromMin(m) { return `${UT.pad(Math.floor(m / 60))}:${UT.pad(m % 60)}`; },
  dKey(d) { return `${d.getFullYear()}-${UT.pad(d.getMonth() + 1)}-${UT.pad(d.getDate())}`; },
  fromKey(k) { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); },
  addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; },
  cap: (t) => t.charAt(0).toUpperCase() + t.slice(1),
  fmtLong(k) { return UT.cap(UT.fromKey(k).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })); },
  fmtShort(k) { return UT.fromKey(k).toLocaleDateString("es-ES", { day: "numeric", month: "short" }); },
  esc: (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
  // Número para WhatsApp: si son 9 cifras españolas, añade el 34
  waNum(t) { const d = String(t || "").replace(/\D/g, ""); return d.length === 9 ? "34" + d : d; },
  waLink(t, msg) { return `https://wa.me/${UT.waNum(t)}?text=${encodeURIComponent(msg)}`; },
  euros: (n) => `${Number(n).toLocaleString("es-ES", { maximumFractionDigits: 2 })} €`,
  // Convierte las filas de la base de datos al formato que usa la app
  async cargarNegocio() {
    const [a, e, s, h, t] = await Promise.all([
      SB.from("ajustes").select("*").eq("id", 1).single(),
      SB.from("equipo").select("*").order("orden"),
      SB.from("servicios").select("*").order("orden"),
      SB.from("horario").select("*"),
      SB.from("trabajos").select("*").order("orden").order("creado", { ascending: false }),
    ]);
    const err = a.error || e.error || s.error || h.error || t.error;
    if (err) throw err;
    const horario = {};
    for (let d = 0; d < 7; d++) horario[d] = null;
    h.data.forEach((r) => { horario[r.dia] = r.tramos && r.tramos.length ? r.tramos : null; });
    return { ajustes: a.data, equipo: e.data, servicios: s.data.map((x) => ({ ...x, precio: Number(x.precio) })), horario, trabajos: t.data };
  },
};
