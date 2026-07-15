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
//   gráficos de Yahoo Finance. Se usa el parámetro "range" (el mismo que
//   usa la web de Yahoo Finance) en vez de period1/period2 personalizados,
//   porque Yahoo suele devolver series vacías o truncadas para rangos
//   personalizados desde IPs de centros de datos (como las de Vercel),
//   mientras que los rangos con nombre (1y, 5y, etc.) son más confiables.

const fetchConTimeout = (url, options, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
};

const HEADERS_MINDICADOR = { 'User-Agent': 'Mozilla/5.0 (compatible; DescuentosTC/1.0)' };
const HEADERS_YAHOO = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'application/json',
};

const CODIGOS_MINDICADOR_VALIDOS = new Set([
  'uf', 'utm', 'dolar', 'euro', 'libra_cobre', 'tpm', 'tasa_desempleo', 'ipc', 'ipc_12m',
]);

async function historialMindicadorCrudo(codigo, dias) {
  const anioActual = new Date().getFullYear();
  const aniosNecesarios = Math.max(1, Math.ceil(dias / 365)) + 1;
  const anios = Array.from({ length: aniosNecesarios }, (_, i) => anioActual - i);

  const diagnostico = [];
  const respuestas = await Promise.all(
    anios.map(async (anio) => {
      try {
        const r = await fetchConTimeout(`https://mindicador.cl/api/${codigo}/${anio}`, { headers: HEADERS_MINDICADOR }, 8000);
        if (!r.ok) {
          diagnostico.push(`${anio}: HTTP ${r.status}`);
          return null;
        }
        return await r.json();
      } catch (err) {
        diagnostico.push(`${anio}: ${err.name === 'AbortError' ? 'tiempo de espera agotado' : err.message}`);
        return null;
      }
    })
  );

  const serie = respuestas
    .filter(Boolean)
    .flatMap((d) => d.serie || [])
    .map((p) => ({ fecha: p.fecha, valor: p.valor }))
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  return { serie, diagnostico };
}

// Series del Banco Central de Chile disponibles vía este endpoint (API BDE).
// Requiere las variables de entorno BCCH_USER / BCCH_PASS (cuenta gratuita
// registrada en si3.bcentral.cl/siete). A diferencia de mindicador.cl, esta
// API sí acepta un rango de fechas directo (firstdate/lastdate), sin tener
// que pedir año por año.
const CODIGOS_BCENTRAL = {
  ipsa: 'F013.IBC.IND.N.7.LAC.CL.CLP.BLO.D',
  imacec: 'F032.IMC.IND.Z.Z.EP18.Z.Z.0.M',
  tasa_hipotecaria: 'F022.VIV.TIP.MA03.UF.Z.M',
};

// El IMACEC y la tasa hipotecaria son datos mensuales (un solo punto por
// mes). Si se pide un rango corto (7D/30D), lo más probable es que no caiga
// ningún punto publicado dentro de esa ventana tan angosta y llegue vacío.
// Por eso, para series mensuales, se pide como mínimo este piso de días
// hacia atrás, sin importar el período elegido en pantalla — así siempre
// hay puntos que mostrar (el gráfico igual se ve, solo que cubre más rango
// del pedido).
const PISO_DIAS_BCENTRAL = {
  imacec: 400,
  tasa_hipotecaria: 400,
};

