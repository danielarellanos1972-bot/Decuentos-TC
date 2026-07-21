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
      scope: 'https://graph.microsoft.com/Calendars.ReadWrite offline_access',
    }),
  }, 8000);
  if (!resp.ok) {
    const detalle = await resp.text().catch(() => '');
    throw new Error(`No se pudo renovar el token de Microsoft (${resp.status}): ${detalle}`);
  }
  const data = await resp.json();
  return data.access_token;
}

async function handlerCrearEvento(req, res) {
  const { titulo, fecha, horaInicio, horaFin, todoElDia, lugar, descripcion, destinatarios } = req.body || {};
  if (!titulo || !fecha) {
    return res.status(400).json({ error: 'Falta título o fecha.' });
  }

  try {
    const accessToken = await getAccessToken();

    const attendees = (Array.isArray(destinatarios) ? destinatarios : [])
      .map((email) => String(email).trim())
      .filter(Boolean)
      .map((email) => ({ emailAddress: { address: email }, type: 'required' }));

    const body = {
      subject: titulo,
      location: lugar ? { displayName: lugar } : undefined,
      body: descripcion ? { contentType: 'text', content: descripcion } : undefined,
      isAllDay: !!todoElDia,
      attendees: attendees.length ? attendees : undefined,
    };

    if (todoElDia) {
      body.start = { dateTime: `${fecha}T00:00:00`, timeZone: 'America/Santiago' };
      const fin = new Date(`${fecha}T00:00:00`);
      fin.setDate(fin.getDate() + 1);
      body.end = { dateTime: `${fin.toISOString().slice(0, 10)}T00:00:00`, timeZone: 'America/Santiago' };
    } else {
      body.start = { dateTime: `${fecha}T${horaInicio || '09:00'}:00`, timeZone: 'America/Santiago' };
      body.end = { dateTime: `${fecha}T${horaFin || horaInicio || '10:00'}:00`, timeZone: 'America/Santiago' };
    }

    // Graph manda la invitación por correo solo, apenas hay "attendees" en
    // el body — no hace falta ningún paso extra para eso.
    const resp = await fetchConTimeout(
      'https://graph.microsoft.com/v1.0/me/events',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      8000
    );

    if (!resp.ok) {
      const detalle = await resp.text().catch(() => '');
      return res.status(502).json({ error: `Outlook respondió con error (${resp.status}).`, detalle });
    }

    const data = await resp.json();
    return res.status(200).json({ ok: true, id: data.id, link: data.webLink });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error creando el evento en Outlook.' });
  }
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    return handlerCrearEvento(req, res);
  }

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
