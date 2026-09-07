const DATA_URL = "data/events.json";
const MANUAL_URL = "api/events.php";
const OVERRIDES_URL = "api/overrides.php";
const REFRESCO_DATOS_MS = 15 * 60 * 1000;
const RECARGA_PAGINA_MS = 3 * 60 * 60 * 1000;
const DIAS_VISIBLES = 5; // el día 0 (hoy) es siempre el primero de la ventana
const MAX_PROXIMAS = 6;
const UMBRAL_AGENDA = 4; // nº de eventos con hora hoy a partir del cual se activa el modo agenda
const BLACKOUT_INICIO_MIN = 20 * 60 + 30; // 20:30, de lunes a viernes
const BLACKOUT_FIN_MIN = 7 * 60 + 30;     // 07:30, de lunes a viernes

const DIA = 86400000;
const DOW = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];
const DOW_LARGO = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MESES_C = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

const CATS = {
  fest:   { label: "Festivo",           color: "var(--fest)",   tint: "var(--fest-tint)" },
  vac:    { label: "Vacaciones",        color: "var(--vac)",    tint: "var(--vac-tint)" },
  eval:   { label: "Evaluación",        color: "var(--eval)",   tint: "var(--eval-tint)" },
  feoe:   { label: "FEOE / Estancias",  color: "var(--feoe)",   tint: "var(--feoe-tint)" },
  eras:   { label: "Erasmus / Redes",   color: "var(--eras)",   tint: "var(--eras-tint)" },
  centro: { label: "Actividad centro",  color: "var(--centro)", tint: "var(--centro-tint)" },
};

let datos = null;

/* ---------- fechas ---------- */

const parseISO = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const wd = (k) => (parseISO(k).getDay() + 6) % 7;
const diffKey = (a, b) => Math.round((parseISO(b) - parseISO(a)) / DIA);

const FECHA_SIMULADA = new URLSearchParams(location.search).get("fecha");
const hoyDate = () => {
  if (FECHA_SIMULADA && /^\d{4}-\d{2}-\d{2}$/.test(FECHA_SIMULADA)) return parseISO(FECHA_SIMULADA);
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
};

/* ---------- categorización ---------- */

function categoriaDe(e) {
  if (e.kind === "manual") return "centro";
  const t = e.title.toUpperCase();
  if (/FEOE|ESTANCIA|\bFCT\b|PR[ÁA]CTICAS/.test(t)) return "feoe";
  if (/ERASMUS|ERAMUS|JORDANAS|K1\d\dVET|K1\d\dHED|NETWORKING/.test(t)) return "eras";
  if (/EVALUAC|EX[ÁA]MEN|ENTREGA DE NOTAS|RECUPERAC|P[ÉE]RDIDAS/.test(t)) return "eval";
  return "centro";
}

function corto(t) {
  return t
    .replace(/\s*2º\s*DE\s*CFGM\s*Y\s*CFGS/i, " 2º CFGM/CFGS")
    .replace(/\s*1º\s*DE\s*CFGM\s*Y\s*CFGS/i, " 1º CFGM/CFGS")
    .replace(/2º\s*CFGM\s*Y\s*CFGS/i, "2º CFGM/CFGS");
}

/* Aplana festivos + vacaciones + eventos (ya fusionados con manuales/overrides) en una sola lista {s,e,cat,t}. */
function eventosPlanos() {
  const out = [];
  Object.entries(datos.festivos || {}).forEach(([fecha, nombre]) => {
    out.push({ s: fecha, e: fecha, cat: "fest", t: nombre, titulo: nombre, time: null });
  });
  (datos.vacaciones || []).forEach((v) => {
    const titulo = `Vacaciones de ${v.title}`;
    out.push({ s: v.start, e: v.end, cat: "vac", t: titulo, titulo, time: null });
  });
  datos.events.forEach((e) => {
    out.push({
      s: e.start, e: e.end, cat: categoriaDe(e), time: e.time || null,
      endTime: e.endTime || null, location: e.location || null, audience: e.audience || null,
      t: e.time ? `${e.time} · ${corto(e.title)}` : corto(e.title),
      titulo: corto(e.title),
    });
  });
  return out;
}

const activosEn = (planos, k) => planos.filter((e) => e.s <= k && k <= e.e);

/* ---------- render ---------- */

const $ = (id) => document.getElementById(id);

