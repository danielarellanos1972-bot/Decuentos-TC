// api/unread-mail.js
// Vercel Serverless Function
// GET /api/unread-mail
//
// Devuelve la cantidad de correos sin leer en Gmail y en Outlook.
//
// Mismo diseño de un solo usuario que api/calendar-events.js y
// api/outlook-events.js: reutiliza las MISMAS credenciales OAuth de Google y
// Microsoft ya configuradas para el calendario, pero con el refresh_token
// ampliado para incluir también acceso de solo lectura al correo (ver
// instrucciones de reautorización). El refresh_token nunca se expone al
// navegador.
//
// Variables de entorno requeridas (ya deberían existir del calendario):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
//   MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_REFRESH_TOKEN

const fetchConTimeout = (url, options, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
};

async function getGoogleAccessToken() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error('Faltan variables de entorno de Google.');
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
  if (!resp.ok) throw new Error(`No se pudo renovar el token de Google (${resp.status}).`);
  const data = await resp.json();
  return data.access_token;
}

async function getMicrosoftAccessToken() {
  const { MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_REFRESH_TOKEN } = process.env;
  if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET || !MICROSOFT_REFRESH_TOKEN) {
    throw new Error('Faltan variables de entorno de Microsoft.');
  }
  const resp = await fetchConTimeout('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      client_secret: MICROSOFT_CLIENT_SECRET,
      refresh_token: MICROSOFT_REFRESH_TOKEN,
      grant_type: 'refresh_token',
      scope: 'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Calendars.Read offline_access',
    }),
  }, 8000);
  if (!resp.ok) throw new Error(`No se pudo renovar el token de Microsoft (${resp.status}).`);
  const data = await resp.json();
  return data.access_token;
}

// Calcula la medianoche de "hoy" en la zona horaria de Chile, expresada como
// instante UTC. Se usa para pedirle a Gmail/Outlook solo los correos
// recibidos desde esa hora en adelante (así el contador se reinicia solo
// cada día, en vez de acumular todo lo no leído de la bandeja histórica).
function inicioDeHoyChile() {
  const ahora = new Date();

  // Offset actual de Chile respecto a UTC, calculado dinámicamente (evita
  // hardcodear -4/-3 y que se rompa si cambia el horario de verano).
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Santiago', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const partes = dtf.formatToParts(ahora).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  const horaChileComoUTC = Date.UTC(
    Number(partes.year), Number(partes.month) - 1, Number(partes.day),
    partes.hour === '24' ? 0 : Number(partes.hour), Number(partes.minute), Number(partes.second)
  );
  const offsetMin = (horaChileComoUTC - ahora.getTime()) / 60000;

  const [anio, mes, dia] = [Number(partes.year), Number(partes.month), Number(partes.day)];
  const medianocheUTC = Date.UTC(anio, mes - 1, dia, 0, 0, 0) - offsetMin * 60000;

  return { fecha: new Date(medianocheUTC), anio, mes, dia };
}

async function getGmailUnread() {
  try {
    const accessToken = await getGoogleAccessToken();
    const { anio, mes, dia } = inicioDeHoyChile();
    const pad = (n) => String(n).padStart(2, '0');
    // Gmail busca por fecha (no hora exacta) en la zona horaria de la cuenta.
    const query = `is:unread after:${anio}/${pad(mes)}/${pad(dia)}`;
    const resp = await fetchConTimeout(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=500`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      8000
    );
    if (!resp.ok) {
      const detalle = await resp.text().catch(() => '');
      return { unread: null, error: `Gmail respondió con error (${resp.status}).`, detalle };
    }
    const data = await resp.json();
    return { unread: (data.messages || []).length, error: null };
  } catch (err) {
    return { unread: null, error: err.message || 'Error desconocido consultando Gmail.' };
  }
}

async function getOutlookUnread() {
  try {
    const accessToken = await getMicrosoftAccessToken();
    const { fecha } = inicioDeHoyChile();
    const filtro = `isRead eq false and receivedDateTime ge ${fecha.toISOString()}`;
    const resp = await fetchConTimeout(
      `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$filter=${encodeURIComponent(filtro)}&$count=true&$top=1&$select=id`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ConsistencyLevel: 'eventual',
        },
      },
      8000
    );
    if (!resp.ok) {
      const detalle = await resp.text().catch(() => '');
      return { unread: null, error: `Outlook respondió con error (${resp.status}).`, detalle };
    }
    const data = await resp.json();
    return { unread: data['@odata.count'] ?? 0, error: null };
  } catch (err) {
    return { unread: null, error: err.message || 'Error desconocido consultando Outlook.' };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=180');

  const [gmail, outlook] = await Promise.all([getGmailUnread(), getOutlookUnread()]);

  return res.status(200).json({ gmail, outlook });
}
