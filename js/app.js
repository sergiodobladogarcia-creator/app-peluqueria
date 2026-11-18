/* App de la peluquería (demo). Los datos viven en el móvil (localStorage). */
(() => {
  const C = window.CONFIG;
  const KEY = "pelu-demo-v1";
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- Iconos ----------
  const I = {
    inicio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
    servicios: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12"/></svg>',
    reservar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    trabajos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M15 14.5v6l5-3z"/></svg>',
    citas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    play: '<svg viewBox="0 0 10 10"><path d="M2 1l7 4-7 4z" fill="#fff"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
  };
  const TABS = [["inicio", "Inicio"], ["servicios", "Servicios"], ["reservar", "Reservar"], ["trabajos", "Trabajos"], ["citas", "Mis citas"]];

  // ---------- Fechas ----------
  const pad = (n) => String(n).padStart(2, "0");
  const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const fromMin = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const dKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const DOW_L = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const fmtLong = (k) => cap(fromKey(k).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }));
  const fmtShort = (k) => fromKey(k).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };
  const todayKey = () => dKey(new Date());

  // ---------- Datos ----------
  const svcById = (id) => C.servicios.find((s) => s.id === id);
  const proById = (id) => C.equipo.find((p) => p.id === id);

  let db;
  let skipId = null; // cita que se está cambiando: su hueco cuenta como libre
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }
  function load() {
    try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
    if (!db || !db.bookings) { db = seed(); save(); }
  }

  // Datos de ejemplo para que la agenda no parezca vacía
  function seed() {
    let s = 7;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const NAMES = ["Carlos P.", "Hugo M.", "Pablo S.", "Adrián L.", "Mario T.", "Lucas F.", "Diego R.", "Sergio V.", "Raúl C.", "Óscar N.", "Rubén A.", "Iker B."];
    const data = { bookings: [], blocked: [], user: { nombre: "", tel: "" }, history: [] };
    const base = new Date(); base.setHours(0, 0, 0, 0);
    for (let i = 0; i < 14; i++) {
      const day = addDays(base, i), key = dKey(day), ranges = C.horario[day.getDay()];
      if (!ranges) continue;
      C.equipo.forEach((p) => {
        ranges.forEach(([a, b]) => {
          for (let t = toMin(a); t < toMin(b); t += C.intervaloMin) {
            if (rnd() > 0.42) continue;
            const svc = C.servicios[Math.floor(rnd() * 6)];
            if (t + svc.min > toMin(b) || !isFree(data, key, t, svc.min, p.id)) continue;
            data.bookings.push({ id: "s" + data.bookings.length, date: key, time: fromMin(t), min: svc.min, svc: svc.id, pro: p.id, cliente: NAMES[Math.floor(rnd() * NAMES.length)], mine: false });
          }
        });
      });
    }
    // Historial del cliente (cortes ya hechos)
    [["fade", 37, "alex"], ["clasico", 65, "dani"], ["combo", 95, "alex"]].forEach(([svc, ago, pro]) => {
      data.history.push({ svc, pro, date: dKey(addDays(base, -ago)) });
    });
    return data;
  }

  function isFree(data, date, start, min, pro) {
    const end = start + min;
    for (const b of data.bookings) {
      if (b.date !== date || b.pro !== pro || b.id === skipId) continue;
      const bs = toMin(b.time), be = bs + b.min;
      if (start < be && bs < end) return false;
    }
    for (const b of data.blocked) {
      if (b.date !== date || b.pro !== pro) continue;
      const bs = toMin(b.time), be = bs + C.intervaloMin;
      if (start < be && bs < end) return false;
    }
    return true;
  }

  // Huecos de un día: [{t, pro}] (pro = profesional libre asignado)
  function slotsFor(date, svcId, pro) {
    const d = fromKey(date), ranges = C.horario[d.getDay()], svc = svcById(svcId);
    if (!ranges) return [];
    const isToday = date === todayKey(), cut = nowMin() + 15, out = [];
    ranges.forEach(([a, b]) => {
      for (let t = toMin(a); t + svc.min <= toMin(b); t += C.intervaloMin) {
        if (isToday && t < cut) continue;
        const cands = pro === "any" ? C.equipo.map((p) => p.id) : [pro];
        const free = cands.find((p) => isFree(db, date, t, svc.min, p));
        out.push({ t, pro: free || null });
      }
    });
    return out;
  }

  function nextFree(svcId = C.servicios[0].id) {
    const base = new Date(); base.setHours(0, 0, 0, 0);
    for (let i = 0; i < 14; i++) {
      const k = dKey(addDays(base, i));
      const s = slotsFor(k, svcId, "any").find((x) => x.pro);
      if (s) return { date: k, t: s.t, i };
    }
    return null;
  }

  function openNow() {
    const n = new Date(), r = C.horario[n.getDay()], m = nowMin();
    if (!r) return null;
    const cur = r.find(([a, b]) => m >= toMin(a) && m < toMin(b));
    return cur ? cur[1] : null;
  }

  // ---------- Imagen de ejemplo (si no hay foto real) ----------
  let artN = 0;
  const HUES = [32, 200, 14, 45, 265, 150, 0, 220];
  function art(item, idx) {
    const id = "g" + artN++, h = HUES[idx % HUES.length];
    const hairCol = item.estilo === "Color" ? "#efe6cf" : "#16130f";
    let hair = "";
    if (item.estilo === "Fade") hair = `<path d="M27 52c0-17 10-28 23-28s23 11 23 28c-3-6-8-10-23-10s-20 4-23 10z" fill="${hairCol}"/><path d="M28 55c3-5 9-8 22-8s19 3 22 8" stroke="${hairCol}" stroke-width="2" opacity=".5" fill="none"/>`;
    else if (item.estilo === "Clásico") hair = `<path d="M26 58c-2-22 10-36 26-36 14 0 24 10 22 30-5-10-13-15-30-14-8 1-14 9-18 20z" fill="${hairCol}"/><path d="M44 24c-4 6-6 12-6 18" stroke="#2c261d" stroke-width="1.6" fill="none"/>`;
    else if (item.estilo === "Barba") hair = `<path d="M28 50c0-16 9-26 22-26s22 10 22 26c-4-5-10-8-22-8s-18 3-22 8z" fill="${hairCol}"/><path d="M29 66c2 18 10 28 21 28s19-10 21-28c-4 6-10 8-21 8s-17-2-21-8z" fill="${hairCol}"/>`;
    else hair = `<path d="M26 56c-1-20 9-33 24-33s25 13 24 33c-5-8-12-13-24-13s-19 5-24 13z" fill="${hairCol}"/>`;
    return `<svg class="art" viewBox="0 0 100 125" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><radialGradient id="${id}" cx="50%" cy="35%" r="75%"><stop offset="0" stop-color="hsl(${h} 32% 40%)"/><stop offset="1" stop-color="hsl(${h} 30% 10%)"/></radialGradient></defs>
      <rect width="100" height="125" fill="url(#${id})"/>
      <path d="M8 125c4-20 20-28 42-28s38 8 42 28z" fill="#0d0d10"/>
      <rect x="42" y="78" width="16" height="20" fill="#3a2e24"/>
      <ellipse cx="50" cy="58" rx="22" ry="27" fill="#5a4636"/>
      ${hair}
    </svg>`;
  }

  function mediaInner(item, idx, opts = {}) {
    if (item.src && item.tipo === "video") {
      return `<video src="${esc(item.src)}" muted loop playsinline ${opts.controls ? "controls autoplay" : 'autoplay preload="metadata"'}></video>`;
    }
    if (item.src) return `<img src="${esc(item.src)}" alt="${esc(item.titulo)}" loading="lazy">`;
    return art(item, idx);
  }
  const mediaTile = (item, idx, cls = "") =>
    `<button class="media ${cls}" data-work="${idx}" aria-label="${esc(item.titulo)}">${mediaInner(item, idx)}${item.tipo === "video" ? `<span class="play">${I.play}</span>` : ""}<span class="cap">${esc(item.titulo)}</span></button>`;

  // ---------- Navegación ----------
  let view = "inicio";
  function go(v, opts = {}) {
    view = v;
    if (v !== "reservar") { skipId = null; bk.editing = null; }
    document.querySelectorAll(".view").forEach((el) => el.classList.toggle("on", el.dataset.v === v));
    document.querySelectorAll(".tabbar button").forEach((b) => b.classList.toggle("on", b.dataset.go === v));
    closeSheet();
    RENDER[v] && RENDER[v](opts);
    const cur = document.querySelector(`.view[data-v="${v}"]`);
    if (cur && !opts.keepScroll) cur.scrollTop = 0;
  }

  let toastT;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2400);
  }
  function openSheet(html) { $("#sheet").innerHTML = html; $("#sheet").hidden = false; $("#sheetBg").hidden = false; }
  function closeSheet() { $("#sheet").hidden = true; $("#sheetBg").hidden = true; $("#sheet").innerHTML = ""; }

  // ---------- Pantallas ----------
  const RENDER = {};

  RENDER.inicio = () => {
    const nf = nextFree();
    const open = openNow();
    const nfTxt = nf ? (nf.i === 0 ? `Hoy ${fromMin(nf.t)}` : nf.i === 1 ? `Mañana ${fromMin(nf.t)}` : `${DOW[fromKey(nf.date).getDay()]} ${fromMin(nf.t)}`) : "Sin huecos";
    const hero = C.portada
      ? (/\.(mp4|webm|mov)$/i.test(C.portada) ? `<video src="${esc(C.portada)}" autoplay muted loop playsinline></video>` : `<img class="cover" src="${esc(C.portada)}" alt="">`)
      : `<svg class="hero-art" viewBox="0 0 100 125" aria-hidden="true"><path d="M8 125c4-20 20-28 42-28s38 8 42 28z" fill="#0d0d10"/><rect x="42" y="78" width="16" height="20" fill="#2c231b"/><ellipse cx="50" cy="58" rx="22" ry="27" fill="#3d3027"/><path d="M27 52c0-17 10-28 23-28s23 11 23 28c-3-6-8-10-23-10s-20 4-23 10z" fill="#0f0d0b"/><path d="M28 55c3-5 9-8 22-8s19 3 22 8" stroke="#d6a74e" stroke-width=".8" fill="none" opacity=".7"/></svg>`;
    const reels = C.trabajos.map((w, i) => ({ w, i })).filter((o) => o.w.tipo === "video").concat(C.trabajos.map((w, i) => ({ w, i })).filter((o) => o.w.tipo !== "video").slice(0, 3));
    const top = C.servicios.filter((s) => s.top).concat(C.servicios.slice(0, 2)).slice(0, 3);
    const today = new Date().getDay();
    const order = [1, 2, 3, 4, 5, 6, 0];
    $("#vInicio").innerHTML = `
      <div class="hero">${hero}
        <span class="tag">${esc(C.ciudad)} · Barbería</span>
        <h1>${esc(C.lema)}</h1>
        <div class="sub"><span class="stars">★★★★★</span> ${String(C.valoracion).replace(".", ",")} · ${C.numResenas} reseñas</div>
      </div>
      <button class="btn" data-go="reservar">Reservar cita</button>
      <div class="row">
        <div class="stat"><b>${nfTxt}</b><span>Próximo hueco libre</span></div>
        <div class="stat"><b><span class="dot" style="background:${open ? "var(--ok)" : "var(--bad)"}"></span>${open ? "Abierto" : "Cerrado"}</b><span>${open ? "Hasta las " + open : "Mira el horario abajo"}</span></div>
      </div>
      <div class="sec"><h3>Últimos trabajos</h3><button class="link" data-go="trabajos">Ver todos</button></div>
      <div class="reels">${reels.map((o) => mediaTile(o.w, o.i, "reel")).join("")}</div>
      <div class="sec"><h3>Los más pedidos</h3><button class="link" data-go="servicios">Carta completa</button></div>
      <div class="stack">${top.map(svcRow).join("")}</div>
      <div class="sec"><h3>Lo que dicen</h3></div>
      <div class="reels">${C.resenas.map((r) => `<div class="review"><span class="stars">${"★".repeat(r.estrellas)}</span><p>${esc(r.texto)}</p><b>${esc(r.nombre)}</b></div>`).join("")}</div>
      <div class="info">
        <div class="sec"><h3>${esc(C.direccion)}</h3><span class="sub">${esc(C.ciudad)}</span></div>
        <div class="hours">${order.map((d) => { const r = C.horario[d]; return `<div class="${d === today ? "today" : ""}"><span>${DOW_L[d]}</span><span>${r ? r.map((x) => x.join("–")).join(" · ") : "Cerrado"}</span></div>`; }).join("")}</div>
        <div class="row">
          <a class="btn ghost small" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(C.direccion + ", " + C.ciudad)}" target="_blank" rel="noopener">Cómo llegar</a>
          <a class="btn ghost small" href="https://wa.me/34${C.whatsapp.replace(/\D/g, "")}" target="_blank" rel="noopener">WhatsApp</a>
        </div>
      </div>`;
  };

  function svcRow(s) {
    return `<button class="svc" data-svc="${s.id}"><div><b>${esc(s.nombre)}${s.top ? '<span class="badge">TOP</span>' : ""}</b><div class="meta">${s.min} min</div><div class="desc">${esc(s.desc || "")}</div></div><span class="price">${s.precio} €</span></button>`;
  }

  let svcCat = "Todos";
  RENDER.servicios = () => {
    const cats = ["Todos", ...new Set(C.servicios.map((s) => s.cat))];
    const list = C.servicios.filter((s) => svcCat === "Todos" || s.cat === svcCat);
    let last = "", body = "";
    list.forEach((s) => { if (s.cat !== last) { body += `<div class="label cat-title">${esc(s.cat)}</div>`; last = s.cat; } body += svcRow(s); });
    $("#vServicios").innerHTML = `
      <div><h2 class="h-page">Servicios</h2><p class="sub">Toca un servicio para reservarlo.</p></div>
      <div class="chips">${cats.map((c) => `<button class="chip ${c === svcCat ? "on" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}</div>
      <div class="stack">${body}</div>`;
  };

  // Estado de la reserva en curso
  const bk = { svc: null, pro: "any", date: null, t: null, assigned: null, done: null, editing: null, err: "" };
  function bookingDays() {
    const base = new Date(); base.setHours(0, 0, 0, 0);
    return Array.from({ length: 14 }, (_, i) => dKey(addDays(base, i)));
  }

  RENDER.reservar = () => {
    const el = $("#vReservar");
    if (bk.done) {
      const b = bk.done, s = svcById(b.svc);
      el.innerHTML = `
        <div class="done"><div class="check">${I.check}</div><h2 class="h-page">¡Cita reservada!</h2>
        <p class="sub">${esc(s.nombre)} con ${esc(proById(b.pro).nombre)}<br><b style="color:var(--ink)">${fmtLong(b.date)} · ${b.time}</b></p>
        <p class="sub">Te recordaremos la cita 24 horas antes.</p></div>
        <button class="btn" data-go="citas">Ver mis citas</button>
        <button class="btn ghost" id="bkAgain">Hacer otra reserva</button>`;
      return;
    }
    if (!bk.date) { const nf = nextFree(bk.svc || C.servicios[0].id); bk.date = nf ? nf.date : todayKey(); }
    const s = bk.svc && svcById(bk.svc);
    const slots = s ? slotsFor(bk.date, bk.svc, bk.pro) : [];
    const stepN = !s ? 0 : bk.t === null ? 2 : 4;
    el.innerHTML = `
      <div><h2 class="h-page">${bk.editing ? "Cambiar cita" : "Reservar"}</h2><p class="sub">Elige servicio, profesional, día y hora.</p></div>
      <div class="steps">${[1, 2, 3, 4].map((n) => `<i class="${n <= stepN ? "on" : ""}"></i>`).join("")}</div>

      <div class="label">1 · Servicio</div>
      <div class="chips">${C.servicios.map((x) => `<button class="chip ${x.id === bk.svc ? "on" : ""}" data-bk-svc="${x.id}">${esc(x.nombre)} · ${x.precio} €</button>`).join("")}</div>

      <div class="label">2 · Profesional</div>
      <div class="pros">${C.equipo.map((p) => `<button class="pro ${bk.pro === p.id ? "on" : ""}" data-bk-pro="${p.id}"><span class="av" style="background:${p.color}">${esc(p.nombre[0])}</span>${esc(p.nombre)}<small>${esc(p.rol)}</small></button>`).join("")}
        <button class="pro ${bk.pro === "any" ? "on" : ""}" data-bk-pro="any"><span class="av" style="background:var(--s3);color:var(--ink)">?</span>Sin preferencia<small>El primero libre</small></button></div>

      <div class="label">3 · Día</div>
      <div class="days">${bookingDays().map((k) => { const d = fromKey(k); const closed = !C.horario[d.getDay()]; return `<button class="day ${k === bk.date ? "on" : ""}" data-bk-day="${k}" ${closed ? "disabled" : ""}>${k === todayKey() ? "Hoy" : DOW[d.getDay()]}<b>${d.getDate()}</b></button>`; }).join("")}</div>

      <div class="label">4 · Hora</div>
      ${!s ? `<div class="empty">Elige primero un servicio para ver las horas libres.</div>`
        : !slots.length ? `<div class="empty">Ese día no quedan huecos. Prueba otro día.</div>`
        : !slots.some((x) => x.pro) ? `<div class="empty">Día completo. Prueba otro día u otro profesional.</div>`
        : `<div class="slots">${slots.map((x) => `<button class="slot ${bk.t === x.t ? "on" : ""}" data-bk-t="${x.t}" ${x.pro ? "" : "disabled"}>${fromMin(x.t)}</button>`).join("")}</div>`}

      ${s && bk.t !== null ? `
        <div class="summary">
          <div><span>Servicio</span><b>${esc(s.nombre)}</b></div>
          <div><span>Profesional</span><b>${esc(proById(bk.assigned).nombre)}</b></div>
          <div><span>Cuándo</span><b>${fmtShort(bk.date)} · ${fromMin(bk.t)}</b></div>
          <div><span>Duración</span><b>${s.min} min</b></div>
          <div><span>Total (se paga en el local)</span><b style="color:var(--gold)">${s.precio} €</b></div>
        </div>
        <div class="field"><label class="label" for="bkName">Tu nombre</label><input id="bkName" autocomplete="name" value="${esc(db.user.nombre)}" placeholder="Nombre y apellido"></div>
        <div class="field"><label class="label" for="bkTel">Teléfono</label><input id="bkTel" type="tel" inputmode="tel" autocomplete="tel" value="${esc(db.user.tel)}" placeholder="600 123 456"></div>
        ${bk.err ? `<div class="err">${esc(bk.err)}</div>` : ""}
        <button class="btn" id="bkConfirm">${bk.editing ? "Guardar cambio" : "Confirmar cita"}</button>` : ""}`;
  };

  let galFilter = "Todos";
  RENDER.trabajos = () => {
    const items = C.trabajos.map((w, i) => ({ w, i })).filter((o) => galFilter === "Todos" || o.w.estilo === galFilter);
    $("#vTrabajos").innerHTML = `
      <div><h2 class="h-page">Trabajos</h2><p class="sub">Clientes reales. Toca uno y pide el mismo corte.</p></div>
      <a class="ig-strip" href="https://instagram.com/${esc(C.instagram)}" target="_blank" rel="noopener">
        <span class="ig-logo">${I.ig}</span><span style="flex:1"><b>@${esc(C.instagram)}</b><br><span class="sub">Más vídeos en Instagram</span></span><span class="link">Seguir</span></a>
      <div class="chips">${["Todos", ...C.estilos].map((f) => `<button class="chip ${f === galFilter ? "on" : ""}" data-gal="${esc(f)}">${esc(f)}</button>`).join("")}</div>
      <div class="grid3">${items.map((o) => mediaTile(o.w, o.i)).join("")}</div>`;
  };

  RENDER.citas = () => {
    const now = todayKey(), nm = nowMin();
    const mine = db.bookings.filter((b) => b.mine && (b.date > now || (b.date === now && toMin(b.time) >= nm)))
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const stamps = db.history.length % (C.sellosParaPremio + 1);
    const n = C.sellosParaPremio;
    $("#vCitas").innerHTML = `
      <div><h2 class="h-page">Mis citas</h2><p class="sub">${db.user.nombre ? "Hola, " + esc(db.user.nombre.split(" ")[0]) : "Tus reservas y tu tarjeta de fidelidad."}</p></div>
      ${mine.length ? mine.map((b) => { const s = svcById(b.svc); return `
        <div class="appt"><span class="label" style="color:var(--gold)">Próxima cita</span>
          <div class="when">${fmtLong(b.date).split(",")[0]} ${fmtShort(b.date)} · ${b.time}</div>
          <div>${esc(s.nombre)} con ${esc(proById(b.pro).nombre)} · ${s.precio} €</div>
          <div class="row"><button class="btn ghost small" data-edit="${b.id}">Cambiar</button><button class="btn danger small" data-cancel="${b.id}">Cancelar</button></div>
        </div>`; }).join("")
        : `<div class="empty">No tienes citas pendientes.<br><br><button class="btn small" data-go="reservar" style="width:auto;display:inline-flex">Reservar ahora</button></div>`}
      <div class="loyal">
        <div class="sec"><h3>Tarjeta de fidelidad</h3><span class="sub">${stamps} de ${n}</span></div>
        <div class="stamps" style="grid-template-columns:repeat(${n + 1},1fr)">${Array.from({ length: n + 1 }, (_, i) => i < stamps ? `<div class="stamp f">${I.check}</div>` : i === n ? `<div class="stamp">%</div>` : `<div class="stamp">${i + 1}</div>`).join("")}</div>
        <span class="sub">${esc(C.premio)}</span>
      </div>
      <div class="sec"><h3>Historial</h3></div>
      <div>${db.history.slice().sort((a, b) => b.date.localeCompare(a.date)).map((h) => { const s = svcById(h.svc); return `<div class="hist"><b>${esc(s.nombre)}</b><span>${fmtShort(h.date)} · ${s.precio} €</span></div>`; }).join("")}</div>
      <button class="btn ghost" data-repeat="1">Repetir último corte</button>
      <div class="owner"><button class="link" data-go="panel">¿Eres el peluquero? Abre el panel →</button></div>`;
  };

  // ---------- Panel del peluquero ----------
  const pn = { date: null, pro: null };
  RENDER.panel = () => {
    if (!pn.date) pn.date = todayKey();
    if (!pn.pro) pn.pro = C.equipo[0].id;
    const days = bookingDays().filter((k) => C.horario[fromKey(k).getDay()]).slice(0, 8);
    if (!days.includes(pn.date)) pn.date = days[0];
    const ranges = C.horario[fromKey(pn.date).getDay()] || [];
    const dayB = db.bookings.filter((b) => b.date === pn.date);
    const proB = dayB.filter((b) => b.pro === pn.pro);
    const total = dayB.reduce((a, b) => a + svcById(b.svc).precio, 0);
    const openMin = ranges.reduce((a, [x, y]) => a + toMin(y) - toMin(x), 0) * C.equipo.length;
    const busyMin = dayB.reduce((a, b) => a + b.min, 0);
    let rows = "";
    ranges.forEach(([a, b]) => {
      for (let t = toMin(a); t < toMin(b); t += C.intervaloMin) {
        const start = proB.find((x) => toMin(x.time) === t);
        const inside = proB.find((x) => toMin(x.time) < t && toMin(x.time) + x.min > t);
        const blk = db.blocked.find((x) => x.date === pn.date && x.pro === pn.pro && toMin(x.time) === t);
        if (start) {
          const s = svcById(start.svc);
          rows += `<div class="ag ${start.mine ? "mine" : "busy"}"><time>${fromMin(t)}</time><div><b>${esc(start.cliente)}</b><small>${esc(s.nombre)} · ${s.min} min · ${s.precio} €${start.mine ? " · reservada desde la app" : ""}</small></div><span></span></div>`;
        } else if (inside) continue;
        else if (blk) rows += `<div class="ag block"><time>${fromMin(t)}</time><div>Bloqueado</div><button data-unblock="${fromMin(t)}">Liberar</button></div>`;
        else rows += `<div class="ag"><time>${fromMin(t)}</time><div class="free">Libre</div><button data-block="${fromMin(t)}">Bloquear</button></div>`;
      }
    });
    $("#vPanel").innerHTML = `
      <div><span class="label" style="color:var(--gold)">Panel del peluquero</span><h2 class="h-page">Agenda</h2><p class="sub">${fmtLong(pn.date)}</p></div>
      <div class="days">${days.map((k) => { const d = fromKey(k); return `<button class="day ${k === pn.date ? "on" : ""}" data-pn-day="${k}">${k === todayKey() ? "Hoy" : DOW[d.getDay()]}<b>${d.getDate()}</b></button>`; }).join("")}</div>
      <div class="kpis">
        <div class="kpi"><b>${dayB.length}</b><span>Citas</span></div>
        <div class="kpi"><b>${total} €</b><span>Previsto</span></div>
        <div class="kpi"><b>${openMin ? Math.round((busyMin / openMin) * 100) : 0} %</b><span>Ocupación</span></div>
      </div>
      <div class="chips">${C.equipo.map((p) => `<button class="chip ${p.id === pn.pro ? "on" : ""}" data-pn-pro="${p.id}">${esc(p.nombre)}</button>`).join("")}</div>
      <div class="agenda">${rows || '<div class="empty">Cerrado este día.</div>'}</div>
      <p class="demo-note">Demo: clientes de ejemplo. Las reservas que hagas desde la app aparecen en verde.</p>
      <button class="btn ghost small" id="resetDemo">Reiniciar datos de la demo</button>
      <button class="btn small" data-go="inicio">Volver a la app</button>`;
  };

  // ---------- Acciones ----------
  function startBooking(svcId) {
    Object.assign(bk, { svc: svcId, t: null, assigned: null, done: null, editing: null, err: "" }); skipId = null;
    const nf = nextFree(svcId); bk.date = nf ? nf.date : todayKey();
    go("reservar");
  }

  function confirmBooking() {
    const nombre = $("#bkName").value.trim(), tel = $("#bkTel").value.trim();
    db.user = { nombre, tel };
    if (!nombre) { bk.err = "Escribe tu nombre para reservar."; return RENDER.reservar(); }
    if (tel.replace(/\D/g, "").length < 9) { bk.err = "El teléfono debe tener al menos 9 cifras."; return RENDER.reservar(); }
    const s = svcById(bk.svc);
    if (bk.editing) db.bookings = db.bookings.filter((b) => b.id !== bk.editing);
    if (!isFree(db, bk.date, bk.t, s.min, bk.assigned)) { bk.err = "Ese hueco se acaba de ocupar. Elige otra hora."; bk.t = null; return RENDER.reservar(); }
    const b = { id: "m" + Date.now(), date: bk.date, time: fromMin(bk.t), min: s.min, svc: s.id, pro: bk.assigned, cliente: nombre, tel, mine: true };
    db.bookings.push(b); save();
    const wasEdit = bk.editing;
    Object.assign(bk, { done: b, editing: null, err: "", t: null }); skipId = null;
    RENDER.reservar();
    $("#vReservar").scrollTop = 0;
    toast(wasEdit ? "Cita cambiada" : "Cita reservada");
  }

  function openWork(i) {
    const w = C.trabajos[i], s = svcById(w.servicio);
    openSheet(`
      <div class="media big">${mediaInner(w, i, { controls: true })}</div>
      <div class="sec"><div><h3>${esc(w.titulo)}</h3><span class="sub">${w.tipo === "video" ? "Reel" : "Foto"} · ${esc(w.estilo)}</span></div>${s ? `<span class="price">${s.precio} €</span>` : ""}</div>
      ${s ? `<button class="btn" data-want="${s.id}">Quiero este corte</button>` : ""}
      <a class="btn ghost" href="https://instagram.com/${esc(C.instagram)}" target="_blank" rel="noopener">Ver en Instagram</a>`);
  }

  document.addEventListener("click", (e) => {
    const t = e.target.closest("button, [data-go]");
    if (!t) { if (e.target.id === "sheetBg") closeSheet(); return; }
    const d = t.dataset;
    if (t.id === "brand") return go("inicio");
    if (d.go) { if (d.go === "reservar" && view !== "reservar") { bk.done = null; bk.editing = null; skipId = null; } return go(d.go); }
    if (d.svc) return startBooking(d.svc);
    if (d.want) return startBooking(d.want);
    if (d.cat) { svcCat = d.cat; return RENDER.servicios(); }
    if (d.gal) { galFilter = d.gal; return RENDER.trabajos(); }
    if (d.work !== undefined) return openWork(+d.work);
    // Reserva
    if (d.bkSvc) { bk.svc = d.bkSvc; bk.t = null; bk.err = ""; return RENDER.reservar(); }
    if (d.bkPro) { bk.pro = d.bkPro; bk.t = null; bk.err = ""; return RENDER.reservar(); }
    if (d.bkDay) { bk.date = d.bkDay; bk.t = null; bk.err = ""; return RENDER.reservar(); }
    if (d.bkT) {
      bk.t = +d.bkT; bk.err = "";
      const slot = slotsFor(bk.date, bk.svc, bk.pro).find((x) => x.t === bk.t);
      bk.assigned = slot && slot.pro;
      RENDER.reservar();
      const c = $("#bkConfirm"); if (c) c.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (t.id === "bkConfirm") return confirmBooking();
    if (t.id === "bkAgain") { Object.assign(bk, { done: null, t: null }); return RENDER.reservar(); }
    // Mis citas
    if (d.cancel) {
      const b = db.bookings.find((x) => x.id === d.cancel);
      return openSheet(`<h3>¿Cancelar la cita?</h3><p class="sub">${esc(svcById(b.svc).nombre)} · ${fmtLong(b.date)} · ${b.time}</p><p class="sub">El hueco quedará libre para otro cliente.</p><button class="btn danger" data-cancel-ok="${b.id}">Sí, cancelar cita</button><button class="btn ghost" id="sheetClose">Mantener cita</button>`);
    }
    if (d.cancelOk) { db.bookings = db.bookings.filter((x) => x.id !== d.cancelOk); save(); closeSheet(); RENDER.citas(); return toast("Cita cancelada"); }
    if (t.id === "sheetClose") return closeSheet();
    if (d.edit) {
      const b = db.bookings.find((x) => x.id === d.edit);
      Object.assign(bk, { svc: b.svc, pro: b.pro, date: b.date, t: null, done: null, err: "", editing: b.id });
      skipId = b.id;
      return go("reservar", { keepEdit: true });
    }
    if (d.repeat) { const last = db.history.slice().sort((a, b) => b.date.localeCompare(a.date))[0]; if (last) { bk.pro = last.pro; return startBooking(last.svc); } return; }
    // Panel
    if (d.pnDay) { pn.date = d.pnDay; return RENDER.panel(); }
    if (d.pnPro) { pn.pro = d.pnPro; return RENDER.panel(); }
    if (d.block) { db.blocked.push({ date: pn.date, pro: pn.pro, time: d.block }); save(); RENDER.panel(); return toast("Hueco bloqueado"); }
    if (d.unblock) { db.blocked = db.blocked.filter((x) => !(x.date === pn.date && x.pro === pn.pro && x.time === d.unblock)); save(); RENDER.panel(); return toast("Hueco liberado"); }
    if (t.id === "resetDemo") { db = seed(); save(); Object.assign(bk, { svc: null, pro: "any", date: null, t: null, done: null, editing: null }); RENDER.panel(); return toast("Demo reiniciada"); }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });

  // ---------- Arranque ----------
  load();
  document.title = C.nombre;
  $("#brandName").textContent = C.nombre;
  $("#logo").textContent = C.nombre.trim()[0].toUpperCase();
  $("#igBtn").href = "https://instagram.com/" + C.instagram;
  $("#tabbar").innerHTML = TABS.map(([v, l]) => `<button data-go="${v}" class="${v === "inicio" ? "on" : ""}">${I[v]}${l}</button>`).join("");
  RENDER.inicio();
})();