async function historialBCentral(codigo, dias) {
  const serie = CODIGOS_BCENTRAL[codigo];
  if (!serie) return { puntos: [], diagnostico: ['Código de serie del Banco Central no configurado.'] };

  const { BCCH_USER, BCCH_PASS } = process.env;
  if (!BCCH_USER || !BCCH_PASS) {
    return { puntos: [], diagnostico: ['Faltan las credenciales del Banco Central (BCCH_USER/BCCH_PASS) en Vercel.'] };
  }

  const diasEfectivos = Math.max(dias, PISO_DIAS_BCENTRAL[codigo] || 0);
  const hoy = new Date();
  const desde = new Date(hoy.getTime() - diasEfectivos * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  
  const params = new URLSearchParams({
    user: BCCH_USER,
    pass: BCCH_PASS,
    firstdate: fmt(desde),
    lastdate: fmt(hoy),
    timeseries: serie,
    function: 'GetSeries',
  });

  try {
    const resp = await fetchConTimeout(
      `https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx?${params.toString()}`,
      {},
      9000
    );
    if (!resp.ok) {
      const cuerpo = await resp.text().catch(() => '');
      return { puntos: [], diagnostico: [`Banco Central respondió HTTP ${resp.status}${cuerpo ? ': ' + cuerpo.slice(0, 200) : ''}`] };
    }
    const data = await resp.json();
    const obs = data?.Series?.Obs || data?.series?.obs || [];
    // El Banco Central entrega la fecha como "DD-MM-YYYY" (ej: "02-01-2024"),
    // hay que convertirla a "YYYY-MM-DD" para que ordene y se muestre bien.
    const aIso = (raw) => {
      if (!raw) return null;
      const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(raw);
      return m ? `${m[3]}-${m[2]}-${m[1]}` : raw;
    };
    const puntos = obs
      .map((o) => ({
        fecha: aIso(o.indexDateString || o.date),
        valor: parseFloat(o.value ?? o.Value),
      }))
      .filter((p) => p.fecha && Number.isFinite(p.valor));

    if (puntos.length === 0) {
      return {
        puntos: [],
        diagnostico: [
          'El Banco Central no devolvió puntos con el formato esperado. Respuesta cruda (primeros 300 caracteres): ' +
            JSON.stringify(data).slice(0, 300),
        ],
      };
    }
    return { puntos, diagnostico: [] };
  } catch (err) {
    return { puntos: [], diagnostico: [err.message || 'Error consultando al Banco Central.'] };
  }
}

async function historialMindicador(codigo, dias) {
  const { serie, diagnostico } = await historialMindicadorCrudo(codigo, dias);
  const limiteInferior = Date.now() - dias * 24 * 60 * 60 * 1000;
  const puntos = serie.filter((p) => new Date(p.fecha).getTime() >= limiteInferior);
  return { puntos, diagnostico };
}

// IPC acumulado a 12 meses, rodante mes a mes: para cada mes, compone las
// variaciones mensuales de los 12 meses previos (mismo cálculo que hace
// market-data.js para el valor "actual", pero repetido en cada punto de la
// serie para poder graficar cómo fue evolucionando esa cifra en el tiempo).
async function historialIpc12Meses(dias) {
  // Se pide bastante más historial mensual del que se va a graficar, porque
  // cada punto de la serie final necesita 12 meses previos para calcularse.
  const { serie: serieMensual, diagnostico } = await historialMindicadorCrudo('ipc', dias + 400);

  const puntosAnuales = [];
  for (let i = 11; i < serieMensual.length; i++) {
    const ventana = serieMensual.slice(i - 11, i + 1);
    const factor = ventana.reduce((acc, m) => acc * (1 + (m.valor || 0) / 100), 1);
    puntosAnuales.push({ fecha: serieMensual[i].fecha, valor: (factor - 1) * 100 });
  }

  const limiteInferior = Date.now() - dias * 24 * 60 * 60 * 1000;
  const puntos = puntosAnuales.filter((p) => new Date(p.fecha).getTime() >= limiteInferior);
  return { puntos, diagnostico };
}

// Convierte la cantidad de días pedida al parámetro "range" con nombre que
// usa Yahoo Finance (más confiable que un rango con fechas personalizadas).
function rangoYahoo(dias) {
  if (dias <= 7) return '5d';
  if (dias <= 30) return '1mo';
  if (dias <= 90) return '3mo';
  if (dias <= 365) return '1y';
  return '5y';
}

async function pedirYahoo(ticker, queryParams) {
  const resp = await fetchConTimeout(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?${queryParams.toString()}`,
    { headers: HEADERS_YAHOO },
    8000
  );
  if (!resp.ok) {
    const cuerpo = await resp.text().catch(() => '');
    throw new Error(`Yahoo Finance respondió HTTP ${resp.status}${cuerpo ? `: ${cuerpo.slice(0, 200)}` : ''}`);
  }
  const data = await resp.json();
  const error = data?.chart?.error;
  if (error) throw new Error(`Yahoo Finance: ${error.description || error.code}`);
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error('Yahoo Finance no devolvió resultados para ese ticker.');

  const timestamps = result.timestamp || [];
  const cierres = result.indicators?.quote?.[0]?.close || [];

  return timestamps
    .map((t, i) => ({ fecha: new Date(t * 1000).toISOString().slice(0, 10), valor: cierres[i] }))
    .filter((p) => p.valor != null);
}

async function historialYahoo(ticker, dias) {
  // Intento 1: rango con nombre (1y, 5y, etc.) — el más confiable.
  let errorIntento1 = null;
  try {
    const puntos = await pedirYahoo(ticker, new URLSearchParams({ range: rangoYahoo(dias), interval: '1d' }));
    if (puntos.length >= 2) return { puntos, diagnostico: [] };
  } catch (err) {
    errorIntento1 = err.message;
  }

  // Intento 2 (respaldo): fechas personalizadas con period1/period2.
  try {
    const ahoraSeg = Math.floor(Date.now() / 1000);
    const desdeSeg = ahoraSeg - dias * 24 * 60 * 60;
    const puntos = await pedirYahoo(
      ticker,
      new URLSearchParams({ period1: String(desdeSeg), period2: String(ahoraSeg), interval: '1d' })
    );
    if (puntos.length >= 2) return { puntos, diagnostico: [] };
    return {
      puntos: [],
      diagnostico: ['Yahoo Finance no tiene historial disponible para este ticker (ocurre con algunos índices bursátiles locales).'],
    };
  } catch (err) {
    return { puntos: [], diagnostico: [errorIntento1, err.message].filter(Boolean) };
  }
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
      const { puntos, diagnostico } =
        codigo === 'ipc_12m' ? await historialIpc12Meses(dias) : await historialMindicador(codigo, dias);
      if (puntos.length < 2) {
        return res.status(200).json({
          puntos: [],
          aviso: `Sin datos históricos suficientes.${diagnostico.length ? ' Detalle: ' + diagnostico.join(' · ') : ''}`,
        });
      }
      return res.status(200).json({ puntos });
    }

    if (fuente === 'bcentral') {
      const codigo = req.query.codigo;
      if (!CODIGOS_BCENTRAL[codigo]) {
        return res.status(400).json({ error: 'Código de serie del Banco Central inválido.' });
      }
      const { puntos, diagnostico } = await historialBCentral(codigo, dias);
      if (puntos.length < 2) {
        return res.status(200).json({
          puntos: [],
          aviso: `Sin datos históricos suficientes.${diagnostico.length ? ' Detalle: ' + diagnostico.join(' · ') : ''}`,
        });
      }
      return res.status(200).json({ puntos });
    }

    if (fuente === 'yahoo') {
      const ticker = req.query.ticker;
      if (!ticker) return res.status(400).json({ error: 'Falta el ticker.' });
      const { puntos, diagnostico } = await historialYahoo(ticker, dias);
      if (puntos.length < 2) {
        return res.status(200).json({
          puntos: [],
          aviso: `Sin datos históricos suficientes.${diagnostico.length ? ' Detalle: ' + diagnostico.join(' · ') : ''}`,
        });
      }
      return res.status(200).json({ puntos });
    }

    return res.status(400).json({ error: 'Parámetro "fuente" inválido (debe ser mindicador, bcentral o yahoo).' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error obteniendo el histórico.' });
  }
}
