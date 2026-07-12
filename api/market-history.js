// api/market-history.js
// Vercel Serverless Function
// GET /api/market-history?fuente=mindicador&codigo=uf&dias=365
// GET /api/market-history?fuente=yahoo&ticker=^IPSA&dias=365
//
// Serie histórica para el gráfico de evolución de cada indicador financiero.
// Dos fuentes, según el tipo de dato:
// - "mindicador": indicadores oficiales de Chile (UF, UTM, dólar, euro,
//   cobre, TPM, desempleo, IPC). mindicador.cl entrega la serie por año
//   calendario (/api/{codigo}/{año}), así que se piden los años necesarios
//   y se combinan.
// - "yahoo": índices/commodities internacionales (IPSA, S&P 500, Stoxx 50,
//   IBEX 35, Nikkei 225, petróleo WTI, oro), vía el endpoint público de
//   gráficos de Yahoo Finance (mismo que ya usa market-data.js).

const fetchConTimeout = (url, options, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
};

const HEADERS_MINDICADOR = { 'User-Agent': 'Mozilla/5.0 (compatible; DescuentosTC/1.0)' };

const CODIGOS_MINDICADOR_VALIDOS = new Set([
  'uf', 'utm', 'dolar', 'euro', 'libra_cobre', 'tpm', 'tasa_desempleo', 'ipc',
]);

async function historialMindicador(codigo, dias) {
  const anioActual = new Date().getFullYear();
  const aniosNecesarios = Math.max(1, Math.ceil(dias / 365)) + 1;
  const anios = Array.from({ length: aniosNecesarios }, (_, i) => anioActual - i);

  const respuestas = await Promise.all(
    anios.map((anio) =>
      fetchConTimeout(`https://mindicador.cl/api/${codigo}/${anio}`, { headers: HEADERS_MINDICADOR }, 6000)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
    )
  );

  const serieCompleta = respuestas
    .filter(Boolean)
    .flatMap((d) => d.serie || [])
    .map((p) => ({ fecha: p.fecha, valor: p.valor }));

  const limiteInferior = Date.now() - dias * 24 * 60 * 60 * 1000;
  const puntos = serieCompleta
    .filter((p) => new Date(p.fecha).getTime() >= limiteInferior)
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  return puntos;
}

async function historialYahoo(ticker, dias) {
  const ahoraSeg = Math.floor(Date.now() / 1000);
  const desdeSeg = ahoraSeg - dias * 24 * 60 * 60;

  const params = new URLSearchParams({
    period1: String(desdeSeg),
    period2: String(ahoraSeg),
    interval: '1d',
  });

  const resp = await fetchConTimeout(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?${params.toString()}`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } },
    7000
  );
  if (!resp.ok) throw new Error(`Yahoo Finance respondió con error (${resp.status}).`);
  const data = await resp.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error('Sin datos históricos para ese ticker.');

  const timestamps = result.timestamp || [];
  const cierres = result.indicators?.quote?.[0]?.close || [];

  return timestamps
    .map((t, i) => ({ fecha: new Date(t * 1000).toISOString().slice(0, 10), valor: cierres[i] }))
    .filter((p) => p.valor != null);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const fuente = req.query.fuente;
  const dias = Math.min(Math.max(parseInt(req.query.dias, 10) || 365, 2), 1825);

  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

  try {
    if (fuente === 'mindicador') {
      const codigo = req.query.codigo;
      if (!CODIGOS_MINDICADOR_VALIDOS.has(codigo)) {
        return res.status(400).json({ error: 'Código de indicador inválido.' });
      }
      const puntos = await historialMindicador(codigo, dias);
      if (puntos.length === 0) return res.status(200).json({ puntos: [], aviso: 'Sin datos históricos disponibles.' });
      return res.status(200).json({ puntos });
    }

    if (fuente === 'yahoo') {
      const ticker = req.query.ticker;
      if (!ticker) return res.status(400).json({ error: 'Falta el ticker.' });
      const puntos = await historialYahoo(ticker, dias);
      if (puntos.length === 0) return res.status(200).json({ puntos: [], aviso: 'Sin datos históricos disponibles.' });
      return res.status(200).json({ puntos });
    }

    return res.status(400).json({ error: 'Parámetro "fuente" inválido (debe ser mindicador o yahoo).' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error obteniendo el histórico.' });
  }
}
