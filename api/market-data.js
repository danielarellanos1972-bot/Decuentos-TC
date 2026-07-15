// api/market-data.js
// Vercel Serverless Function
// GET /api/market-data
//
// Junta indicadores financieros de Chile para los paneles laterales:
// - UF, UTM, Dólar (USD/CLP), TPM, Desempleo → Banco Central de Chile, vía
//   la API BDE (requiere BCCH_USER/BCCH_PASS). mindicador.cl queda como
//   respaldo secundario para estos 5 (por si las credenciales fallan), ya
//   que mindicador.cl bloquea o limita el tráfico específico de Vercel de
//   forma intermitente y no es confiable como fuente principal.
// - Euro, Cobre, IPC del mes → mindicador.cl (todavía no migrados al Banco
//   Central; si mindicador.cl no responde, se muestran como "No disponible")
// - Dólar Canadiense (CAD/CLP) → calculado cruzando el USD/CLP con el tipo
//   de cambio USD/CAD de open.er-api.com (el Banco Central de Chile no
//   publica CAD de forma regular)
// - IPC acumulado 12 meses → calculado componiendo las variaciones mensuales
//   del último año desde mindicador.cl
// - IPSA, IMACEC, Tasa Hipotecaria, TCR, EEE → Banco Central de Chile
// - Índices internacionales (S&P 500, Stoxx 50, etc.) → Yahoo Finance
//
// Variables de entorno requeridas: BCCH_USER, BCCH_PASS (para todo lo que
// viene del Banco Central). El resto de fuentes son gratuitas y no piden
// API key.

const fetchConTimeout = (url, options, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
};

const HEADERS_MINDICADOR = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
};

// mindicador.cl a veces deja de actualizar un indicador puntual (le ha pasado
// al IPC) aunque el resto de la API siga funcionando. Esta función descarta
// datos más viejos que `maxDias`, para no mostrar un número desactualizado
// como si fuera el vigente.
function esReciente(fechaISO, maxDias) {
  if (!fechaISO) return false;
  const fecha = new Date(fechaISO);
  if (Number.isNaN(fecha.getTime())) return false;
  const diffDias = (Date.now() - fecha.getTime()) / (24 * 60 * 60 * 1000);
  return diffDias <= maxDias;
}

// Respaldo manual del IPC oficial (INE), usado SOLO si mindicador.cl entrega
// un dato más viejo que ~55 días (es decir, si dejó de actualizarse).
// ⚠️ Actualizar estos 3 valores el día que salga el nuevo IPC (INE publica
// ~el día 8 de cada mes, ver ine.gob.cl): mensual, acumulado 12 meses, y la
// fecha (primer día del mes que informa el boletín).
const IPC_FALLBACK = {
  mensual: 0.0,
  anual: 4.3,
  fecha: '2026-06-01',
};

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getIndicadoresBase() {
  for (let intento = 1; intento <= 2; intento++) {
    try {
      const resp = await fetchConTimeout('https://mindicador.cl/api', { headers: HEADERS_MINDICADOR }, 6000);
      if (resp.ok) return resp.json();
    } catch {
      // si falla, se reintenta (con una breve espera) antes de rendirse
    }
    if (intento < 2) await esperar(500);
  }
  throw new Error('mindicador.cl no respondió correctamente tras 2 intentos');
}

async function getCadClp(usdClp) {
  try {
    const resp = await fetchConTimeout('https://open.er-api.com/v6/latest/USD', {}, 3500);
    if (!resp.ok) return null;
    const data = await resp.json();
    const usdPorCad = data?.rates?.CAD;
    if (!usdPorCad || !usdClp) return null;
    // 1 USD = usdPorCad CAD  →  1 CAD = usdClp / usdPorCad CLP
    return usdClp / usdPorCad;
  } catch {
    return null;
  }
}