function actualizarCabecera(hoy, now) {
  $("clock").textContent = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  $("todayLabel").textContent =
    `${DOW_LARGO[wd(iso(hoy))]}, ${hoy.getDate()} de ${MESES[hoy.getMonth()]} de ${hoy.getFullYear()}`.toUpperCase();
  const [ini, fin] = (datos.curso || "").split("-");
  if (ini && fin) $("curso").textContent = `CURSO ${ini} · ${fin}`;
}

function chipEl(ev) {
  const li = document.createElement("li");
  const cat = CATS[ev.cat] || CATS.centro;
  li.style.background = cat.tint;
  li.style.borderLeft = `7px solid ${cat.color}`;
  const titulo = document.createElement("div");
  titulo.className = "chip-title";
  titulo.textContent = ev.t;
  li.appendChild(titulo);
  const catEl = document.createElement("div");
  catEl.className = "chip-cat";
  catEl.style.color = cat.color;
  catEl.textContent = cat.label;
  li.appendChild(catEl);
  return li;
}

function vacioEl(texto) {
  const li = document.createElement("li");
  li.className = "vacio";
  li.textContent = texto;
  return li;
}

function actualizarHoy(planos, hoy) {
  const k = iso(hoy);
  const activos = activosEn(planos, k);
  const vac = activos.find((e) => e.cat === "vac");
  const fest = activos.find((e) => e.cat === "fest");
  const esFinde = hoy.getDay() === 0 || hoy.getDay() === 6;

  let label = "Día de clase", color = "#C9D8E8", nota = "";
  if (vac) { label = "Vacaciones"; color = CATS.vac.color; nota = vac.t; }
  else if (fest) { label = "Día festivo"; color = CATS.fest.color; nota = fest.t; }
  else if (esFinde) { label = "Fin de semana"; color = "#8FA6C0"; nota = "El centro permanece cerrado."; }

  const estadoLabel = $("estadoLabel");
  estadoLabel.textContent = label;
  estadoLabel.style.color = color;

  const notaEl = $("estadoNota");
  if (nota) { notaEl.hidden = false; notaEl.textContent = nota; }
  else notaEl.hidden = true;

  const cortos = activos.filter((e) => diffKey(e.s, e.e) < 8);
  const lista = $("hoyList");
  lista.innerHTML = "";
  if (!cortos.length) lista.appendChild(vacioEl("Sin actividades programadas."));
  else cortos.forEach((ev) => lista.appendChild(chipEl(ev)));
}

