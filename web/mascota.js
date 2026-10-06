/* Mascota de los días tranquilos.
 *
 * En un día tranquilo (hoy no hay nada en agenda) sale 9 veces al día a pasear
 * por el lateral de la pantalla y cuenta una curiosidad de Canarias en un
 * bocadillo de cómic.
 *
 * - Horario: 9 apariciones, cada 80 minutos desde las 08:20 (la última, a las
 *   19:00), todo dentro del horario en que la pantalla está visible.
 * - Curiosidades: data/curiosidades.json. Se reparten con un contador guardado
 *   en el navegador y un orden barajado (con semilla), de modo que no se repite
 *   ninguna hasta haber contado todas; después se vuelve a barajar.
 * - Pruebas: añadir ?mascota=1 a la dirección para verla enseguida y en bucle
 *   (con curiosidades al azar, sin tocar el contador real). Con ?negro=0 se
 *   puede probar fuera del horario del apagón.
 *
 * Además, cada 10 minutos (a los :05, :15, :25…) Gallardito se asoma por uno de
 * los cuatro bordes de la pantalla haciendo una gracia, sin sonido ni texto.
 * Pruebas: ?asoma=1 (en bucle). Para fijar borde y gracia: &borde=abajo|arriba|izq|der
 * y &gracia=mira|cucu|baila.
 *
 * Usa variables de app.js: modoTranquiloActivo, blackoutActivo, hoyDate, iso.
 */
