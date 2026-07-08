// Vercel Serverless Function
// GET /api/market-data
//
// Junta indicadores financieros de Chile para los paneles laterales:
// - UF, UTM, Dólar (USD/CLP), IPC del mes → mindicador.cl (republica datos
//   oficiales del Banco Central de Chile, sin necesidad de API key propia)
// - Dólar Canadiense (CAD/CLP) → calculado cruzando el USD/CLP de mindicador
//   con el tipo de cambio USD/CAD de open.er-api.com (el Banco Central de
//   Chile no publica CAD de forma regular)
// - IPC acumulado 12 meses → calculado componiendo las variaciones mensuales
//   del último año desde mindicador.cl
// - Índices (IPSA, S&P 500, Europa, IBEX, Nikkei, petróleo, oro) → Yahoo
//   Finance (fuente de mejor esfuerzo, no oficial). Si alguno falla, se
//   devuelve null y el frontend lo muestra como "No disponible".
//
// No requiere variables de entorno: todas las fuentes usadas aquí son gratuitas
// y no piden API key.

const fetchConTimeout = (url, options, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
};

const HEADERS_MINDICADOR = { 'User-Agent': 'Mozilla/5.0 (compatible; DescuentosTC/1.0)' };

async function getIndicadoresBase() {
  for (let intento = 1; intento <= 2; intento++) {
    try {
      const resp = await fetchConTimeout('https://mindicador.cl/api', { headers: HEADERS_MINDICADOR }, 9000);
      if (resp.ok) return resp.json();
    } catch {
      // si falla el primer intento, se reintenta una vez antes de rendirse
    }
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
    if (serie.length < 6) return null; // muy pocos datos para un acumulado confiable
    const factor = serie.reduce((acc, m) => acc * (1 + (m.valor || 0) / 100), 1);
    return { valor: (factor - 1) * 100, meses: serie.length };
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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const base = await getIndicadoresBase();

    const usdClp = base?.dolar?.valor || null;
    const [cadClp, ipcAnual, ipsa, sp500, europa, ibex, asia, petroleo, oro] = await Promise.all([
      getCadClp(usdClp),
      getIpcAnual(),
      getQuote('^IPSA', 'IPSA'),
      getQuote('^GSPC', 'S&P 500 (NY)'),
      getQuote('^STOXX50E', 'Europa (Stoxx 50)'),
      getQuote('^IBEX', 'IBEX 35'),
      getQuote('^N225', 'Nikkei 225 (Asia)'),
      getQuote('CL=F', 'Petróleo (WTI)'),
      getQuote('GC=F', 'Oro'),
    ]);

    return res.status(200).json({
      fecha: new Date().toISOString(),
      uf: base?.uf ? { valor: base.uf.valor, fecha: base.uf.fecha } : null,
      utm: base?.utm ? { valor: base.utm.valor, fecha: base.utm.fecha } : null,
      usd: usdClp ? { valor: usdClp, fecha: base.dolar.fecha } : null,
      cad: cadClp ? { valor: cadClp } : null,
      eur: base?.euro ? { valor: base.euro.valor, fecha: base.euro.fecha } : null,
      ipcMensual: base?.ipc ? { valor: base.ipc.valor, fecha: base.ipc.fecha } : null,
      ipcAnual: ipcAnual,
      cobre: base?.libra_cobre ? { valor: base.libra_cobre.valor, fecha: base.libra_cobre.fecha } : null,
      tpm: base?.tpm ? { valor: base.tpm.valor, fecha: base.tpm.fecha } : null,
      desempleo: base?.tasa_desempleo ? { valor: base.tasa_desempleo.valor, fecha: base.tasa_desempleo.fecha } : null,
      indices: [ipsa, sp500, europa, ibex, asia, petroleo, oro],
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Error obteniendo indicadores' });
  }
}