function actualizarProximo(planos, hoy) {
  const k = iso(hoy);
  const prox = planos
    .filter((e) => e.s > k && diffKey(e.s, e.e) <= 5)
    .sort((a, b) => a.s.localeCompare(b.s))[0];

  if (!prox) {
    $("proxCuenta").textContent = "—";
    $("proxTexto").textContent = "Sin eventos próximos en el calendario";
    $("proxFecha").textContent = "";
    return prox;
  }
  const n = diffKey(k, prox.s);
  const d = parseISO(prox.s);
  $("proxCuenta").textContent = n === 1 ? "MAÑANA" : `EN ${n} DÍAS`;
  $("proxTexto").textContent = prox.t;
  let fecha = `${DOW_LARGO[wd(prox.s)]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
  if (diffKey(prox.s, prox.e)) {
    const df = parseISO(prox.e);
    fecha += ` – ${df.getDate()} de ${MESES[df.getMonth()]}`;
  }
  $("proxFecha").textContent = fecha;
  return prox;
}

const ROTACION_DIA_MS = 4500;
let diaCarrusel = {}; // { [isoKey]: { events, idx, el } }

/* Pinta un único evento del día (texto completo, sin recortar) + puntos si hay más de uno. */
function renderDiaEventos(dk) {
  const estado = diaCarrusel[dk];
  if (!estado) return;
  const { events, idx, el } = estado;
  el.innerHTML = "";
  if (!events.length) return;

  const ev = events[idx];
  const cat = CATS[ev.cat] || CATS.centro;
  const chip = document.createElement("div");
  chip.className = "ev";
  chip.style.borderLeftColor = cat.color;
  chip.style.background = cat.tint;
  chip.textContent = ev.t;
  el.appendChild(chip);

  if (events.length > 1) {
    const dots = document.createElement("div");
    dots.className = "day-dots";
    events.forEach((_, i) => {
      const dot = document.createElement("span");
      dot.className = i === idx ? "on" : "";
      dots.appendChild(dot);
    });
    el.appendChild(dots);
  }
}

function rotarDias() {
  if (blackoutActivo) return; // en negro no hay nada que actualizar
  Object.keys(diaCarrusel).forEach((dk) => {
    const estado = diaCarrusel[dk];
    if (estado.events.length > 1) {
      estado.idx = (estado.idx + 1) % estado.events.length;
      renderDiaEventos(dk);
    }
  });
}

function actualizarSemana(planos, hoy) {
  diaCarrusel = {};
  const finRango = addDays(hoy, DIAS_VISIBLES - 1);
  const finKey = iso(finRango);
  $("semanaRango").textContent =
    `${hoy.getDate()} ${MESES_C[hoy.getMonth()]} – ${finRango.getDate()} ${MESES_C[finRango.getMonth()]} ${finRango.getFullYear()}`;

  const cont = $("weekGrid");
  cont.innerHTML = "";
  let totalEventos = 0;

  for (let i = 0; i < DIAS_VISIBLES; i++) {
    const dia = addDays(hoy, i);
    const dk = iso(dia);
    const activos = activosEn(planos, dk);
    totalEventos += activos.length;

    const celda = document.createElement("div");
    celda.className = "day";
    if (i === 0) celda.classList.add("hoy");
    if (dia.getDay() === 0 || dia.getDay() === 6) celda.classList.add("finde");
    if (activos.some((e) => e.cat === "vac")) celda.classList.add("tiene-vac");
    else if (activos.some((e) => e.cat === "fest")) celda.classList.add("tiene-fest");

    const cab = document.createElement("div");
    cab.className = "cab";
    cab.innerHTML = `<div class="dow">${DOW[wd(dk)]}</div><div class="num">${dia.getDate()}</div>`;
    celda.appendChild(cab);

    const evs = document.createElement("div");
    evs.className = "evs";
    celda.appendChild(evs);
    cont.appendChild(celda);

    diaCarrusel[dk] = { events: activos, idx: 0, el: evs };
    renderDiaEventos(dk);
  }

  const notaEl = $("semanaNota");
  if (totalEventos === 0) {
    const prox = planos.filter((e) => e.s > finKey).sort((a, b) => a.s.localeCompare(b.s))[0];
    notaEl.hidden = false;
    notaEl.textContent = prox
      ? `Periodo sin actividades programadas. Lo siguiente: ${prox.t} (${DOW[wd(prox.s)]} ${parseISO(prox.s).getDate()} ${MESES_C[parseISO(prox.s).getMonth()]}).`
      : "Periodo sin actividades programadas.";
  } else {
    notaEl.hidden = true;
  }
  return finKey;
}

function actualizarProximas(planos, finKey) {
  const proximas = planos
    .filter((e) => e.s > finKey)
    .sort((a, b) => a.s.localeCompare(b.s))
    .slice(0, MAX_PROXIMAS);

  const lista = $("upcomingList");
  lista.innerHTML = "";
  if (!proximas.length) { lista.appendChild(vacioEl("Sin eventos más adelante.")); return; }

  proximas.forEach((e) => {
    const cat = CATS[e.cat] || CATS.centro;
    const d = parseISO(e.s);
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="fecha" style="color:${cat.color}">${DOW[wd(e.s)]} ${d.getDate()} ${MESES_C[d.getMonth()]}</div>
      <div class="titulo">${e.t}</div>`;
    lista.appendChild(li);
  });
}

function actualizarLeyenda() {
  const cont = $("leyenda");
  if (cont.children.length) return; // estática, una sola vez
  Object.values(CATS).forEach((cat) => {
    const div = document.createElement("div");
    div.className = "leyenda-item";
    div.innerHTML = `<div class="swatch" style="background:${cat.color}"></div><span>${cat.label}</span>`;
    cont.appendChild(div);
  });
}