async function getIpcAnual() {
  try {
    const anioActual = new Date().getFullYear();
    const [respActual, respAnterior] = await Promise.all([
      fetchConTimeout(`https://mindicador.cl/api/ipc/${anioActual}`, { headers: HEADERS_MINDICADOR }, 3500),
      fetchConTimeout(`https://mindicador.cl/api/ipc/${anioActual - 1}`, { headers: HEADERS_MINDICADOR }, 3500),
    ]);
    const dataActual = respActual.ok ? await respActual.json() : { serie: [] };
    const dataAnterior = respAnterior.ok ? await respAnterior.json() : { serie: [] };
    const serie = [...(dataActual.serie || []), ...(dataAnterior.serie || [])]
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      .slice(0, 12);
    if (serie.length < 12) return null; // necesitamos los 12 meses completos para que cuadre con el dato oficial
    const fechaMasReciente = serie[0]?.fecha || null;
    if (!esReciente(fechaMasReciente, 55)) return null; // mindicador.cl dejó de actualizar este indicador
    const factor = serie.reduce((acc, m) => acc * (1 + (m.valor || 0) / 100), 1);
    const valor = (factor - 1) * 100;
    // Filtro de sensatez: la inflación anual de Chile no se ha movido fuera de este
    // rango en la última década. Si mindicador.cl entrega datos incompletos o
    // corruptos el cálculo puede dispararse; en ese caso preferimos "No disponible"
    // antes que mostrar un número inventado.
    if (!Number.isFinite(valor) || valor < -5 || valor > 20) return null;
    return { valor, fecha: fechaMasReciente, meses: serie.length };
  } catch {
    return null;
  }
}

async function getQuote(ticker, label) {
  try {
    const resp = await fetchConTimeout(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
      3500
    );
    if (!resp.ok) return { label, valor: null };
    const data = await resp.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return { label, valor: null };
    const actual = meta.regularMarketPrice;
    const previo = meta.previousClose || meta.chartPreviousClose;
    const variacion = previo ? ((actual - previo) / previo) * 100 : null;
    return { label, valor: actual, variacion };
  } catch {
    return { label, valor: null };
  }
}

// IMACEC (actividad económica mensual) — Banco Central de Chile, vía la API
// BDE (requiere las variables de entorno BCCH_USER / BCCH_PASS). Se muestra
// como variación interanual (%), que es la cifra que habitualmente se cita
// ("el IMACEC subió/bajó X% interanual"), calculada comparando el último
// valor con el mismo mes del año anterior.
async function getImacec() {
  const { BCCH_USER, BCCH_PASS } = process.env;
  if (!BCCH_USER || !BCCH_PASS) return null;
  try {
    const hoy = new Date();
    const desde = new Date(hoy.getTime() - 600 * 24 * 60 * 60 * 1000);
    const fmt = (d) => d.toISOString().slice(0, 10);
    const params = new URLSearchParams({
      user: BCCH_USER,
      pass: BCCH_PASS,
      firstdate: fmt(desde),
      lastdate: fmt(hoy),
      timeseries: 'F032.IMC.IND.Z.Z.EP18.Z.Z.0.M',
      function: 'GetSeries',
    });
    const resp = await fetchConTimeout(`https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx?${params.toString()}`, {}, 6000);
    if (!resp.ok) return null;
    const data = await resp.json();
    const aIso = (raw) => {
      const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(raw || '');
      return m ? `${m[3]}-${m[2]}-${m[1]}` : raw;
    };
    const puntos = (data?.Series?.Obs || [])
      .map((o) => ({ fecha: aIso(o.indexDateString), valor: parseFloat(o.value) }))
      .filter((p) => p.fecha && Number.isFinite(p.valor))
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    if (puntos.length === 0) return null;
    const ultimo = puntos[puntos.length - 1];
    const haceUnAnio = puntos.length >= 13 ? puntos[puntos.length - 13] : null;
    const variacionAnual = haceUnAnio && haceUnAnio.valor ? ((ultimo.valor - haceUnAnio.valor) / haceUnAnio.valor) * 100 : null;
    return { valor: variacionAnual, fecha: ultimo.fecha };
  } catch {
    return null;
  }
}

