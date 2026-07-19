// api/calendar-events.js
// Vercel Serverless Function
// GET /api/calendar-events?year=2026&month=7
// GET /api/calendar-events?type=holidays&year=2026&country=CL
// GET /api/calendar-events?type=efemerides&month=7&day=19
//
// Tres cosas viven en este mismo archivo (en vez de archivos separados)
// porque el plan gratuito de Vercel permite un máximo de 12 funciones por
// proyecto, y ya se estaba justo en el límite:
//
// 1. Eventos del Google Calendar principal de Nano para el mes pedido.
//    Diseño de un solo usuario (sin login ni base de datos): en vez de que
//    la web pida "Iniciar sesión con Google" cada vez, se autoriza UNA sola
//    vez de forma manual y se guarda un refresh_token como variable de
//    entorno en Vercel. Esta función usa ese refresh_token para pedir un
//    access token nuevo en cada llamada y consultar la API de Calendar. El
//    refresh_token nunca se expone al navegador, solo vive en el servidor.
//    Variables de entorno requeridas:
//      GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
//
// 2. Feriados oficiales por país (?type=holidays). Dos fuentes:
//    - Chile (CL): api.boostr.cl — API chilena gratuita y sin clave, hecha
//      específicamente para esto. Se usa como fuente principal porque
//      Nager.Date (la fuente genérica) no tenía cargados los feriados 2026
//      de Chile al momento de escribir esto.
//    - Cualquier otro país: Nager.Date — API pública gratuita, sin clave,
//      cubre más de 100 países por código ISO de 2 letras.
//
// 3. Efeméride del día (?type=efemerides). "Qué pasó un día como hoy", vía
//    la API pública de Wikipedia en español (sin clave, gratuita).

const fetchConTimeout = (url, options, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
};

async function getAccessToken() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error('Faltan variables de entorno de Google Calendar (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN).');
  }
  const resp = await fetchConTimeout('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  }, 8000);
  if (!resp.ok) {
    const detalle = await resp.text().catch(() => '');
    throw new Error(`No se pudo renovar el token de Google (${resp.status}): ${detalle}`);
  }
  const data = await resp.json();
  return data.access_token;
}

async function handlerEventos(req, res) {
  const anio = parseInt(req.query.year, 10);
  const mes = parseInt(req.query.month, 10); // 1-12

  if (!anio || !mes || mes < 1 || mes > 12) {
    return res.status(400).json({ error: 'Parámetros year/month inválidos.' });
  }

  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');

  try {
    const accessToken = await getAccessToken();

    const timeMin = new Date(Date.UTC(anio, mes - 1, 1, 0, 0, 0)).toISOString();
    const timeMax = new Date(Date.UTC(anio, mes, 1, 0, 0, 0)).toISOString();

    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    });

    const resp = await fetchConTimeout(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      8000
    );

    if (!resp.ok) {
      const detalle = await resp.text().catch(() => '');
      return res.status(502).json({ error: `Google Calendar respondió con error (${resp.status}).`, detalle });
    }

    const data = await resp.json();
    const eventos = (data.items || []).map((ev) => ({
      id: ev.id,
      titulo: ev.summary || '(Sin título)',
      inicio: ev.start?.dateTime || ev.start?.date || null,
      fin: ev.end?.dateTime || ev.end?.date || null,
      todoElDia: !ev.start?.dateTime,
      lugar: ev.location || null,
      link: ev.htmlLink || null,
      fuente: 'google',
    }));

    return res.status(200).json({ eventos });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error desconocido consultando Google Calendar.' });
  }
}

const HEADERS_FERIADOS = { 'User-Agent': 'Mozilla/5.0 (compatible; DescuentosTC/1.0)', Accept: 'application/json' };

async function feriadosChile(year) {
  const resp = await fetchConTimeout(`https://api.boostr.cl/holidays/${year}.json`, { headers: HEADERS_FERIADOS }, 8000);
  if (!resp.ok) throw new Error(`Boostr respondió HTTP ${resp.status}`);
  const data = await resp.json();
  const lista = data?.data || [];
  return lista.map((f) => ({ fecha: f.date, nombre: f.title, pais: 'CL' }));
}

async function feriadosOtroPais(year, country) {
  const resp = await fetchConTimeout(
    `https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`,
    { headers: HEADERS_FERIADOS },
    8000
  );
  if (!resp.ok) throw new Error(`Nager.Date respondió HTTP ${resp.status}`);
  const data = await resp.json();
  return (Array.isArray(data) ? data : []).map((f) => ({
    fecha: f.date,
    nombre: f.localName || f.name,
    pais: country,
  }));
}

async function handlerFeriados(req, res) {
  const year = parseInt(req.query.year, 10) || new Date().getFullYear();
  const country = (req.query.country || 'CL').toUpperCase();

  // Los feriados de un año no cambian una vez publicados: se puede cachear
  // por bastante tiempo sin problema.
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');

  try {
    const feriados = country === 'CL' ? await feriadosChile(year) : await feriadosOtroPais(year, country);
    if (feriados.length === 0) {
      return res.status(200).json({ feriados: [], error: `No se encontraron feriados para "${country}" en ${year}.` });
    }
    return res.status(200).json({ feriados });
  } catch (err) {
    return res.status(200).json({ feriados: [], error: err.message || 'Error obteniendo los feriados.' });
  }
}

// Efeméride del día: "qué pasó un día como hoy", vía la API pública de
// Wikipedia (sin clave, gratuita). Se pide en español.
async function handlerEfemerides(req, res) {
  const mes = parseInt(req.query.month, 10);
  const dia = parseInt(req.query.day, 10);
  if (!mes || !dia) {
    return res.status(400).json({ error: 'Parámetros month/day inválidos.' });
  }

  // Cambia como mucho una vez al día: se puede cachear bastante.
  res.setHeader('Cache-Control', 's-maxage=43200, stale-while-revalidate=86400');

  try {
    const resp = await fetchConTimeout(
      `https://es.wikipedia.org/api/rest_v1/feed/onthisday/events/${mes}/${dia}`,
      { headers: { 'User-Agent': 'DescuentosTC/1.0 (proyecto personal)', Accept: 'application/json' } },
      8000
    );
    if (!resp.ok) {
      return res.status(200).json({ efemerides: [], error: `Wikipedia respondió con error (${resp.status}).` });
    }
    const data = await resp.json();
    const efemerides = (data.events || [])
      .filter((ev) => ev.text)
      .map((ev) => ({ texto: ev.text, anio: ev.year }))
      .sort((a, b) => (b.anio || 0) - (a.anio || 0))
      .slice(0, 8);
    return res.status(200).json({ efemerides });
  } catch (err) {
    return res.status(200).json({ efemerides: [], error: err.message || 'Error obteniendo la efeméride.' });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  if (req.query.type === 'holidays') {
    return handlerFeriados(req, res);
  }
  if (req.query.type === 'efemerides') {
    return handlerEfemerides(req, res);
  }

  return handlerEventos(req, res);
}
