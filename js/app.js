/* App de clientes: lee el negocio de la base de datos y guarda las reservas allí. */
(() => {
  const { pad, toMin, fromMin, dKey, fromKey, addDays, fmtLong, fmtShort, esc, euros } = UT;
  const $ = (s, el = document) => el.querySelector(s);
  const LS = "pelu-cliente-v2";

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
    wa: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3z"/></svg>',
  };
  const TABS = [["inicio", "Inicio"], ["servicios", "Servicios"], ["reservar", "Reservar"], ["trabajos", "Trabajos"], ["citas", "Mis citas"]];
  const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const DOW_L = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };
  const todayKey = () => dKey(new Date());

  // ---------- Estado ----------
  let N; // negocio: ajustes, equipo, servicios, horario, trabajos
  let busy = []; // huecos ocupados: {date, time, min, pro}
  let mias = []; // mis citas guardadas en la base de datos
  let local = { nombre: "", tel: "", tokens: [] };
  try { local = { ...local, ...JSON.parse(localStorage.getItem(LS) || "{}") }; } catch (e) {}
  const saveLocal = () => { try { localStorage.setItem(LS, JSON.stringify(local)); } catch (e) {} };

  const A = () => N.ajustes;
  const equipo = () => N.equipo.filter((p) => p.activo);
  const servicios = () => N.servicios.filter((s) => s.activo);
  const svcById = (id) => N.servicios.find((s) => s.id === id);
  const proById = (id) => N.equipo.find((p) => p.id === id);
  const bookingDays = () => { const b = new Date(); b.setHours(0, 0, 0, 0); return Array.from({ length: A().dias_reserva + 1 }, (_, i) => dKey(addDays(b, i))); };

  async function cargarOcupado() {
    const days = bookingDays();
    const { data, error } = await SB.rpc("ocupado", { desde: days[0], hasta: days[days.length - 1] });
    if (error) throw error;
    busy = data.map((r) => ({ date: r.fecha, time: r.hora, min: r.min, pro: r.profesional_id }));
  }
  async function cargarMias() {
    if (!local.tokens.length) { mias = []; return; }
    const { data, error } = await SB.rpc("mis_citas", { p_tokens: local.tokens });
    if (!error) mias = data;
  }

  function isFree(date, start, min, pro) {
    const end = start + min;
    return !busy.some((b) => b.date === date && b.pro === pro && b.id !== bk.editing && start < toMin(b.time) + b.min && toMin(b.time) < end);
  }
  function slotsFor(date, svcId, pro) {
    const ranges = N.horario[fromKey(date).getDay()], svc = svcById(svcId);
    if (!ranges || !svc) return [];
    const isToday = date === todayKey(), cut = nowMin() + 15, out = [];
    ranges.forEach(([a, b]) => {
      for (let t = toMin(a); t + svc.min <= toMin(b); t += A().intervalo_min) {
        if (isToday && t < cut) continue;
        const cands = pro === "any" ? equipo().map((p) => p.id) : [pro];
        out.push({ t, pro: cands.find((p) => isFree(date, t, svc.min, p)) || null });
      }
    });
    return out;
  }
  function nextFree(svcId) {
    for (const k of bookingDays()) {
      const s = slotsFor(k, svcId, "any").find((x) => x.pro);
      if (s) return { date: k, t: s.t };
    }
    return null;
  }
  function openNow() {
    const r = N.horario[new Date().getDay()], m = nowMin();
    const cur = r && r.find(([a, b]) => m >= toMin(a) && m < toMin(b));
    return cur ? cur[1] : null;
  }
  const defaultSvc = () => (servicios().find((s) => s.top) || servicios()[0] || {}).id;

  // ---------- Imagen de ejemplo cuando no hay foto ----------
  let artN = 0;
  const HUES = [32, 200, 14, 45, 265, 150, 0, 220];
  function art(item, idx) {
    const id = "g" + artN++, h = HUES[idx % HUES.length];
    const col = item.estilo === "Color" ? "#efe6cf" : "#16130f";
    const HAIR = {
      Fade: `<path d="M27 52c0-17 10-28 23-28s23 11 23 28c-3-6-8-10-23-10s-20 4-23 10z" fill="${col}"/>`,
      "Clásico": `<path d="M26 58c-2-22 10-36 26-36 14 0 24 10 22 30-5-10-13-15-30-14-8 1-14 9-18 20z" fill="${col}"/>`,
      Barba: `<path d="M28 50c0-16 9-26 22-26s22 10 22 26c-4-5-10-8-22-8s-18 3-22 8z" fill="${col}"/><path d="M29 66c2 18 10 28 21 28s19-10 21-28c-4 6-10 8-21 8s-17-2-21-8z" fill="${col}"/>`,
    };
    const hair = HAIR[item.estilo] || `<path d="M26 56c-1-20 9-33 24-33s25 13 24 33c-5-8-12-13-24-13s-19 5-24 13z" fill="${col}"/>`;
    return `<svg class="art" viewBox="0 0 100 125" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><radialGradient id="${id}" cx="50%" cy="35%" r="75%"><stop offset="0" stop-color="hsl(${h} 32% 40%)"/><stop offset="1" stop-color="hsl(${h} 30% 10%)"/></radialGradient></defs><rect width="100" height="125" fill="url(#${id})"/><path d="M8 125c4-20 20-28 42-28s38 8 42 28z" fill="#0d0d10"/><rect x="42" y="78" width="16" height="20" fill="#3a2e24"/><ellipse cx="50" cy="58" rx="22" ry="27" fill="#5a4636"/>${hair}</svg>`;
  }
  function mediaInner(w, idx, controls) {
    if (w.url && w.tipo === "video") return `<video src="${esc(w.url)}" muted loop playsinline ${controls ? "controls autoplay" : 'autoplay preload="metadata"'}></video>`;
    if (w.url) return `<img src="${esc(w.url)}" alt="${esc(w.titulo)}" loading="lazy">`;
    return art(w, idx);
  }
  const mediaTile = (w, idx, cls = "") =>
    `<button class="media ${cls}" data-work="${idx}" aria-label="${esc(w.titulo)}">${mediaInner(w, idx)}${w.tipo === "video" ? `<span class="play">${I.play}</span>` : ""}<span class="cap">${esc(w.titulo)}</span></button>`;

  // ---------- Navegación ----------
  let view = "inicio";
  function go(v) {
    view = v;
    document.querySelectorAll(".view").forEach((el) => el.classList.toggle("on", el.dataset.v === v));
    document.querySelectorAll(".tabbar button").forEach((b) => b.classList.toggle("on", b.dataset.go === v));
    closeSheet();
    if (v !== "reservar") bk.editing = null;
    RENDER[v]();
    const cur = $(`.view[data-v="${v}"]`); if (cur) cur.scrollTop = 0;
    if (v === "reservar") cargarOcupado().then(() => { if (view === "reservar" && !bk.saving && bk.t === null) RENDER.reservar(); }).catch(() => {});
    if (v === "citas") cargarMias().then(() => { if (view === "citas") RENDER.citas(); });
  }
  let toastT;
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2600); }
  function openSheet(html) { $("#sheet").innerHTML = html; $("#sheet").hidden = false; $("#sheetBg").hidden = false; }
  function closeSheet() { $("#sheet").hidden = true; $("#sheetBg").hidden = true; $("#sheet").innerHTML = ""; }

  // ---------- Pantallas ----------
  const RENDER = {};
  const svcRow = (s, on, attr = "data-svc") => `<button class="svc ${on ? "on" : ""}" ${attr}="${s.id}"><div><b>${esc(s.nombre)}${s.top ? '<span class="badge">TOP</span>' : ""}</b><div class="meta">${s.min} min</div>${s.descr ? `<div class="desc">${esc(s.descr)}</div>` : ""}</div><span class="price">${euros(s.precio)}</span></button>`;

  RENDER.inicio = () => {
    const a = A(), nf = nextFree(defaultSvc()), open = openNow();
    let nfTxt = "Sin huecos";
    if (nf) { const i = Math.round((fromKey(nf.date) - fromKey(todayKey())) / 864e5); nfTxt = `${i === 0 ? "Hoy" : i === 1 ? "Mañana" : DOW[fromKey(nf.date).getDay()]} ${fromMin(nf.t)}`; }
    const hero = a.portada_url
      ? (/\.(mp4|webm|mov)(\?|$)/i.test(a.portada_url) ? `<video src="${esc(a.portada_url)}" autoplay muted loop playsinline></video>` : `<img class="cover" src="${esc(a.portada_url)}" alt="">`)
      : `<svg class="hero-art" viewBox="0 0 100 125" aria-hidden="true"><path d="M8 125c4-20 20-28 42-28s38 8 42 28z" fill="#0d0d10"/><rect x="42" y="78" width="16" height="20" fill="#2c231b"/><ellipse cx="50" cy="58" rx="22" ry="27" fill="#3d3027"/><path d="M27 52c0-17 10-28 23-28s23 11 23 28c-3-6-8-10-23-10s-20 4-23 10z" fill="#0f0d0b"/><path d="M28 55c3-5 9-8 22-8s19 3 22 8" stroke="#d6a74e" stroke-width=".8" fill="none" opacity=".7"/></svg>`;
    const W = N.trabajos.map((w, i) => ({ w, i }));
    const reels = W.filter((o) => o.w.tipo === "video").concat(W.filter((o) => o.w.tipo !== "video")).slice(0, 8);
    const top = servicios().filter((s) => s.top).concat(servicios().filter((s) => !s.top)).slice(0, 3);
    const today = new Date().getDay();
    $("#vInicio").innerHTML = `
      <div class="hero">${hero}
        <span class="tag">${esc(a.ciudad)} · Barbería</span>
        <h1>${esc(a.lema)}</h1>
        <div class="sub"><span class="stars">★★★★★</span> ${String(a.valoracion).replace(".", ",")} · ${a.num_resenas} reseñas</div>
      </div>
      <button class="btn" data-go="reservar">Reservar cita</button>
      <div class="row">
        <div class="stat"><b>${nfTxt}</b><span>Próximo hueco libre</span></div>
        <div class="stat"><b><span class="dot" style="background:${open ? "var(--ok)" : "var(--bad)"}"></span>${open ? "Abierto" : "Cerrado"}</b><span>${open ? "Hasta las " + open : "Mira el horario abajo"}</span></div>
      </div>
      ${reels.length ? `<div class="sec"><h3>Últimos trabajos</h3><button class="link" data-go="trabajos">Ver todos</button></div>
      <div class="reels hscroll">${reels.map((o) => mediaTile(o.w, o.i, "reel")).join("")}</div>` : ""}
      <div class="sec"><h3>Los más pedidos</h3><button class="link" data-go="servicios">Carta completa</button></div>
      <div class="stack">${top.map((s) => svcRow(s)).join("")}</div>
      <div class="sec"><h3>Lo que dicen</h3></div>
      <div class="reels hscroll">${CONFIG.resenas.map((r) => `<div class="review"><span class="stars">${"★".repeat(r.estrellas)}</span><p>${esc(r.texto)}</p><b>${esc(r.nombre)}</b></div>`).join("")}</div>
      <div class="info">
        <div class="sec"><h3>${esc(a.direccion)}</h3><span class="sub">${esc(a.ciudad)}</span></div>
        <div class="hours">${[1, 2, 3, 4, 5, 6, 0].map((d) => { const r = N.horario[d]; return `<div class="${d === today ? "today" : ""}"><span>${DOW_L[d]}</span><span>${r ? r.map((x) => x.join("–")).join(" · ") : "Cerrado"}</span></div>`; }).join("")}</div>
        <div class="row">
          <a class="btn ghost small" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.direccion + ", " + a.ciudad)}" target="_blank" rel="noopener">Cómo llegar</a>
          <a class="btn ghost small" href="${UT.waLink(a.whatsapp, "Hola, tengo una pregunta:")}" target="_blank" rel="noopener">${I.wa} WhatsApp</a>
        </div>
      </div>`;
  };

  let svcCat = "Todos";
  RENDER.servicios = () => {
    const cats = ["Todos", ...new Set(servicios().map((s) => s.cat))];
    let last = "", body = "";
    servicios().filter((s) => svcCat === "Todos" || s.cat === svcCat).forEach((s) => {
      if (s.cat !== last) { body += `<div class="label cat-title">${esc(s.cat)}</div>`; last = s.cat; }
      body += svcRow(s);
    });
    $("#vServicios").innerHTML = `
      <div><h2 class="h-page">Servicios</h2><p class="sub">Toca un servicio para reservarlo.</p></div>
      <div class="chips wrap">${cats.map((c) => `<button class="chip ${c === svcCat ? "on" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}</div>
      <div class="stack">${body}</div>`;
  };

  // Reserva en curso
  const bk = { svc: null, pro: "any", date: null, t: null, assigned: null, done: null, editing: null, err: "", saving: false, showAll: false };

  RENDER.reservar = () => {
    const el = $("#vReservar");
    if (bk.done) {
      const b = bk.done, a = A();
      const msg = `Hola, soy ${local.nombre}. Acabo de reservar ${b.servicio} el ${fmtLong(b.date).toLowerCase()} a las ${b.time} con ${b.pro}.`;
      el.innerHTML = `
        <div class="done"><div class="check">${I.check}</div><h2 class="h-page">¡Cita reservada!</h2>
        <p class="sub">${esc(b.servicio)} con ${esc(b.pro)}<br><b style="color:var(--ink)">${fmtLong(b.date)} · ${b.time}</b></p>
        <p class="sub">Tu cita ya está en la agenda de ${esc(a.nombre)}.</p></div>
        <a class="btn wa" href="${UT.waLink(a.whatsapp, msg)}" target="_blank" rel="noopener">${I.wa} Avisar por WhatsApp</a>
        <button class="btn ghost" id="bkIcs">Añadir a mi calendario</button>
        <button class="btn ghost" data-go="citas">Ver mis citas</button>`;
      return;
    }
    if (!servicios().length) { el.innerHTML = `<div class="empty">Ahora mismo no hay servicios disponibles.</div>`; return; }
    if (!bk.svc || !svcById(bk.svc) || !svcById(bk.svc).activo) bk.svc = defaultSvc();
    if (!bk.date) { const nf = nextFree(bk.svc); bk.date = nf ? nf.date : todayKey(); }
    const s = svcById(bk.svc);
    const slots = slotsFor(bk.date, bk.svc, bk.pro);
    const list = bk.showAll ? servicios() : [s, ...servicios().filter((x) => x.id !== s.id)].slice(0, 3);
    el.innerHTML = `
      <div><h2 class="h-page">${bk.editing ? "Cambiar cita" : "Reservar"}</h2><p class="sub">Elige servicio, profesional, día y hora.</p></div>
      <div class="label">1 · Servicio</div>
      <div class="stack">${list.map((x) => svcRow(x, x.id === bk.svc, "data-bk-svc")).join("")}</div>
      ${servicios().length > 3 ? `<button class="link" id="bkMore">${bk.showAll ? "Ver menos" : `Ver los ${servicios().length} servicios`}</button>` : ""}

      <div class="label">2 · Profesional</div>
      <div class="pros">${equipo().map((p) => `<button class="pro ${bk.pro === p.id ? "on" : ""}" data-bk-pro="${p.id}"><span class="av" style="background:${esc(p.color)}">${esc(p.nombre[0])}</span>${esc(p.nombre)}<small>${esc(p.rol)}</small></button>`).join("")}
        <button class="pro ${bk.pro === "any" ? "on" : ""}" data-bk-pro="any"><span class="av" style="background:var(--s3);color:var(--ink)">?</span>Sin preferencia<small>El primero libre</small></button></div>

      <div class="label">3 · Día</div>
      <div class="days">${bookingDays().map((k) => { const d = fromKey(k); const closed = !N.horario[d.getDay()]; return `<button class="day ${k === bk.date ? "on" : ""}" data-bk-day="${k}" ${closed ? "disabled" : ""}>${k === todayKey() ? "Hoy" : DOW[d.getDay()]}<b>${d.getDate()}</b></button>`; }).join("")}</div>

      <div class="label">4 · Hora · ${fmtLong(bk.date)}</div>
      ${!slots.length ? `<div class="empty">Ese día no quedan horas. Prueba otro día.</div>`
        : !slots.some((x) => x.pro) ? `<div class="empty">Día completo. Prueba otro día u otro profesional.</div>`
        : `<div class="slots">${slots.map((x) => `<button class="slot ${bk.t === x.t ? "on" : ""}" data-bk-t="${x.t}" ${x.pro ? "" : "disabled"}>${fromMin(x.t)}</button>`).join("")}</div>`}

      ${bk.t !== null ? `
        <div class="summary" id="bkSummary">
          <div><span>Servicio</span><b>${esc(s.nombre)}</b></div>
          <div><span>Profesional</span><b>${esc((proById(bk.assigned) || {}).nombre || "")}</b></div>
          <div><span>Cuándo</span><b>${fmtShort(bk.date)} · ${fromMin(bk.t)}</b></div>
          <div><span>Duración</span><b>${s.min} min</b></div>
          <div><span>Total (se paga en el local)</span><b style="color:var(--gold)">${euros(s.precio)}</b></div>
        </div>
        <div class="field"><label class="label" for="bkName">Tu nombre</label><input id="bkName" autocomplete="name" value="${esc(local.nombre)}" placeholder="Nombre y apellido"></div>
        <div class="field"><label class="label" for="bkTel">Teléfono (WhatsApp)</label><input id="bkTel" type="tel" inputmode="tel" autocomplete="tel" value="${esc(local.tel)}" placeholder="600 123 456"></div>
        ${bk.err ? `<div class="err">${esc(bk.err)}</div>` : ""}
        <button class="btn" id="bkConfirm" ${bk.saving ? "disabled" : ""}>${bk.saving ? "Reservando…" : bk.editing ? "Guardar cambio" : "Confirmar cita"}</button>`
      : `${bk.err ? `<div class="err">${esc(bk.err)}</div>` : ""}<p class="sub" style="text-align:center">Elige una hora para continuar.</p>`}`;
  };

  let galFilter = "Todos";
  RENDER.trabajos = () => {
    const estilos = [...new Set(N.trabajos.map((w) => w.estilo))];
    const items = N.trabajos.map((w, i) => ({ w, i })).filter((o) => galFilter === "Todos" || o.w.estilo === galFilter);
    $("#vTrabajos").innerHTML = `
      <div><h2 class="h-page">Trabajos</h2><p class="sub">Clientes reales. Toca uno y pide el mismo corte.</p></div>
      <a class="ig-strip" href="https://instagram.com/${esc(A().instagram)}" target="_blank" rel="noopener">
        <span class="ig-logo">${I.ig}</span><span style="flex:1"><b>@${esc(A().instagram)}</b><br><span class="sub">Más vídeos en Instagram</span></span><span class="link">Seguir</span></a>
      <div class="chips wrap">${["Todos", ...estilos].map((f) => `<button class="chip ${f === galFilter ? "on" : ""}" data-gal="${esc(f)}">${esc(f)}</button>`).join("")}</div>
      ${items.length ? `<div class="grid3">${items.map((o) => mediaTile(o.w, o.i)).join("")}</div>` : `<div class="empty">Pronto subiremos trabajos aquí.</div>`}`;
  };

  RENDER.citas = () => {
    const now = new Date();
    const fut = (c) => new Date(fromKey(c.fecha).getTime() + toMin(c.hora) * 6e4) >= now;
    const prox = mias.filter((c) => c.estado === "confirmada" && fut(c));
    const hist = mias.filter((c) => c.estado === "completada").sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora));
    const n = A().sellos, stamps = hist.length % (n + 1);
    $("#vCitas").innerHTML = `
      <div><h2 class="h-page">Mis citas</h2><p class="sub">${local.nombre ? "Hola, " + esc(local.nombre.split(" ")[0]) : "Tus reservas y tu tarjeta de fidelidad."}</p></div>
      ${prox.length ? prox.map((c) => `
        <div class="appt"><span class="label" style="color:var(--gold)">Próxima cita</span>
          <div class="when">${DOW[fromKey(c.fecha).getDay()]} ${fmtShort(c.fecha)} · ${c.hora}</div>
          <div>${esc(c.servicio_nombre)} con ${esc((proById(c.profesional_id) || {}).nombre || "")} · ${euros(c.precio)}</div>
          <div class="row"><button class="btn ghost small" data-edit="${c.id}">Cambiar</button><button class="btn danger small" data-cancel="${c.id}">Cancelar</button></div>
        </div>`).join("")
        : `<div class="empty">No tienes citas pendientes en este móvil.<br><br><button class="btn small" data-go="reservar" style="width:auto;display:inline-flex">Reservar ahora</button></div>`}
      <div class="loyal">
        <div class="sec"><h3>Tarjeta de fidelidad</h3><span class="sub">${stamps} de ${n}</span></div>
        <div class="stamps" style="grid-template-columns:repeat(${n + 1},1fr)">${Array.from({ length: n + 1 }, (_, i) => i < stamps ? `<div class="stamp f">${I.check}</div>` : i === n ? `<div class="stamp">%</div>` : `<div class="stamp">${i + 1}</div>`).join("")}</div>
        <span class="sub">${esc(A().premio)}. Se sella cuando el peluquero marca tu cita como hecha.</span>
      </div>
      ${hist.length ? `<div class="sec"><h3>Historial</h3></div>
      <div>${hist.map((h) => `<div class="hist"><b>${esc(h.servicio_nombre)}</b><span>${fmtShort(h.fecha)} · ${euros(h.precio)}</span></div>`).join("")}</div>
      <button class="btn ghost" data-repeat="1">Repetir último corte</button>` : ""}
      <div class="owner"><a class="link" href="panel.html">¿Eres el peluquero? Entra en tu panel →</a></div>`;
  };

  // ---------- Acciones ----------
  function startBooking(svcId, pro) {
    Object.assign(bk, { svc: svcId, pro: pro || bk.pro, t: null, assigned: null, done: null, editing: null, err: "", date: null });
    go("reservar");
  }

  async function confirmBooking() {
    const nombre = $("#bkName").value.trim(), tel = $("#bkTel").value.trim();
    local.nombre = nombre; local.tel = tel; saveLocal();
    if (nombre.length < 2) { bk.err = "Escribe tu nombre para reservar."; return RENDER.reservar(); }
    if (tel.replace(/\D/g, "").length < 9) { bk.err = "El teléfono debe tener al menos 9 cifras."; return RENDER.reservar(); }
    bk.saving = true; bk.err = ""; RENDER.reservar();
    const s = svcById(bk.svc), editing = bk.editing;
    // Al cambiar una cita, primero se libera la antigua para poder elegir su mismo hueco
    const old = editing && mias.find((c) => c.id === editing);
    if (old) await SB.rpc("cancelar_cita", { p_id: old.id, p_token: old.token });
    const { data, error } = await SB.rpc("reservar", { p_servicio: bk.svc, p_profesional: bk.pro === "any" ? null : bk.pro, p_fecha: bk.date, p_hora: fromMin(bk.t), p_nombre: nombre, p_tel: tel });
    bk.saving = false;
    if (error) {
      bk.err = (error.message || "No se ha podido reservar. Inténtalo de nuevo.") + (old ? " Tu cita anterior se ha cancelado: elige otra hora." : "");
      bk.editing = null;
      await Promise.all([cargarOcupado(), cargarMias()]).catch(() => {});
      if (/ocupar|pasado|cerrada/.test(error.message || "")) bk.t = null;
      return RENDER.reservar();
    }
    local.tokens = [...local.tokens, data.token].slice(-50); saveLocal();
    bk.done = { servicio: s.nombre, pro: (proById(data.profesional_id) || {}).nombre || "", date: bk.date, time: fromMin(bk.t), min: s.min };
    Object.assign(bk, { editing: null, t: null });
    cargarOcupado().catch(() => {}); cargarMias();
    RENDER.reservar(); $("#vReservar").scrollTop = 0;
    toast(old ? "Cita cambiada" : "Cita reservada");
  }

  function icsDownload() {
    const b = bk.done; if (!b) return;
    const d = fromKey(b.date), st = toMin(b.time), en = st + b.min;
    const f = (m) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(Math.floor(m / 60))}${pad(m % 60)}00`;
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//peluqueria//ES", "BEGIN:VEVENT", `UID:${Date.now()}@peluqueria`, `DTSTART:${f(st)}`, `DTEND:${f(en)}`, `SUMMARY:${b.servicio} · ${A().nombre}`, `LOCATION:${A().direccion}, ${A().ciudad}`, "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:Cita en la peluquería", "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = "cita-peluqueria.ics"; document.body.appendChild(a); a.click(); a.remove();
  }

  function openWork(i) {
    const w = N.trabajos[i], s = w.servicio_id && svcById(w.servicio_id);
    openSheet(`
      <div class="media big">${mediaInner(w, i, true)}</div>
      <div class="sec"><div><h3>${esc(w.titulo)}</h3><span class="sub">${w.tipo === "video" ? "Reel" : "Foto"} · ${esc(w.estilo)}</span></div>${s ? `<span class="price">${euros(s.precio)}</span>` : ""}</div>
      ${s && s.activo ? `<button class="btn" data-want="${s.id}">Quiero este corte</button>` : `<button class="btn" data-go="reservar">Reservar cita</button>`}
      <a class="btn ghost" href="https://instagram.com/${esc(A().instagram)}" target="_blank" rel="noopener">Ver en Instagram</a>`);
  }

  document.addEventListener("click", async (e) => {
    const t = e.target.closest("button, [data-go]");
    if (!t) { if (e.target.id === "sheetBg") closeSheet(); return; }
    if (!N) return;
    const d = t.dataset;
    if (t.id === "brand") return go("inicio");
    if (d.go) { if (d.go === "reservar" && view !== "reservar") { bk.done = null; bk.t = null; bk.err = ""; } return go(d.go); }
    if (d.svc) return startBooking(d.svc);
    if (d.want) return startBooking(d.want);
    if (d.cat) { svcCat = d.cat; return RENDER.servicios(); }
    if (d.gal) { galFilter = d.gal; return RENDER.trabajos(); }
    if (d.work !== undefined) return openWork(+d.work);
    if (t.id === "bkMore") { bk.showAll = !bk.showAll; return RENDER.reservar(); }
    if (d.bkSvc) { bk.svc = d.bkSvc; bk.t = null; bk.err = ""; return RENDER.reservar(); }
    if (d.bkPro) { bk.pro = d.bkPro; bk.t = null; bk.err = ""; return RENDER.reservar(); }
    if (d.bkDay) { bk.date = d.bkDay; bk.t = null; bk.err = ""; return RENDER.reservar(); }
    if (d.bkT) {
      bk.t = +d.bkT; bk.err = "";
      const slot = slotsFor(bk.date, bk.svc, bk.pro).find((x) => x.t === bk.t);
      bk.assigned = slot && slot.pro;
      RENDER.reservar();
      const c = $("#bkSummary"); if (c) c.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (t.id === "bkConfirm") return confirmBooking();
    if (t.id === "bkIcs") return icsDownload();
    if (d.cancel) {
      const c = mias.find((x) => x.id === d.cancel);
      return openSheet(`<h3>¿Cancelar la cita?</h3><p class="sub">${esc(c.servicio_nombre)} · ${fmtLong(c.fecha)} · ${c.hora}</p><p class="sub">El hueco quedará libre para otro cliente.</p><button class="btn danger" data-cancel-ok="${c.id}">Sí, cancelar cita</button><button class="btn ghost" id="sheetClose">Mantener cita</button>`);
    }
    if (d.cancelOk) {
      const c = mias.find((x) => x.id === d.cancelOk);
      t.disabled = true;
      const { error } = await SB.rpc("cancelar_cita", { p_id: c.id, p_token: c.token });
      closeSheet();
      if (error) return toast(error.message);
      await cargarMias(); cargarOcupado().catch(() => {}); RENDER.citas(); return toast("Cita cancelada");
    }
    if (t.id === "sheetClose") return closeSheet();
    if (d.edit) {
      const c = mias.find((x) => x.id === d.edit);
      Object.assign(bk, { svc: c.servicio_id, pro: c.profesional_id, date: c.fecha, t: null, done: null, err: "" });
      go("reservar"); bk.editing = c.id;
      // Su propio hueco se muestra libre
      busy = busy.filter((b) => !(b.date === c.fecha && b.time === c.hora && b.pro === c.profesional_id));
      RENDER.reservar();
      return;
    }
    if (d.repeat) { const h = mias.filter((c) => c.estado === "completada").sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora))[0]; if (h && svcById(h.servicio_id)) return startBooking(h.servicio_id, h.profesional_id); return go("reservar"); }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });

  // Con ratón: la rueda mueve también las filas horizontales
  document.addEventListener("wheel", (e) => {
    const row = e.target.closest(".hscroll");
    if (!row || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    const max = row.scrollWidth - row.clientWidth;
    if (max <= 0) return;
    if ((e.deltaY > 0 && row.scrollLeft < max - 1) || (e.deltaY < 0 && row.scrollLeft > 0)) { e.preventDefault(); row.scrollLeft += e.deltaY; }
  }, { passive: false });

  // ---------- Arranque ----------
  async function start() {
    $("#tabbar").innerHTML = TABS.map(([v, l]) => `<button data-go="${v}" class="${v === "inicio" ? "on" : ""}">${I[v]}${l}</button>`).join("");
    $("#vInicio").innerHTML = `<div class="loading"><span class="spin"></span>Cargando…</div>`;
    try {
      N = await UT.cargarNegocio();
      await Promise.all([cargarOcupado(), cargarMias()]);
    } catch (err) {
      console.error(err);
      $("#vInicio").innerHTML = `<div class="empty">No se ha podido cargar la peluquería. Revisa tu conexión.<br><br><button class="btn small" onclick="location.reload()" style="width:auto;display:inline-flex">Reintentar</button></div>`;
      return;
    }
    const a = A();
    document.title = a.nombre;
    $("#brandName").textContent = a.nombre;
    $("#logo").textContent = a.nombre.trim()[0].toUpperCase();
    $("#igBtn").href = "https://instagram.com/" + a.instagram;
    const h = location.hash.slice(1);
    go(TABS.some(([v]) => v === h) ? h : "inicio");
    setInterval(() => cargarOcupado().then(() => { if (view === "inicio") RENDER.inicio(); }).catch(() => {}), 60000);
  }
  start();
})();
