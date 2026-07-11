// api/outlook-events.js
// Vercel Serverless Function
// GET /api/outlook-events?year=2026&month=7
//
// Devuelve los eventos del calendario de Outlook/Microsoft 365 de Nano para el
// mes pedido, vía Microsoft Graph API.
//
// Mismo diseño de un solo usuario que api/calendar-events.js (Google): se
// autoriza UNA sola vez de forma manual (ver instrucciones) y se guarda un
// refresh_token como variable de entorno en Vercel. Esta función lo usa para
// pedir un access token nuevo en cada llamada. El refresh_token nunca se
// expone al navegador.
//
// Variables de entorno requeridas (Vercel → Settings → Environment Variables):
//   MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_REFRESH_TOKEN

const fetchConTimeout = (url, options, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
};

async function getAccessToken() {
  const { MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_REFRESH_TOKEN } = process.env;
  if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET || !MICROSOFT_REFRESH_TOKEN) {
    throw new Error('Faltan variables de entorno de Outlook (MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET / MICROSOFT_REFRESH_TOKEN).');
  }
  // "common" acepta tanto cuentas personales (outlook.com/hotmail) como de
  // trabajo/estudio (Microsoft 365), sin necesitar un tenant ID específico.
  const resp = await fetchConTimeout('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      client_secret: MICROSOFT_CLIENT_SECRET,
      refresh_token: MICROSOFT_REFRESH_TOKEN,
      grant_type: 'refresh_token',
      scope: 'https://graph.microsoft.com/Calendars.Read offline_access',
    }),
  }, 8000);
  if (!resp.ok) {
    const detalle = await resp.text().catch(() => '');
    throw new Error(`No se pudo renovar el token de Microsoft (${resp.status}): ${detalle}`);
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

    const pad = (n) => String(n).padStart(2, '0');
    const ultimoDia = new Date(anio, mes, 0).getDate();
    const startDateTime = `${anio}-${pad(mes)}-01T00:00:00`;
    const endDateTime = `${anio}-${pad(mes)}-${pad(ultimoDia)}T23:59:59`;

    const params = new URLSearchParams({
      startDateTime,
      endDateTime,
      $orderby: 'start/dateTime',
      $top: '250',
    });

    const resp = await fetchConTimeout(
      `https://graph.microsoft.com/v1.0/me/calendarview?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          // Pide los horarios ya en hora de Chile, para no tener que
          // convertir zonas horarias manualmente en el frontend.
          Prefer: 'outlook.timezone="America/Santiago"',
        },
      },
      8000
    );

    if (!resp.ok) {
      const detalle = await resp.text().catch(() => '');
      return res.status(502).json({ error: `Outlook respondió con error (${resp.status}).`, detalle });
    }

    const data = await resp.json();
    const eventos = (data.value || []).map((ev) => ({
      id: ev.id,
      titulo: ev.subject || '(Sin título)',
      inicio: ev.start?.dateTime || null,
      fin: ev.end?.dateTime || null,
      todoElDia: !!ev.isAllDay,
      lugar: ev.location?.displayName || null,
      link: ev.webLink || null,
      fuente: 'outlook',
    }));

    return res.status(200).json({ eventos });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error desconocido consultando Outlook.' });
  }
}
