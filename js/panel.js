/* Panel del peluquero: agenda, avisos, clientes, servicios, equipo, horario, trabajos y ajustes. */
(() => {
  const { toMin, fromMin, dKey, fromKey, addDays, fmtLong, fmtShort, esc, euros, waLink } = UT;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const DOW_L = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const ESTADOS = { confirmada: "Confirmada", completada: "Hecha", cancelada: "Cancelada", no_vino: "No vino" };
  const todayKey = () => dKey(new Date());

  let N = null;        // negocio
  let view = "agenda";
  let day = todayKey();
  let dayCitas = [], dayBlocks = [];
  let nuevas = 0;      // reservas nuevas sin mirar
  const vistas = new Set(); // ids que ya se han resaltado

  const SECTIONS = [
    ["agenda", "Agenda"], ["avisos", "Reservas y avisos"], ["clientes", "Clientes"],
    ["servicios", "Servicios y precios"], ["equipo", "Equipo y horario"], ["trabajos", "Trabajos (fotos)"], ["ajustes", "Datos del negocio"],
  ];

  // ---------- Utilidades de interfaz ----------
  let toastT;
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2800); }
  function modal(html) { $("#modal").innerHTML = html; $("#modal").hidden = false; $("#modalBg").hidden = false; const f = $("#modal input, #modal select, #modal button"); if (f) f.focus(); }
  function closeModal() { $("#modal").hidden = true; $("#modalBg").hidden = true; $("#modal").innerHTML = ""; }
  const proById = (id) => N.equipo.find((p) => p.id === id) || { nombre: "—", color: "#555" };
  const svcById = (id) => N.servicios.find((s) => s.id === id);
  const A = () => N.ajustes;
  function fail(error) { console.error(error); toast("No se ha podido guardar: " + (error.message || "error")); }
  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.18].forEach((d) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ctx.destination); g.gain.setValueAtTime(0.15, ctx.currentTime + d); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.15); o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.16); });
    } catch (e) {}
  }

  // Mensajes de WhatsApp que manda el peluquero
  const msgConfirm = (c) => `Hola ${c.cliente_nombre.split(" ")[0]}, te confirmamos tu cita en ${A().nombre}: ${c.servicio_nombre} el ${fmtLong(c.fecha).toLowerCase()} a las ${c.hora.slice(0, 5)}. ¡Te esperamos!`;
  const msgReminder = (c) => `Hola ${c.cliente_nombre.split(" ")[0]}, te recordamos tu cita ${c.fecha === dKey(addDays(new Date(), 1)) ? "de mañana" : "del " + fmtShort(c.fecha)} a las ${c.hora.slice(0, 5)} en ${A().nombre} (${A().direccion}). Si no puedes venir, avísanos por aquí.`;
  const msgThanks = (c) => `Gracias por venir, ${c.cliente_nombre.split(" ")[0]}. Si te ha gustado el resultado, nos ayudas mucho dejando una reseña o etiquetándonos en Instagram @${A().instagram}.`;

  // ---------- Sesión ----------
  let signup = false;
  async function boot() {
    const { data } = await SB.auth.getSession();
    if (!data.session) return showLogin();
    const { data: ok, error } = await SB.rpc("es_admin");
    if (error || !ok) { await SB.auth.signOut(); return showLogin("Esta cuenta no tiene permiso para gestionar la peluquería."); }
    $("#login").hidden = true; $("#panel").hidden = false;
    await reloadNegocio();
    $("#nav").innerHTML = SECTIONS.map(([v, l]) => `<button data-nav="${v}">${l}${v === "avisos" ? '<span class="pill" id="pillNew" hidden></span>' : ""}</button>`).join("");
    subscribe();
    go(location.hash.slice(1) && SECTIONS.some(([v]) => v === location.hash.slice(1)) ? location.hash.slice(1) : "agenda");
    updateNotifBtn();
  }
  function showLogin(err = "") {
    $("#panel").hidden = true; $("#login").hidden = false;
    $("#lgErr").textContent = err;
  }
  $("#lgToggle").addEventListener("click", () => {
    signup = !signup;
    $("#lgBtn").textContent = signup ? "Crear cuenta" : "Entrar";
    $("#lgToggle").textContent = signup ? "Ya tengo cuenta: entrar" : "¿Primera vez? Crear la cuenta del dueño";
    $("#loginSub").textContent = signup ? "La primera cuenta que se crea queda como dueño de la peluquería. Te llegará un correo para confirmarla." : "Entra con tu correo para ver tu agenda y gestionar la peluquería.";
    $("#lgPass").autocomplete = signup ? "new-password" : "current-password";
    $("#lgErr").textContent = "";
  });
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#lgEmail").value.trim(), password = $("#lgPass").value;
    $("#lgBtn").disabled = true; $("#lgErr").textContent = "";
    const res = signup
      ? await SB.auth.signUp({ email, password, options: { emailRedirectTo: location.href.split("#")[0] } })
      : await SB.auth.signInWithPassword({ email, password });
    $("#lgBtn").disabled = false;
    if (res.error) {
      const m = res.error.message || "";
      $("#lgErr").textContent = /Invalid login/i.test(m) ? "Correo o contraseña incorrectos." : /confirm/i.test(m) ? "Confirma primero tu correo con el enlace que te hemos enviado." : m;
      return;
    }
    if (signup && !res.data.session) { $("#lgErr").style.color = "var(--ok)"; $("#lgErr").textContent = "Cuenta creada. Abre el correo que te hemos enviado, confirma y vuelve aquí para entrar."; return; }
    boot();
  });
  $("#logout").addEventListener("click", async () => { await SB.auth.signOut(); location.reload(); });

  async function reloadNegocio() {
    N = await UT.cargarNegocio();
    $("#pName").textContent = A().nombre;
    $("#pLogo").textContent = A().nombre.trim()[0].toUpperCase();
    document.title = "Panel · " + A().nombre;
  }

  // ---------- Avisos en tiempo real ----------
  function subscribe() {
    SB.channel("citas-panel")
      .on("postgres_changes", { event: "*", schema: "public", table: "citas" }, (p) => {
        const c = p.new && p.new.id ? p.new : null;
        if (p.eventType === "INSERT" && c && c.origen === "app") {
          nuevas++; updatePill();
          beep();
          const txt = `Nueva reserva: ${c.cliente_nombre} · ${c.servicio_nombre} · ${fmtShort(c.fecha)} ${String(c.hora).slice(0, 5)}`;
          toast(txt);
          if ("Notification" in window && Notification.permission === "granted") { try { new Notification(A().nombre, { body: txt, icon: "img/icono.svg" }); } catch (e) {} }
        }
        if (p.eventType === "UPDATE" && c && c.estado === "cancelada" && p.old && p.old.estado !== "cancelada") toast(`Cita cancelada: ${c.cliente_nombre} · ${fmtShort(c.fecha)} ${String(c.hora).slice(0, 5)}`);
        refresh();
      })
      .subscribe();
  }
  function updatePill() { const p = $("#pillNew"); if (!p) return; p.hidden = !nuevas; p.textContent = nuevas; }
  function updateNotifBtn() {
    const b = $("#notifBtn");
    if (!("Notification" in window)) { b.hidden = true; return; }
    b.textContent = Notification.permission === "granted" ? "🔔 Avisos activados" : "🔔 Activar avisos";
  }
  $("#notifBtn").addEventListener("click", async () => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") await Notification.requestPermission();
    updateNotifBtn(); beep();
    toast(Notification.permission === "granted" ? "Avisos activados: sonará y saldrá un aviso con cada reserva nueva mientras el panel esté abierto." : "El navegador ha bloqueado los avisos. Seguirás viendo y oyendo las reservas en el panel.");
  });

  // ---------- Navegación ----------
  function go(v) {
    view = v;
    history.replaceState(null, "", "#" + v);
    $$("#nav button").forEach((b) => b.classList.toggle("on", b.dataset.nav === v));
    if (v === "avisos") { nuevas = 0; updatePill(); }
    refresh();
    window.scrollTo(0, 0);
  }
  let refreshing = null;
  function refresh() {
    clearTimeout(refreshing);
    refreshing = setTimeout(() => R[view]().catch(fail), 30);
  }
  const R = {};

  // ---------- AGENDA ----------
  async function loadDay() {
    const [c, b] = await Promise.all([
      SB.from("citas").select("*").eq("fecha", day).order("hora"),
      SB.from("bloqueos").select("*").eq("fecha", day),
    ]);
    if (c.error) throw c.error;
    dayCitas = c.data.map((x) => ({ ...x, hora: x.hora.slice(0, 5) }));
    dayBlocks = (b.data || []).map((x) => ({ ...x, hora: x.hora.slice(0, 5) }));
  }
  R.agenda = async () => {
    await loadDay();
    const ranges = N.horario[fromKey(day).getDay()] || [];
    const activos = dayCitas.filter((c) => c.estado !== "cancelada");
    const total = activos.filter((c) => c.estado !== "no_vino").reduce((a, c) => a + Number(c.precio), 0);
    const hechas = dayCitas.filter((c) => c.estado === "completada").reduce((a, c) => a + Number(c.precio), 0);
    const eq = N.equipo.filter((p) => p.activo);
    const openMin = ranges.reduce((a, [x, y]) => a + toMin(y) - toMin(x), 0) * eq.length;
    const busyMin = activos.reduce((a, c) => a + c.min, 0);
    const cols = eq.map((p) => {
      const mine = activos.filter((c) => c.profesional_id === p.id);
      let rows = "";
      ranges.forEach(([a, b]) => {
        for (let t = toMin(a); t < toMin(b); t += A().intervalo_min) {
          const st = mine.find((c) => toMin(c.hora) === t);
          const inside = mine.find((c) => toMin(c.hora) < t && toMin(c.hora) + c.min > t);
          const blk = dayBlocks.find((x) => x.profesional_id === p.id && toMin(x.hora) === t);
          if (st) {
            const isNew = st.origen === "app" && Date.now() - new Date(st.creado).getTime() < 864e5;
            const flash = isNew && !vistas.has(st.id); vistas.add(st.id);
            rows += `<div class="ag cita ${st.estado} ${flash ? "flash" : ""}" data-cita="${st.id}" tabindex="0"><time>${st.hora}</time><div><b>${esc(st.cliente_nombre)} ${isNew ? '<span class="chip nueva">Nueva</span>' : ""}</b><small>${esc(st.servicio_nombre)} · ${st.min} min · ${euros(st.precio)}</small></div><span class="chip ${st.estado}">${ESTADOS[st.estado]}</span></div>`;
          } else if (inside) continue;
          else if (blk) rows += `<div class="ag block"><time>${fromMin(t)}</time><div class="t">Bloqueado</div><div class="acts" style="opacity:1"><button class="mini" data-unblock="${blk.id}">Liberar</button></div></div>`;
          else rows += `<div class="ag free"><time>${fromMin(t)}</time><div class="t">Libre</div><div class="acts"><button class="mini" data-new="${p.id}|${fromMin(t)}">+ Cita</button><button class="mini" data-block="${p.id}|${fromMin(t)}">Bloquear</button></div></div>`;
        }
      });
      return `<div class="col"><div class="col-head"><span class="av" style="background:${esc(p.color)}">${esc(p.nombre[0])}</span><div><b>${esc(p.nombre)}</b><div class="sub">${mine.length} citas</div></div></div>${rows || '<div class="empty">Cerrado</div>'}</div>`;
    }).join("");
    const canc = dayCitas.filter((c) => c.estado === "cancelada");
    $("#main").innerHTML = `
      <div class="head"><div><span class="label">Agenda</span><h2>${fmtLong(day)}</h2></div>
        <div class="tools">
          <button class="btn ghost small" data-day="-1" aria-label="Día anterior">←</button>
          <input type="date" id="dayPick" value="${day}">
          <button class="btn ghost small" data-day="1" aria-label="Día siguiente">→</button>
          <button class="btn ghost small" data-day="0">Hoy</button>
          <button class="btn small" data-new="|">+ Nueva cita</button>
        </div></div>
      <div class="kpis">
        <div class="kpi"><b>${activos.length}</b><span>Citas del día</span></div>
        <div class="kpi"><b>${euros(total)}</b><span>Previsto</span></div>
        <div class="kpi"><b>${euros(hechas)}</b><span>Cobrado (citas hechas)</span></div>
        <div class="kpi"><b>${openMin ? Math.round((busyMin / openMin) * 100) : 0} %</b><span>Ocupación</span></div>
      </div>
      ${ranges.length ? `<div class="cols">${cols}</div>` : `<div class="empty">La peluquería está cerrada este día. Puedes cambiar el horario en «Equipo y horario».</div>`}
      ${canc.length ? `<div class="card"><h3>Canceladas este día</h3><div class="list">${canc.map((c) => `<div class="item"><div><b>${c.hora} · ${esc(c.cliente_nombre)}</b><div class="sub">${esc(c.servicio_nombre)} · ${esc(proById(c.profesional_id).nombre)}</div></div><div class="acts"><a class="btn wa small" target="_blank" rel="noopener" href="${waLink(c.cliente_tel, `Hola ${c.cliente_nombre.split(" ")[0]}, hemos visto que has cancelado tu cita. ¿Quieres que te busquemos otro hueco?`)}">WhatsApp</a></div></div>`).join("")}</div></div>` : ""}`;
  };

  function citaModal(c) {
    const s = svcById(c.servicio_id);
    modal(`
      <div><span class="chip ${c.estado}">${ESTADOS[c.estado]}</span> ${c.origen === "app" ? '<span class="chip app">Reservada desde la app</span>' : ""}</div>
      <h2>${esc(c.cliente_nombre)}</h2>
      <div class="kv">
        <span>Cuándo</span><b>${fmtLong(c.fecha)} · ${c.hora.slice(0, 5)}</b>
        <span>Servicio</span><b>${esc(c.servicio_nombre)} · ${c.min} min · ${euros(c.precio)}</b>
        <span>Profesional</span><b>${esc(proById(c.profesional_id).nombre)}</b>
        <span>Teléfono</span><b><span style="user-select:all">${esc(c.cliente_tel)}</span></b>
        <span>Reservada</span><b>${new Date(c.creado).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</b>
      </div>
      <label class="field"><span>Notas internas</span><textarea id="cNotas" rows="2" placeholder="Ej.: degradado al 0, alérgico a…">${esc(c.notas)}</textarea></label>
      <div class="label">WhatsApp al cliente</div>
      <div class="row">
        <a class="btn wa small" target="_blank" rel="noopener" href="${waLink(c.cliente_tel, msgConfirm(c))}">Confirmar cita</a>
        <a class="btn wa small" target="_blank" rel="noopener" href="${waLink(c.cliente_tel, msgReminder(c))}">Recordatorio</a>
        <a class="btn wa small" target="_blank" rel="noopener" href="${waLink(c.cliente_tel, msgThanks(c))}">Pedir reseña</a>
      </div>
      <div class="label">Cambiar estado</div>
      <div class="row">
        <button class="btn okb small" data-estado="completada" data-id="${c.id}">✓ Hecha</button>
        <button class="btn ghost small" data-estado="no_vino" data-id="${c.id}">No vino</button>
        <button class="btn ghost small" data-estado="confirmada" data-id="${c.id}">Confirmada</button>
        <button class="btn danger small" data-estado="cancelada" data-id="${c.id}">Cancelar cita</button>
      </div>
      <div class="row"><button class="btn small" data-savenotas="${c.id}">Guardar notas</button><button class="btn ghost small" data-close>Cerrar</button></div>
      ${s ? "" : '<p class="sub">Este servicio ya no está en la carta.</p>'}`);
  }

  // Huecos libres para una cita nueva (calculado en el panel)
  async function freeTimes(fecha, svcId, proId) {
    const s = svcById(svcId), ranges = N.horario[fromKey(fecha).getDay()] || [];
    if (!s || !proId) return [];
    const [c, b] = await Promise.all([
      SB.from("citas").select("hora,min").eq("fecha", fecha).eq("profesional_id", proId).in("estado", ["confirmada", "completada"]),
      SB.from("bloqueos").select("hora").eq("fecha", fecha).eq("profesional_id", proId),
    ]);
    const busy = (c.data || []).map((x) => [toMin(x.hora), toMin(x.hora) + x.min]).concat((b.data || []).map((x) => [toMin(x.hora), toMin(x.hora) + A().intervalo_min]));
    const out = [], n = new Date(), cut = fecha === todayKey() ? n.getHours() * 60 + n.getMinutes() : -1;
    ranges.forEach(([a, z]) => {
      for (let t = toMin(a); t + s.min <= toMin(z); t += A().intervalo_min) {
        if (t < cut) continue;
        if (!busy.some(([x, y]) => t < y && x < t + s.min)) out.push(fromMin(t));
      }
    });
    return out;
  }
  async function newCitaModal(proId, hora) {
    const eq = N.equipo.filter((p) => p.activo), sv = N.servicios.filter((s) => s.activo);
    modal(`
      <h2>Nueva cita</h2>
      <p class="sub">Para clientes que llaman o vienen al local. Le aparecerá en la agenda como cualquier reserva.</p>
      <div class="form-grid">
        <label class="field"><span>Cliente</span><input id="nNombre" autocomplete="off" placeholder="Nombre"></label>
        <label class="field"><span>Teléfono</span><input id="nTel" type="tel" inputmode="tel" autocomplete="off" placeholder="600 123 456"></label>
        <label class="field"><span>Servicio</span><select id="nSvc">${sv.map((s) => `<option value="${s.id}">${esc(s.nombre)} · ${s.min} min · ${euros(s.precio)}</option>`).join("")}</select></label>
        <label class="field"><span>Profesional</span><select id="nPro">${eq.map((p) => `<option value="${p.id}" ${p.id === proId ? "selected" : ""}>${esc(p.nombre)}</option>`).join("")}</select></label>
        <label class="field"><span>Día</span><input id="nFecha" type="date" value="${day}"></label>
        <label class="field"><span>Hora</span><select id="nHora"></select></label>
      </div>
      <label class="field"><span>Notas</span><input id="nNotas" autocomplete="off"></label>
      <div class="err" id="nErr"></div>
      <div class="row"><button class="btn" id="nSave">Guardar cita</button><button class="btn ghost" data-close>Cancelar</button></div>`);
    const fill = async () => {
      const ts = await freeTimes($("#nFecha").value, $("#nSvc").value, $("#nPro").value);
      $("#nHora").innerHTML = ts.length ? ts.map((t) => `<option ${t === hora ? "selected" : ""}>${t}</option>`).join("") : '<option value="">Sin huecos libres</option>';
    };
    ["nFecha", "nSvc", "nPro"].forEach((id) => $("#" + id).addEventListener("change", () => { hora = null; fill(); }));
    await fill();
    $("#nNombre").focus();
  }
  async function saveNewCita() {
    const s = svcById($("#nSvc").value), nombre = $("#nNombre").value.trim(), tel = $("#nTel").value.replace(/\D/g, ""), h = $("#nHora").value;
    if (nombre.length < 2) return ($("#nErr").textContent = "Escribe el nombre del cliente.");
    if (!h) return ($("#nErr").textContent = "No hay hora libre ese día para ese servicio.");
    $("#nSave").disabled = true;
    const { error } = await SB.from("citas").insert({ fecha: $("#nFecha").value, hora: h, min: s.min, servicio_id: s.id, servicio_nombre: s.nombre, precio: s.precio, profesional_id: $("#nPro").value, cliente_nombre: nombre, cliente_tel: tel, origen: "panel", notas: $("#nNotas").value.trim() });
    if (error) { $("#nSave").disabled = false; return fail(error); }
    day = $("#nFecha").value; closeModal(); toast("Cita guardada"); if (view !== "agenda") go("agenda"); else refresh();
  }

  // ---------- RESERVAS Y AVISOS ----------
  R.avisos = async () => {
    const tomorrow = dKey(addDays(new Date(), 1));
    const since = new Date(Date.now() - 3 * 864e5).toISOString();
    const [nv, man] = await Promise.all([
      SB.from("citas").select("*").eq("origen", "app").gte("creado", since).order("creado", { ascending: false }).limit(60),
      SB.from("citas").select("*").eq("fecha", tomorrow).eq("estado", "confirmada").order("hora"),
    ]);
    if (nv.error) throw nv.error;
    const line = (c, msg, label) => `<div class="item"><div><b>${esc(c.cliente_nombre)}</b> <span class="chip ${c.estado}">${ESTADOS[c.estado]}</span><div class="sub">${esc(c.servicio_nombre)} · ${fmtLong(c.fecha)} · ${c.hora.slice(0, 5)} · ${esc(proById(c.profesional_id).nombre)}</div></div><div class="acts"><a class="btn wa small" target="_blank" rel="noopener" href="${waLink(c.cliente_tel, msg(c))}">${label}</a><button class="btn ghost small" data-open="${c.id}">Ver</button></div></div>`;
    $("#main").innerHTML = `
      <div class="head"><div><span class="label">Reservas y avisos</span><h2>Lo que ha pasado</h2></div></div>
      <div class="card">
        <h3>Cómo te llegan las reservas</h3>
        <p class="sub">Cada reserva de la app entra al momento en tu agenda. Con este panel abierto suena un aviso y, si activas los avisos del navegador, te sale una notificación. Además, el cliente puede escribirte por WhatsApp al terminar de reservar. Desde aquí le confirmas o le recuerdas la cita con un toque: se abre WhatsApp con el mensaje ya escrito.</p>
      </div>
      <div class="two">
        <div class="card"><h3>Recordatorios para mañana</h3>${man.data.length ? `<div class="list">${man.data.map((c) => line(c, msgReminder, "Recordar")).join("")}</div>` : '<div class="empty">Mañana no hay citas confirmadas.</div>'}</div>
        <div class="card"><h3>Reservas desde la app (últimos 3 días)</h3>${nv.data.length ? `<div class="list">${nv.data.map((c) => line(c, msgConfirm, "Confirmar")).join("")}</div>` : '<div class="empty">Todavía no hay reservas desde la app.</div>'}</div>
      </div>`;
  };

  // ---------- CLIENTES ----------
  let qCli = "";
  R.clientes = async () => {
    const { data, error } = await SB.from("citas").select("cliente_nombre,cliente_tel,fecha,hora,estado,precio,servicio_nombre").order("fecha", { ascending: false }).limit(5000);
    if (error) throw error;
    const map = new Map();
    const hoy = todayKey();
    data.forEach((c) => {
      const k = c.cliente_tel || c.cliente_nombre;
      const m = map.get(k) || { nombre: c.cliente_nombre, tel: c.cliente_tel, hechas: 0, gastado: 0, ultima: null, proxima: null, noVino: 0, total: 0 };
      m.total++;
      if (c.estado === "completada") { m.hechas++; m.gastado += Number(c.precio); if (!m.ultima || c.fecha > m.ultima) m.ultima = c.fecha; }
      if (c.estado === "no_vino") m.noVino++;
      if (c.estado === "confirmada" && c.fecha >= hoy && (!m.proxima || c.fecha < m.proxima)) m.proxima = c.fecha;
      map.set(k, m);
    });
    const list = [...map.values()].filter((m) => !qCli || (m.nombre + " " + m.tel).toLowerCase().includes(qCli.toLowerCase())).sort((a, b) => b.hechas - a.hechas || a.nombre.localeCompare(b.nombre));
    $("#main").innerHTML = `
      <div class="head"><div><span class="label">Clientes</span><h2>${map.size} clientes</h2></div>
        <div class="tools"><input id="qCli" placeholder="Buscar por nombre o teléfono" value="${esc(qCli)}" autocomplete="off"></div></div>
      ${list.length ? `<div class="tbl"><table><thead><tr><th>Cliente</th><th>Teléfono</th><th>Visitas</th><th>Gastado</th><th>Última visita</th><th>Próxima cita</th><th></th></tr></thead><tbody>
      ${list.map((m) => `<tr><td><b>${esc(m.nombre)}</b>${m.noVino ? ` <span class="chip no_vino">${m.noVino} sin venir</span>` : ""}</td><td class="num">${esc(m.tel)}</td><td class="num">${m.hechas}</td><td class="num">${euros(m.gastado)}</td><td>${m.ultima ? fmtShort(m.ultima) : "—"}</td><td>${m.proxima ? fmtShort(m.proxima) : "—"}</td><td>${m.tel ? `<a class="btn wa small" target="_blank" rel="noopener" href="${waLink(m.tel, `Hola ${m.nombre.split(" ")[0]}, `)}">WhatsApp</a>` : ""}</td></tr>`).join("")}
      </tbody></table></div>` : `<div class="empty">${map.size ? "Ningún cliente coincide con la búsqueda." : "Aquí aparecerán tus clientes según vayan reservando."}</div>`}`;
    const q = $("#qCli"); q.addEventListener("input", () => { qCli = q.value; clearTimeout(q._t); q._t = setTimeout(() => R.clientes().then(() => { const n = $("#qCli"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }), 250); });
  };

  // ---------- SERVICIOS ----------
  R.servicios = async () => {
    await reloadNegocio();
    const row = (s) => `<tr data-svc-row="${s.id}" class="${s.activo ? "" : "off"}">
      <td><input data-f="nombre" value="${esc(s.nombre)}"></td>
      <td><input data-f="cat" value="${esc(s.cat)}" list="cats" style="width:110px"></td>
      <td><input data-f="descr" value="${esc(s.descr)}"></td>
      <td><input data-f="min" type="number" min="5" max="480" step="5" value="${s.min}" style="width:80px"></td>
      <td><input data-f="precio" type="number" min="0" step="0.5" value="${s.precio}" style="width:90px"></td>
      <td><input data-f="top" type="checkbox" ${s.top ? "checked" : ""} title="Destacado"></td>
      <td><input data-f="activo" type="checkbox" ${s.activo ? "checked" : ""} title="Visible en la app"></td>
      <td><button class="btn small" data-save-svc="${s.id}">Guardar</button></td></tr>`;
    $("#main").innerHTML = `
      <div class="head"><div><span class="label">Servicios y precios</span><h2>Tu carta</h2></div><div class="tools"><button class="btn small" id="addSvc">+ Añadir servicio</button></div></div>
      <p class="sub">Los cambios se ven al momento en la app de clientes. Desmarca «Visible» para ocultar un servicio sin borrarlo.</p>
      <datalist id="cats">${[...new Set(N.servicios.map((s) => s.cat))].map((c) => `<option value="${esc(c)}">`).join("")}</datalist>
      <div class="tbl"><table><thead><tr><th>Nombre</th><th>Categoría</th><th>Descripción</th><th>Minutos</th><th>Precio €</th><th>Top</th><th>Visible</th><th></th></tr></thead>
      <tbody>${N.servicios.map(row).join("")}</tbody></table></div>`;
  };
  function readRow(tr) {
    const o = {};
    $$("[data-f]", tr).forEach((i) => { o[i.dataset.f] = i.type === "checkbox" ? i.checked : i.type === "number" ? Number(i.value) : i.value.trim(); });
    return o;
  }

  // ---------- EQUIPO Y HORARIO ----------
  R.equipo = async () => {
    await reloadNegocio();
    const tramoInputs = (d, i) => { const t = (N.horario[d] || [])[i] || ["", ""]; return `<div class="tramo"><input type="time" data-h="${d}-${i}-0" value="${t[0]}" aria-label="Abre"><span class="sub">a</span><input type="time" data-h="${d}-${i}-1" value="${t[1]}" aria-label="Cierra"></div>`; };
    $("#main").innerHTML = `
      <div class="head"><div><span class="label">Equipo y horario</span><h2>Quién corta y cuándo</h2></div></div>
      <div class="two">
        <div class="card"><h3>Equipo</h3>
          <div class="tbl" style="border:0"><table style="min-width:520px"><thead><tr><th>Color</th><th>Nombre</th><th>Especialidad</th><th>Activo</th><th></th></tr></thead><tbody>
          ${N.equipo.map((p) => `<tr data-pro-row="${p.id}" class="${p.activo ? "" : "off"}"><td><input data-f="color" type="color" value="${esc(p.color)}" style="width:48px"></td><td><input data-f="nombre" value="${esc(p.nombre)}"></td><td><input data-f="rol" value="${esc(p.rol)}"></td><td><input data-f="activo" type="checkbox" ${p.activo ? "checked" : ""}></td><td><button class="btn small" data-save-pro="${p.id}">Guardar</button></td></tr>`).join("")}
          </tbody></table></div>
          <button class="btn ghost small" id="addPro" style="justify-self:start">+ Añadir profesional</button>
        </div>
        <div class="card"><h3>Horario de apertura</h3>
          <p class="sub">Deja vacío el segundo tramo si no cierras a mediodía.</p>
          <div>${[1, 2, 3, 4, 5, 6, 0].map((d) => `<div class="hrow"><b>${DOW_L[d]}</b><label class="sub" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-abre="${d}" ${N.horario[d] ? "checked" : ""}>Abre</label>${tramoInputs(d, 0)}${tramoInputs(d, 1)}</div>`).join("")}</div>
          <div class="form-grid">
            <label class="field"><span>Huecos cada (min)</span><select id="hInt">${[15, 20, 30, 45, 60].map((m) => `<option ${m === A().intervalo_min ? "selected" : ""}>${m}</option>`).join("")}</select></label>
            <label class="field"><span>Se puede reservar con (días)</span><input id="hDias" type="number" min="1" max="90" value="${A().dias_reserva}"></label>
          </div>
          <button class="btn" id="saveHorario" style="justify-self:start">Guardar horario</button>
        </div>
      </div>
      <div class="card"><h3>Bloquear días (vacaciones, festivos…)</h3>
        <p class="sub">Bloquea todos los huecos de un profesional entre dos fechas. Las citas que ya existan no se tocan.</p>
        <div class="form-grid">
          <label class="field"><span>Profesional</span><select id="vPro"><option value="">Todos</option>${N.equipo.filter((p) => p.activo).map((p) => `<option value="${p.id}">${esc(p.nombre)}</option>`).join("")}</select></label>
          <label class="field"><span>Desde</span><input id="vDesde" type="date" value="${todayKey()}"></label>
          <label class="field"><span>Hasta</span><input id="vHasta" type="date" value="${todayKey()}"></label>
        </div>
        <div class="row" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn small" id="vBlock">Bloquear esos días</button><button class="btn ghost small" id="vUnblock">Desbloquear esos días</button></div>
      </div>`;
  };
  async function saveHorario() {
    const rows = [];
    for (let d = 0; d < 7; d++) {
      const open = $(`[data-abre="${d}"]`).checked, tramos = [];
      if (open) for (let i = 0; i < 2; i++) {
        const a = $(`[data-h="${d}-${i}-0"]`).value, b = $(`[data-h="${d}-${i}-1"]`).value;
        if (a && b) { if (a >= b) return toast(`${DOW_L[d]}: la hora de cierre debe ser posterior a la de apertura.`); tramos.push([a, b]); }
      }
      if (open && !tramos.length) return toast(`${DOW_L[d]}: pon al menos un horario o desmarca «Abre».`);
      rows.push({ dia: d, tramos });
    }
    const [h, a] = await Promise.all([
      SB.from("horario").upsert(rows),
      SB.from("ajustes").update({ intervalo_min: Number($("#hInt").value), dias_reserva: Math.max(1, Math.min(90, Number($("#hDias").value) || 21)) }).eq("id", 1),
    ]);
    if (h.error || a.error) return fail(h.error || a.error);
    toast("Horario guardado"); refresh();
  }
  async function bulkBlock(add) {
    const desde = $("#vDesde").value, hasta = $("#vHasta").value, pro = $("#vPro").value;
    if (!desde || !hasta || hasta < desde) return toast("Revisa las fechas.");
    const pros = pro ? [pro] : N.equipo.filter((p) => p.activo).map((p) => p.id);
    if (!add) {
      let q = SB.from("bloqueos").delete().gte("fecha", desde).lte("fecha", hasta);
      if (pro) q = q.eq("profesional_id", pro);
      const { error } = await q; if (error) return fail(error);
      return toast("Días desbloqueados");
    }
    const rows = [];
    for (let d = fromKey(desde); dKey(d) <= hasta; d = addDays(d, 1)) {
      (N.horario[d.getDay()] || []).forEach(([a, b]) => { for (let t = toMin(a); t < toMin(b); t += A().intervalo_min) pros.forEach((p) => rows.push({ fecha: dKey(d), hora: fromMin(t), profesional_id: p })); });
      if (rows.length > 5000) break;
    }
    if (!rows.length) return toast("Esos días ya están cerrados.");
    const { error } = await SB.from("bloqueos").upsert(rows, { onConflict: "fecha,hora,profesional_id", ignoreDuplicates: true });
    if (error) return fail(error);
    toast(`Bloqueados ${rows.length} huecos`);
  }

  // ---------- TRABAJOS ----------
  R.trabajos = async () => {
    await reloadNegocio();
    const estilos = [...new Set(["Fade", "Clásico", "Barba", "Color", ...N.trabajos.map((w) => w.estilo)])];
    const svcOpts = (sel) => `<option value="">Sin servicio</option>` + N.servicios.filter((s) => s.activo).map((s) => `<option value="${s.id}" ${s.id === sel ? "selected" : ""}>${esc(s.nombre)}</option>`).join("");
    const thumb = (w) => w.url ? (w.tipo === "video" ? `<video src="${esc(w.url)}" muted loop playsinline preload="metadata"></video>` : `<img src="${esc(w.url)}" alt="" loading="lazy">`) : "Sin foto todavía<br>(imagen de ejemplo en la app)";
    $("#main").innerHTML = `
      <div class="head"><div><span class="label">Trabajos</span><h2>Fotos y vídeos de tus cortes</h2></div></div>
      <div class="card">
        <h3>Subir un trabajo nuevo</h3>
        <p class="sub">Desde el móvil puedes elegir directamente las fotos o vídeos que has subido a Instagram (máx. 50 MB). Aparecen al momento en la app.</p>
        <div class="drop">
          <input type="file" id="upFile" accept="image/*,video/mp4,video/quicktime,video/webm">
          <div class="form-grid">
            <label class="field"><span>Título</span><input id="upTitulo" placeholder="Ej.: Skin fade con diseño" autocomplete="off"></label>
            <label class="field"><span>Estilo</span><input id="upEstilo" list="estilos" value="Fade" autocomplete="off"></label>
            <label class="field"><span>Servicio para «Quiero este corte»</span><select id="upSvc">${svcOpts("")}</select></label>
          </div>
          <button class="btn" id="upBtn" style="justify-self:start">Subir trabajo</button>
        </div>
        <datalist id="estilos">${estilos.map((e) => `<option value="${esc(e)}">`).join("")}</datalist>
      </div>
      <div class="gal">${N.trabajos.map((w) => `<div class="wk" data-wk="${w.id}">
        <div class="thumb">${thumb(w)}</div>
        <div class="body">
          <input data-f="titulo" value="${esc(w.titulo)}" aria-label="Título">
          <input data-f="estilo" value="${esc(w.estilo)}" list="estilos" aria-label="Estilo">
          <select data-f="servicio_id" aria-label="Servicio">${svcOpts(w.servicio_id)}</select>
          <label class="btn ghost small" style="cursor:pointer">${w.url ? "Cambiar foto" : "Poner foto"}<input type="file" data-replace="${w.id}" accept="image/*,video/mp4,video/quicktime,video/webm" hidden></label>
          <div style="display:flex;gap:6px"><button class="btn small" data-save-wk="${w.id}" style="flex:1">Guardar</button><button class="btn danger small" data-del-wk="${w.id}">Borrar</button></div>
        </div></div>`).join("")}</div>`;
  };
  async function uploadFile(file) {
    if (file.size > 50 * 1024 * 1024) throw new Error("El archivo pesa más de 50 MB.");
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await SB.storage.from("trabajos").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
    if (error) throw error;
    return { url: SB.storage.from("trabajos").getPublicUrl(path).data.publicUrl, tipo: file.type.startsWith("video") ? "video" : "foto" };
  }
  function storagePath(url) { const m = /\/object\/public\/trabajos\/(.+)$/.exec(url || ""); return m ? decodeURIComponent(m[1]) : null; }

  // ---------- AJUSTES ----------
  R.ajustes = async () => {
    await reloadNegocio();
    const a = A();
    const f = (id, label, val, type = "text", extra = "") => `<label class="field"><span>${label}</span><input id="aj_${id}" type="${type}" value="${esc(val)}" ${extra} autocomplete="off"></label>`;
    $("#main").innerHTML = `
      <div class="head"><div><span class="label">Datos del negocio</span><h2>Lo que ven tus clientes</h2></div></div>
      <div class="card"><div class="form-grid">
        ${f("nombre", "Nombre de la peluquería", a.nombre)}
        ${f("lema", "Frase de portada", a.lema)}
        ${f("ciudad", "Ciudad", a.ciudad)}
        ${f("direccion", "Dirección", a.direccion)}
        ${f("instagram", "Instagram (sin @)", a.instagram)}
        ${f("whatsapp", "WhatsApp donde recibes avisos", a.whatsapp, "tel")}
        ${f("valoracion", "Valoración (Google)", a.valoracion, "number", 'step="0.1" min="0" max="5"')}
        ${f("num_resenas", "Número de reseñas", a.num_resenas, "number", 'min="0"')}
        ${f("sellos", "Cortes para el premio", a.sellos, "number", 'min="1" max="12"')}
        ${f("premio", "Premio de fidelidad", a.premio)}
      </div>
      <button class="btn" id="saveAjustes" style="justify-self:start">Guardar datos</button></div>
      <div class="card"><h3>Portada de la app</h3>
        <p class="sub">Una foto o un vídeo corto del local o de un corte. Se ve arriba del todo en la app.</p>
        ${a.portada_url ? `<div class="wk" style="max-width:220px"><div class="thumb">${/\.(mp4|webm|mov)(\?|$)/i.test(a.portada_url) ? `<video src="${esc(a.portada_url)}" muted autoplay loop playsinline></video>` : `<img src="${esc(a.portada_url)}" alt="">`}</div></div>` : ""}
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><input type="file" id="portadaFile" accept="image/*,video/mp4,video/quicktime,video/webm" style="max-width:320px"><button class="btn small" id="portadaBtn">Subir portada</button>${a.portada_url ? '<button class="btn ghost small" id="portadaDel">Quitar portada</button>' : ""}</div>
      </div>
      <div class="card"><h3>Enlace para tus clientes</h3>
        <p class="sub">Ponlo en la bio de Instagram y en tu WhatsApp Business. Desde el móvil, «Añadir a pantalla de inicio» la deja como una app.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><input readonly id="appLink" value="${esc(new URL("./", location.href).href)}" style="max-width:420px"><button class="btn ghost small" id="copyLink">Copiar enlace</button></div>
      </div>`;
  };

  // ---------- Eventos ----------
  document.addEventListener("click", async (e) => {
    const t = e.target.closest("button, a, [data-cita]");
    if (!t) { if (e.target.id === "modalBg") closeModal(); return; }
    const d = t.dataset;
    if (d.nav) return go(d.nav);
    if (d.close !== undefined) return closeModal();
    // Agenda
    if (d.day !== undefined) { day = d.day === "0" ? todayKey() : dKey(addDays(fromKey(day), +d.day)); return refresh(); }
    if (d.new !== undefined) { const [p, h] = d.new.split("|"); return newCitaModal(p || null, h || null); }
    if (t.id === "nSave") return saveNewCita();
    if (d.block) { const [p, h] = d.block.split("|"); const { error } = await SB.from("bloqueos").insert({ fecha: day, hora: h, profesional_id: p }); if (error) return fail(error); toast("Hueco bloqueado"); return refresh(); }
    if (d.unblock) { const { error } = await SB.from("bloqueos").delete().eq("id", d.unblock); if (error) return fail(error); toast("Hueco liberado"); return refresh(); }
    if (d.cita || d.open) {
      const id = d.cita || d.open;
      const { data, error } = await SB.from("citas").select("*").eq("id", id).single();
      if (error) return fail(error);
      return citaModal({ ...data, hora: data.hora.slice(0, 5) });
    }
    if (d.estado) {
      const { error } = await SB.from("citas").update({ estado: d.estado }).eq("id", d.id);
      if (error) return fail(error);
      closeModal(); toast(`Cita marcada como «${ESTADOS[d.estado]}»`); return refresh();
    }
    if (d.savenotas) { const { error } = await SB.from("citas").update({ notas: $("#cNotas").value.trim() }).eq("id", d.savenotas); if (error) return fail(error); return toast("Notas guardadas"); }
    // Servicios
    if (t.id === "addSvc") {
      const { error } = await SB.from("servicios").insert({ nombre: "Nuevo servicio", cat: "Corte", min: 30, precio: 15, orden: N.servicios.length + 1 });
      if (error) return fail(error); toast("Servicio añadido: cámbiale el nombre y el precio"); return refresh();
    }
    if (d.saveSvc) {
      const o = readRow(t.closest("tr"));
      if (!o.nombre) return toast("El servicio necesita un nombre.");
      if (!(o.min >= 5 && o.min <= 480)) return toast("La duración debe estar entre 5 y 480 minutos.");
      if (!(o.precio >= 0)) return toast("Revisa el precio.");
      const { error } = await SB.from("servicios").update(o).eq("id", d.saveSvc);
      if (error) return fail(error); toast("Servicio guardado"); return refresh();
    }
    // Equipo y horario
    if (t.id === "addPro") { const { error } = await SB.from("equipo").insert({ nombre: "Nuevo", rol: "", orden: N.equipo.length + 1, color: "#b9a3d6" }); if (error) return fail(error); toast("Profesional añadido"); return refresh(); }
    if (d.savePro) { const o = readRow(t.closest("tr")); if (!o.nombre) return toast("Pon un nombre."); const { error } = await SB.from("equipo").update(o).eq("id", d.savePro); if (error) return fail(error); toast("Guardado"); return refresh(); }
    if (t.id === "saveHorario") return saveHorario();
    if (t.id === "vBlock") return bulkBlock(true);
    if (t.id === "vUnblock") return bulkBlock(false);
    // Trabajos
    if (t.id === "upBtn") {
      const file = $("#upFile").files[0];
      if (!file) return toast("Elige primero una foto o un vídeo.");
      t.disabled = true; t.textContent = "Subiendo…";
      try {
        const up = await uploadFile(file);
        const { error } = await SB.from("trabajos").insert({ titulo: $("#upTitulo").value.trim() || "Nuevo trabajo", estilo: $("#upEstilo").value.trim() || "Fade", servicio_id: $("#upSvc").value || null, url: up.url, tipo: up.tipo, orden: 0 });
        if (error) throw error;
        toast("Trabajo subido"); refresh();
      } catch (err) { t.disabled = false; t.textContent = "Subir trabajo"; fail(err); }
      return;
    }
    if (d.saveWk) {
      const box = t.closest("[data-wk]"), o = {};
      $$("[data-f]", box).forEach((i) => { o[i.dataset.f] = i.value.trim() || null; });
      if (!o.titulo) return toast("Pon un título.");
      o.estilo = o.estilo || "Fade";
      const { error } = await SB.from("trabajos").update(o).eq("id", d.saveWk);
      if (error) return fail(error); return toast("Guardado");
    }
    if (d.delWk) {
      const w = N.trabajos.find((x) => x.id === d.delWk);
      return modal(`<h2>¿Borrar «${esc(w.titulo)}»?</h2><p class="sub">Desaparece de la app de clientes. No se puede deshacer.</p><div class="row"><button class="btn danger" data-del-wk-ok="${w.id}">Sí, borrar</button><button class="btn ghost" data-close>Cancelar</button></div>`);
    }
    if (d.delWkOk) {
      const w = N.trabajos.find((x) => x.id === d.delWkOk);
      const { error } = await SB.from("trabajos").delete().eq("id", w.id);
      if (error) return fail(error);
      const p = storagePath(w.url); if (p) await SB.storage.from("trabajos").remove([p]);
      closeModal(); toast("Trabajo borrado"); return refresh();
    }
    // Ajustes
    if (t.id === "saveAjustes") {
      const o = {};
      ["nombre", "lema", "ciudad", "direccion", "instagram", "whatsapp", "premio"].forEach((k) => { o[k] = $("#aj_" + k).value.trim(); });
      o.instagram = o.instagram.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/.*$/, "");
      ["valoracion", "num_resenas", "sellos"].forEach((k) => { o[k] = Number($("#aj_" + k).value); });
      if (!o.nombre) return toast("El nombre no puede estar vacío.");
      if (o.whatsapp.replace(/\D/g, "").length < 9) return toast("Revisa el número de WhatsApp.");
      const { error } = await SB.from("ajustes").update(o).eq("id", 1);
      if (error) return fail(error); toast("Datos guardados"); return refresh();
    }
    if (t.id === "portadaBtn") {
      const file = $("#portadaFile").files[0]; if (!file) return toast("Elige una foto o un vídeo.");
      t.disabled = true; t.textContent = "Subiendo…";
      try { const up = await uploadFile(file); const { error } = await SB.from("ajustes").update({ portada_url: up.url }).eq("id", 1); if (error) throw error; toast("Portada actualizada"); refresh(); }
      catch (err) { t.disabled = false; t.textContent = "Subir portada"; fail(err); }
      return;
    }
    if (t.id === "portadaDel") { const { error } = await SB.from("ajustes").update({ portada_url: "" }).eq("id", 1); if (error) return fail(error); toast("Portada quitada"); return refresh(); }
    if (t.id === "copyLink") { try { await navigator.clipboard.writeText($("#appLink").value); toast("Enlace copiado"); } catch (err) { $("#appLink").select(); } }
  });
  document.addEventListener("change", async (e) => {
    if (e.target.id === "dayPick" && e.target.value) { day = e.target.value; return refresh(); }
    if (e.target.dataset.replace) {
      const file = e.target.files[0]; if (!file) return;
      const w = N.trabajos.find((x) => x.id === e.target.dataset.replace);
      toast("Subiendo…");
      try {
        const up = await uploadFile(file);
        const { error } = await SB.from("trabajos").update({ url: up.url, tipo: up.tipo }).eq("id", w.id);
        if (error) throw error;
        const p = storagePath(w.url); if (p) await SB.storage.from("trabajos").remove([p]);
        toast("Foto cambiada"); refresh();
      } catch (err) { fail(err); }
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
    if (e.key === "Enter" && e.target.closest("[data-cita]")) e.target.click();
  });
  // Al volver a la pestaña, refresca
  document.addEventListener("visibilitychange", () => { if (!document.hidden && N) refresh(); });

  boot();
})();