function actualizarPie(now) {
  $("notaPie").textContent =
    `Calendario escolar oficial del centro · última comprobación ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

/* ---------- modo agenda (días con muchos eventos con hora) ---------- */

const minutosDe = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
let modoAgendaActivo = false;

/* Cuenta los eventos de hoy con hora definida; ese número decide si se activa el modo agenda. */
function eventosHoyConHora(planos, hoy) {
  const k = iso(hoy);
  return activosEn(planos, k).filter((e) => e.time);
}

function actualizarAgenda(planos, hoy, now) {
  const k = iso(hoy);
  const activos = activosEn(planos, k);
  const conHora = activos.filter((e) => e.time).sort((a, b) => a.time.localeCompare(b.time));
  const sinHora = activos.filter((e) => !e.time);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const lista = $("agendaList");
  lista.innerHTML = "";

  const fila = (e, horaTexto, estado) => {
    const cats = CATS[e.cat] || CATS.centro;
    const detalle = [e.location, e.audience].filter(Boolean).join(" · ");
    const li = document.createElement("li");
    li.className = `agenda-item ${estado}`;
    li.style.borderLeftColor = cats.color;
    li.innerHTML = `
      <div class="agenda-hora" style="color:${cats.color}">${horaTexto}</div>
      <div class="agenda-cuerpo">
        <div class="agenda-titulo">${e.titulo}</div>
        ${detalle ? `<div class="agenda-detalle">${detalle}</div>` : ""}
      </div>`;
    lista.appendChild(li);
  };

  sinHora.forEach((e) => fila(e, "TODO EL DÍA", "pendiente"));
  conHora.forEach((e) => {
    const min = minutosDe(e.time);
    const finMin = e.endTime ? minutosDe(e.endTime) : min + 45;
    const estado = finMin < nowMin ? "pasado" : min <= nowMin ? "actual" : "pendiente";
    const horaTexto = e.endTime ? `${e.time}–${e.endTime}` : e.time;
    fila(e, horaTexto, estado);
  });

  if (!activos.length) lista.appendChild(vacioEl("Sin eventos programados para hoy."));
}

function renderTodo() {
  const hoy = hoyDate();
  const now = new Date();
  const planos = eventosPlanos();

  actualizarCabecera(hoy, now);
  actualizarHoy(planos, hoy);
  actualizarProximo(planos, hoy);
  const finKey = actualizarSemana(planos, hoy);
  actualizarProximas(planos, finKey);
  actualizarLeyenda();
  actualizarPie(now);

  // Día con agenda apretada: el panel HOY sustituye sus chips por la agenda horaria
  // completa (conviviendo con el resto del layout: Próximo evento, Próximos 5 días,
  // Próximas semanas siguen visibles).
  modoAgendaActivo = eventosHoyConHora(planos, hoy).length >= UMBRAL_AGENDA;
  $("hoyTitulo").textContent = modoAgendaActivo ? "AGENDA DE HOY" : "HOY";
  $("hoyList").hidden = modoAgendaActivo;
  $("agendaList").hidden = !modoAgendaActivo;
  if (modoAgendaActivo) {
    $("estadoNota").hidden = true;
    actualizarAgenda(planos, hoy, now);
  }
}

/* ---------- escala del escenario 1920x1080 ---------- */

function ajustarEscala() {
  const stage = $("stage");
  const vw = window.innerWidth, vh = window.innerHeight;
  const s = Math.min(vw / 1920, vh / 1080);
  stage.style.transform = `scale(${s})`;
}

/* ---------- carga y fusión de datos ---------- */

async function cargarManuales() {
  try {
    const res = await fetch(`${MANUAL_URL}?v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return [];
    const raw = await res.json();
    if (!Array.isArray(raw)) return [];
    return raw.map((e) => ({
      id: e.id, start: e.date, end: e.date, title: e.title, time: e.time || null,
      endTime: e.endTime || null, location: e.location || null, audience: e.audience || null,
      source: "Manual", kind: "manual",
    }));
  } catch {
    return [];
  }
}