// Tasa de interés promedio de créditos hipotecarios para vivienda, a más de
// 3 años (en UF) — mismo mecanismo que IMACEC, vía API BDE del Banco Central.
async function getTasaHipotecaria() {
  const { BCCH_USER, BCCH_PASS } = process.env;
  if (!BCCH_USER || !BCCH_PASS) return null;
  try {
    const hoy = new Date();
    const desde = new Date(hoy.getTime() - 400 * 24 * 60 * 60 * 1000);
    const fmt = (d) => d.toISOString().slice(0, 10);
    const params = new URLSearchParams({
      user: BCCH_USER,
      pass: BCCH_PASS,
      firstdate: fmt(desde),
      lastdate: fmt(hoy),
      timeseries: 'F022.VIV.TIP.MA03.UF.Z.M',
      function: 'GetSeries',
    });
    const resp = await fetchConTimeout(`https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx?${params.toString()}`, {}, 6000);
    if (!resp.ok) return null;
    const data = await resp.json();
    const aIso = (raw) => {
      const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(raw || '');
      return m ? `${m[3]}-${m[2]}-${m[1]}` : raw;
    };
    const puntos = (data?.Series?.Obs || [])
      .map((o) => ({ fecha: aIso(o.indexDateString), valor: parseFloat(o.value) }))
      .filter((p) => p.fecha && Number.isFinite(p.valor))
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    if (puntos.length === 0) return null;
    const ultimo = puntos[puntos.length - 1];
    return { valor: ultimo.valor, fecha: ultimo.fecha };
  } catch {
    return null;
  }
}

// Serie genérica reutilizable para el resto de indicadores del Banco
// Central que solo necesitan "el último valor publicado" (sin variación
// interanual): Tipo de Cambio Real y Expectativas Económicas.
async function getSerieBCentral(seriesId) {
  const { BCCH_USER, BCCH_PASS } = process.env;
  if (!BCCH_USER || !BCCH_PASS) return null;
  try {
    const hoy = new Date();
    const desde = new Date(hoy.getTime() - 400 * 24 * 60 * 60 * 1000);
    const fmt = (d) => d.toISOString().slice(0, 10);
    const params = new URLSearchParams({
      user: BCCH_USER,
      pass: BCCH_PASS,
      firstdate: fmt(desde),
      lastdate: fmt(hoy),
      timeseries: seriesId,
      function: 'GetSeries',
    });
    const resp = await fetchConTimeout(`https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx?${params.toString()}`, {}, 6000);
    if (!resp.ok) return null;
    const data = await resp.json();
    const aIso = (raw) => {
      const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(raw || '');
      return m ? `${m[3]}-${m[2]}-${m[1]}` : raw;
    };
    const puntos = (data?.Series?.Obs || [])
      .map((o) => ({ fecha: aIso(o.indexDateString), valor: parseFloat(o.value) }))
      .filter((p) => p.fecha && Number.isFinite(p.valor))
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    if (puntos.length === 0) return null;
    const ultimo = puntos[puntos.length - 1];
    return { valor: ultimo.valor, fecha: ultimo.fecha };
  } catch {
    return null;
  }
}

// Tipo de Cambio Real (TCR) — mide el poder adquisitivo del peso frente a
// una canasta de monedas, no solo el dólar. Índice base 1991=100.
function getTcr() {
  return getSerieBCentral('F073.TCR.IND.199101.M');
}

// Expectativas Económicas (EEE) — inflación esperada por el mercado,
// promedio a largo plazo (%). Es la cifra que suele citarse como
// "expectativas de inflación de largo plazo".
function getEee() {
  return getSerieBCentral('F089.IPC.V12.LP.M');
}