(() => {
  const URL_CURIOSIDADES = "data/curiosidades.json";
  const CLAVE_ESTADO = "mascotaEstado";

  const APARICIONES_DIA = 9;
  const PRIMERA_MIN = 8 * 60 + 20; // 08:20
  const SEPARACION_MIN = 80;
  const VENTANA_MS = 45 * 1000;    // margen para detectar el comienzo de cada aparición

  const T_CAMINATA = 4600;         // debe coincidir con m-entra / m-sale (style.css)
  const T_CIERRE_BOCADILLO = 350;
  const T_ENTRE_DEMOS = 6000;

  const DEMO = new URLSearchParams(location.search).get("mascota") === "1";

  const $m = (id) => document.getElementById(id);
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- curiosidades ---------- */

  let curiosidades = null;

  async function cargarCuriosidades() {
    if (curiosidades) return curiosidades;
    try {
      const res = await fetch(URL_CURIOSIDADES, { cache: "no-cache" });
      const datos = await res.json();
      curiosidades = Array.isArray(datos) ? datos.filter((t) => typeof t === "string" && t.trim()) : [];
    } catch {
      curiosidades = [];
    }
    return curiosidades;
  }

  /* Generador pseudoaleatorio con semilla: mismo orden en cualquier pantalla. */
  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function permutacion(n, semilla) {
    const orden = Array.from({ length: n }, (_, i) => i);
    const azar = mulberry32(semilla);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(azar() * (i + 1));
      [orden[i], orden[j]] = [orden[j], orden[i]];
    }
    return orden;
  }

  /* Posición n-ésima en el recorrido completo: cada vuelta usa un barajado nuevo. */
  function indiceDelContador(contador, total) {
    const vuelta = Math.floor(contador / total);
    return permutacion(total, 20261005 + vuelta)[contador % total];
  }

  const hash = (texto) => {
    let h = 0;
    for (let i = 0; i < texto.length; i++) h = (Math.imul(h, 31) + texto.charCodeAt(i)) | 0;
    return Math.abs(h);
  };

  /* Contador persistente: avanza una vez por aparición (no por recarga de la página). */
  function contadorParaAparicion(idAparicion) {
    try {
      const guardado = JSON.parse(localStorage.getItem(CLAVE_ESTADO) || "null") || { contador: -1, id: "" };
      if (guardado.id !== idAparicion) {
        guardado.contador += 1;
        guardado.id = idAparicion;
        localStorage.setItem(CLAVE_ESTADO, JSON.stringify(guardado));
      }
      return guardado.contador;
    } catch {
      return hash(idAparicion); // sin almacenamiento: determinista por aparición
    }
  }

  /* ---------- secuencia ---------- */

  let enCurso = false;

  async function pasear(texto) {
    const mascota = $m("mascota");
    const bocadillo = $m("bocadillo");
    $m("bocadilloTexto").textContent = texto;

    // 1) Entra caminando por el lateral
    mascota.hidden = false;
    mascota.className = "mascota entra camina";
    await esperar(T_CAMINATA);

    // 2) Se para y habla mientras se lee el bocadillo
    mascota.className = "mascota habla";
    bocadillo.hidden = false;
    bocadillo.className = "bocadillo aparece";
    await esperar(Math.max(9000, 4500 + texto.length * 75));

    // 3) Cierra el bocadillo y se va caminando
    bocadillo.className = "bocadillo desaparece";
    await esperar(T_CIERRE_BOCADILLO);
    bocadillo.hidden = true;
    mascota.className = "mascota sale camina";
    await esperar(T_CAMINATA);

    mascota.hidden = true;
    mascota.className = "mascota";
  }

  async function lanzar(idAparicion) {
    if (enCurso) return;
    enCurso = true;
    try {
      const lista = await cargarCuriosidades();
      if (!lista.length) return;
      const contador = idAparicion === null
        ? Math.floor(Math.random() * lista.length) // demo: no toca el contador real
        : contadorParaAparicion(idAparicion);
      await pasear(lista[indiceDelContador(contador, lista.length)] || lista[0]);
    } finally {
      enCurso = false;
    }
  }

  /* ---------- cuándo toca salir ---------- */

  function aparicionActual(ahora) {
    const min = ahora.getHours() * 60 + ahora.getMinutes() + ahora.getSeconds() / 60;
    for (let k = 0; k < APARICIONES_DIA; k++) {
      const inicio = PRIMERA_MIN + k * SEPARACION_MIN;
      if (min >= inicio && min < inicio + VENTANA_MS / 60000) return k;
    }
    return -1;
  }

  function ultimaMostrada() {
    try { return localStorage.getItem(CLAVE_ESTADO + "Ultima") || ""; } catch { return ""; }
  }
  function recordarMostrada(id) {
    try { localStorage.setItem(CLAVE_ESTADO + "Ultima", id); } catch { /* sin almacenamiento */ }
  }

  function revisar() {
    if (enCurso || asomando) return;
    const activo = typeof modoTranquiloActivo !== "undefined" && modoTranquiloActivo &&
                   typeof blackoutActivo !== "undefined" && !blackoutActivo;
    if (!activo) return;
    const k = aparicionActual(new Date());
    if (k < 0) return;
    const id = `${iso(hoyDate())}#${k}`;
    if (id === ultimaMostrada()) return;
    recordarMostrada(id);
    lanzar(id);
  }

  async function bucleDemo() {
    await esperar(2500);
    for (;;) {
      await lanzar(null);
      await esperar(T_ENTRE_DEMOS);
    }
  }

  /* ---------- Gallardito se asoma por los bordes (cada 10 min, sin sonido) ---------- */

  const ASOMA_CADA_MIN = 10;
  const ASOMA_MINUTO = 5;          // en los :05, :15, :25… (los paseos son en :00, :20 y :40)
  const ASOMA_DURACION_MS = { mira: 5400, cucu: 5800, baila: 5600 };
  const BORDES = ["abajo", "arriba", "izq", "der"];
  const GRACIAS = ["mira", "cucu", "baila"];

  const params = new URLSearchParams(location.search);
  const ASOMA_DEMO = params.get("asoma") === "1";
  const aleatorio = (lista) => lista[Math.floor(Math.random() * lista.length)];

  let asomando = false;
  let ultimaAsomada = "";
  let ultimoBorde = "";

  async function asomarse(borde, gracia) {
    if (asomando) return;
    asomando = true;
    const el = $m("asoma");
    try {
      // al azar, pero nunca dos veces seguidas por el mismo borde
      if (!BORDES.includes(borde)) borde = aleatorio(BORDES.filter((b) => b !== ultimoBorde));
      ultimoBorde = borde;
      if (!GRACIAS.includes(gracia)) gracia = aleatorio(GRACIAS);
      $m("asomaImg").src = `img/mascota/asoma-${borde}.png`;
      // posición al azar a lo largo del borde, sin salirse de la pantalla
      el.style.left = el.style.top = "";
      if (borde === "abajo" || borde === "arriba") el.style.left = (8 + Math.random() * 68) + "%";
      else el.style.top = (10 + Math.random() * 56) + "%";
      el.className = `asoma ${borde} ${gracia}`;
      el.hidden = false;
      await esperar(ASOMA_DURACION_MS[gracia] + 150);
    } finally {
      el.hidden = true;
      el.className = "asoma";
      asomando = false;
    }
  }

  function revisarAsoma() {
    if (asomando || enCurso) return;
    if (typeof blackoutActivo !== "undefined" && blackoutActivo) return;
    const ahora = new Date();
    // Vale cualquier segundo del minuto: si el navegador frena los temporizadores
    // (pestaña en segundo plano, equipo lento) no se pierde la asomada.
    if (ahora.getMinutes() % ASOMA_CADA_MIN !== ASOMA_MINUTO) return;
    const id = `${ahora.getDate()} ${ahora.getHours()}:${ahora.getMinutes()}`;
    if (id === ultimaAsomada) return;
    ultimaAsomada = id;
    asomarse();
  }

  async function bucleAsoma() {
    await esperar(1500);
    for (;;) {
      await asomarse(params.get("borde"), params.get("gracia"));
      await esperar(2500);
    }
  }

  window.asomarseAhora = asomarse;

  // Para probar a mano desde la consola: mascotaAhora() o mascotaAhora("texto")
  window.mascotaAhora = async (texto) => {
    if (enCurso) return;
    if (texto) { enCurso = true; try { await pasear(texto); } finally { enCurso = false; } }
    else await lanzar(null);
  };

  // Solo para pruebas automáticas
  window.mascotaInterna = { indiceDelContador, aparicionActual, APARICIONES_DIA };

  if (DEMO) bucleDemo();
  else setInterval(revisar, 5000);
  if (ASOMA_DEMO) bucleAsoma();
  else setInterval(revisarAsoma, 5000);
})();
