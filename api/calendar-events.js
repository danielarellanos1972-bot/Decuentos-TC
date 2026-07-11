// api/calendar-events.js
// Vercel Serverless Function
// GET /api/calendar-events?year=2026&month=7
//
// Devuelve los eventos del Google Calendar principal de Nano para el mes pedido.
//
// Diseño de un solo usuario (sin login ni base de datos): en vez de que la web
// pida "Iniciar sesión con Google" cada vez, se autoriza UNA sola vez de forma
// manual (ver instrucciones) y se guarda un refresh_token como variable de
// entorno en Vercel. Esta función usa ese refresh_token para pedir un access
// token nuevo en cada llamada y consultar la API de Calendar. El refresh_token
// nunca se expone al navegador, solo vive en el servidor.
//
// Variables de entorno requeridas (Vercel → Settings → Environment Variables):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN

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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

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
    }));

    return res.status(200).json({ eventos });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error desconocido consultando Google Calendar.' });
  }
}