async function cargarOverrides() {
  try {
    const res = await fetch(`${OVERRIDES_URL}?v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return {};
    const raw = await res.json();
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function aplicarOverrides(events, overrides) {
  return events
    .filter((e) => !overrides[e.id]?.deleted)
    .map((e) => {
      const o = overrides[e.id];
      if (!o) return e;
      const unDia = e.start === e.end;
      const nuevaFecha = unDia && o.date ? o.date : null;
      return {
        ...e,
        title: o.title ?? e.title,
        time: "time" in o ? (o.time || null) : e.time,
        start: nuevaFecha || e.start,
        end: nuevaFecha || e.end,
      };
    });
}

async function cargar() {
  const res = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudo cargar ${DATA_URL} (${res.status})`);
  datos = await res.json();
  const [manuales, overrides] = await Promise.all([cargarManuales(), cargarOverrides()]);
  datos.events = aplicarOverrides(datos.events.concat(manuales), overrides);
  renderTodo();
}

function tickReloj() {
  if (blackoutActivo) return; // en negro no hay nada que actualizar
  const now = new Date();
  $("clock").textContent = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

let diaPintado = null;

/* ---------- pantalla en negro (horario nocturno / fin de semana) ---------- */

/* Lunes a viernes de 20:30 a 07:30, y sábado/domingo completos. */
function enBlackout(now) {
  const dia = now.getDay(); // 0 = domingo … 6 = sábado
  if (dia === 0 || dia === 6) return true;
  const min = now.getHours() * 60 + now.getMinutes();
  return min >= BLACKOUT_INICIO_MIN || min < BLACKOUT_FIN_MIN;
}

let blackoutActivo = false;

function aplicarBlackout(now) {
  const activo = enBlackout(now);
  if (activo === blackoutActivo) return;
  blackoutActivo = activo;
  if (activo) {
    // Entra en apagón: se oculta todo y se deja de actualizar (sin red, sin repintados)
    // hasta que termine; no hay nadie mirando la pantalla en negro.
    $("blackout").hidden = false;
    liberarPantalla();
    return;
  }
  // Sale del apagón: recarga completa para arrancar con el código y los datos más
  // recientes (evita esperar hasta 15 min a que llegue el próximo refresco).
  location.reload();
}

/* Evita que la pantalla se apague/bloquee mientras el kiosk está abierto.
   Requiere HTTPS (contexto seguro); si no está disponible, no hace nada. */
let wakeLockRef = null;

async function mantenerPantallaActiva() {
  if (!("wakeLock" in navigator) || blackoutActivo) return;
  try {
    wakeLockRef = await navigator.wakeLock.request("screen");
    wakeLockRef.addEventListener("release", () => {
      // El sistema puede soltarlo (p. ej. al minimizar); se vuelve a pedir al recuperar visibilidad.
      wakeLockRef = null;
    });
  } catch {
    // Falla en pestañas no visibles o sin permiso; se reintenta con el listener de abajo.
  }
}

/* Suelta el wake lock durante el apagón: fuera del horario de clase no hace
   falta forzar la pantalla a permanecer encendida. */
function liberarPantalla() {
  if (wakeLockRef) wakeLockRef.release().catch(() => {});
  wakeLockRef = null;
}

async function iniciar() {
  ajustarEscala();
  window.addEventListener("resize", ajustarEscala);

  blackoutActivo = enBlackout(new Date());
  $("blackout").hidden = !blackoutActivo;
  if (!blackoutActivo) mantenerPantallaActiva();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") mantenerPantallaActiva();
  });

  setInterval(tickReloj, 5000);
  setInterval(() => aplicarBlackout(new Date()), 5000);
  setInterval(rotarDias, ROTACION_DIA_MS);

  try {
    diaPintado = iso(hoyDate());
    await cargar();
  } catch (err) {
    $("proxTexto").textContent = err.message;
  }

  // La pantalla vive encendida sin recargar nunca la página, así que app.js/style.css
  // se quedarían congelados en la versión con la que se abrió la pestaña. Al cambiar
  // de día forzamos una recarga completa (no solo un repintado) para que cualquier
  // despliegue nuevo llegue al kiosk como máximo una vez al día sin intervención manual.
  setInterval(() => {
    if (blackoutActivo) return; // se retoma con la recarga al salir del apagón
    if (iso(hoyDate()) !== diaPintado) { location.reload(); return; }
    if (modoAgendaActivo) actualizarAgenda(eventosPlanos(), hoyDate(), new Date());
  }, 60000);
  setInterval(() => { if (!blackoutActivo) cargar().catch(() => {}); }, REFRESCO_DATOS_MS);
  // Recarga completa periódica: por si el cambio de día no llega a activarse
  // (pantalla apagada esa noche, etc.), esto garantiza que cualquier despliegue
  // nuevo llegue al kiosk como mucho 3 horas después de subirlo. En negro no hace
  // falta: ya se recarga entera en cuanto termina el apagón (aplicarBlackout).
  setInterval(() => { if (!blackoutActivo) location.reload(); }, RECARGA_PAGINA_MS);
}

iniciar();