// UF, UTM, Dólar observado, TPM y Desempleo — directo del Banco Central
// (más confiable desde Vercel que mindicador.cl). Códigos confirmados en el
// catálogo oficial de la API BDE.
function getUfBCentral() {
  return getSerieBCentral('F073.UFF.PRE.Z.D');
}
function getUtmBCentral() {
  return getSerieBCentral('F073.UTR.PRE.Z.M');
}
function getDolarBCentral() {
  return getSerieBCentral('F073.TCO.PRE.Z.D');
}
function getTpmBCentral() {
  return getSerieBCentral('F022.TPM.TIN.D001.NO.Z.D');
}
function getDesempleoBCentral() {
  return getSerieBCentral('F049.DES.TAS.INE.10.M');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  const [
    ufBC, utmBC, dolarBC, tpmBC, desempleoBC,
    base, ipcAnualCalculado, imacec, tasaHipotecaria, tcr, eee,
    ipsa, sp500, europa, ibex, asia, petroleo, oro,
  ] = await Promise.all([
    getUfBCentral(),
    getUtmBCentral(),
    getDolarBCentral(),
    getTpmBCentral(),
    getDesempleoBCentral(),
    getIndicadoresBase().catch(() => null),
    getIpcAnual(),
    getImacec(),
    getTasaHipotecaria(),
    getTcr(),
    getEee(),
    getQuote('^IPSA', 'IPSA'),
    getQuote('^GSPC', 'S&P 500 (NY)'),
    getQuote('^STOXX50E', 'Europa (Stoxx 50)'),
    getQuote('^IBEX', 'IBEX 35'),
    getQuote('^N225', 'Nikkei 225 (Asia)'),
    getQuote('CL=F', 'Petróleo (WTI)'),
    getQuote('GC=F', 'Oro'),
  ]);
  // El aviso de "mindicador.cl no respondió" ahora solo aplica a lo que
  // sigue dependiendo de esa fuente (Euro, Cobre) — UF/UTM/USD/TPM/Desempleo
  // ya vienen del Banco Central y no se ven afectados si mindicador falla.
  const avisoBase = base ? null : 'Euro/cobre no disponibles en este momento (mindicador.cl no respondió).';

  const usdClp = dolarBC?.valor || base?.dolar?.valor || null;
  const cadClp = await getCadClp(usdClp);

  // El IPC mensual de mindicador.cl se descarta si quedó desactualizado (>55 días);
  // en ese caso se usa el respaldo manual (IPC_FALLBACK) en vez de "No disponible",
  // ya que es un dato que sí tenemos confirmado y actualizamos a mano cada mes.
  const ipcMensualMindicador = base?.ipc && esReciente(base.ipc.fecha, 55) ? { valor: base.ipc.valor, fecha: base.ipc.fecha } : null;
  const ipcMensual = ipcMensualMindicador || { valor: IPC_FALLBACK.mensual, fecha: IPC_FALLBACK.fecha, respaldo: true };
  const ipcAnual = ipcAnualCalculado || { valor: IPC_FALLBACK.anual, fecha: IPC_FALLBACK.fecha, respaldo: true };

  return res.status(200).json({
    fecha: new Date().toISOString(),
    avisoBase,
    uf: ufBC || (base?.uf ? { valor: base.uf.valor, fecha: base.uf.fecha } : null),
    utm: utmBC || (base?.utm ? { valor: base.utm.valor, fecha: base.utm.fecha } : null),
    usd: usdClp ? { valor: usdClp, fecha: dolarBC?.fecha || base?.dolar?.fecha } : null,
    cad: cadClp ? { valor: cadClp } : null,
    eur: base?.euro ? { valor: base.euro.valor, fecha: base.euro.fecha } : null,
    ipcMensual,
    ipcAnual,
    cobre: base?.libra_cobre ? { valor: base.libra_cobre.valor, fecha: base.libra_cobre.fecha } : null,
    tpm: tpmBC || (base?.tpm ? { valor: base.tpm.valor, fecha: base.tpm.fecha } : null),
    desempleo: desempleoBC || (base?.tasa_desempleo ? { valor: base.tasa_desempleo.valor, fecha: base.tasa_desempleo.fecha } : null),
    imacec: imacec,
    tasaHipotecaria: tasaHipotecaria,
    tcr: tcr,
    eee: eee,
    indices: [ipsa, sp500, europa, ibex, asia, petroleo, oro],
  });
}
