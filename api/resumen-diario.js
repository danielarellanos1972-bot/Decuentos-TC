// api/resumen-diario.js
// GET /api/resumen-diario?accion=ver     -> arma el resumen (correos + agenda) para mostrarlo en la app
// GET /api/resumen-diario?accion=enviar  -> arma el mismo resumen y lo manda por Gmail a GMAIL_TO
//   (pensado para que lo dispare el Cron de Vercel a las 8:00 hora de Chile; protegido con CRON_SECRET)
//
// Variables de entorno requeridas:
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
//     (el refresh_token debe incluir los scopes: calendar.events, gmail.readonly, gmail.send)
//   MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_REFRESH_TOKEN
//     (debe incluir: Mail.Read, Mail.Send, Calendars.Read)
//   GMAIL_TO      -> casilla de Gmail a la que se manda el resumen (ej: danielarellano1972@gmail.com)
//   CRON_SECRET   -> valor secreto que solo conoce el Cron de Vercel, para que nadie más pueda
//                    disparar el envío llamando la URL directamente

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
      scope: 'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Calendars.Read offline_access',
    }),
  }, 8000);
  if (!resp.ok) throw new Error(`No se pudo renovar el token de Microsoft (${resp.status}).`);
  const data = await resp.json();
  return data.access_token;
}

// Medianoche de "hoy" en Chile, expresada en UTC (mismo cálculo que
// api/unread-mail.js, para que ambos endpoints coincidan en qué es "hoy").
function inicioDeHoyChile() {
  const ahora = new Date();
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

function horaChile(iso) {
  try {
    return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago' });
  } catch {
    return '';
  }
}

function fechaCortaChile(iso) {
  try {
    return new Date(iso).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Santiago' });
  } catch {
    return '';
  }
}

// --- Correos recibidos hoy ---

async function correosGoogle() {
  const accessToken = await getGoogleAccessToken();
  const { anio, mes, dia } = inicioDeHoyChile();
  const pad = (n) => String(n).padStart(2, '0');
  const query = `after:${anio}/${pad(mes)}/${pad(dia)}`;
  const resp = await fetchConTimeout(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=25`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    8000
  );
  if (!resp.ok) return { items: [], error: `Gmail (${resp.status})` };
  const data = await resp.json();
  const ids = (data.messages || []).slice(0, 25);
  const detalles = await Promise.all(ids.map(async (m) => {
    const r = await fetchConTimeout(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      8000
    );
    if (!r.ok) return null;
    const d = await r.json();
    const headers = d.payload?.headers || [];
    const asunto = headers.find((h) => h.name === 'Subject')?.value || '(sin asunto)';
    const de = (headers.find((h) => h.name === 'From')?.value || '').replace(/<.*>/, '').trim();
    const hora = d.internalDate ? horaChile(Number(d.internalDate)) : '';
    return { asunto, de, hora, fuente: 'Gmail', orden: Number(d.internalDate) || 0 };
  }));
  return { items: detalles.filter(Boolean), error: null };
}

async function correosOutlook() {
  const accessToken = await getMicrosoftAccessToken();
  const { fecha } = inicioDeHoyChile();
  const filtro = `receivedDateTime ge ${fecha.toISOString()}`;
  const resp = await fetchConTimeout(
    `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$filter=${encodeURIComponent(filtro)}&$top=25&$select=subject,from,receivedDateTime&$orderby=receivedDateTime desc`,
    { headers: { Authorization: `Bearer ${accessToken}`, ConsistencyLevel: 'eventual' } },
    8000
  );
  if (!resp.ok) return { items: [], error: `Outlook (${resp.status})` };
  const data = await resp.json();
  const items = (data.value || []).map((m) => ({
    asunto: m.subject || '(sin asunto)',
    de: m.from?.emailAddress?.name || m.from?.emailAddress?.address || '',
    hora: horaChile(m.receivedDateTime),
    fuente: 'Outlook',
    orden: new Date(m.receivedDateTime).getTime(),
  }));
  return { items, error: null };
}

// --- Agenda: hoy + próximos días ---

async function eventosGoogle(dias) {
  const accessToken = await getGoogleAccessToken();
  const { fecha } = inicioDeHoyChile();
  const hasta = new Date(fecha.getTime() + dias * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    timeMin: fecha.toISOString(),
    timeMax: hasta.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  });
  const resp = await fetchConTimeout(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    8000
  );
  if (!resp.ok) return { items: [], error: `Google Calendar (${resp.status})` };
  const data = await resp.json();
  const items = (data.items || []).map((e) => {
    const inicioISO = e.start?.dateTime || e.start?.date;
    const todoElDia = !e.start?.dateTime;
    return {
      titulo: e.summary || '(sin título)',
      hora: todoElDia ? 'Todo el día' : horaChile(inicioISO),
      dia: fechaCortaChile(inicioISO),
      fuente: 'Google',
      orden: new Date(inicioISO).getTime(),
    };
  });
  return { items, error: null };
}

async function eventosOutlook(dias) {
  const accessToken = await getMicrosoftAccessToken();
  const { fecha } = inicioDeHoyChile();
  const hasta = new Date(fecha.getTime() + dias * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    startDateTime: fecha.toISOString(),
    endDateTime: hasta.toISOString(),
    $orderby: 'start/dateTime',
    $top: '50',
  });
  const resp = await fetchConTimeout(
    `https://graph.microsoft.com/v1.0/me/calendarView?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.timezone="America/Santiago"' } },
    8000
  );
  if (!resp.ok) return { items: [], error: `Outlook Calendar (${resp.status})` };
  const data = await resp.json();
  const items = (data.value || []).map((e) => ({
    titulo: e.subject || '(sin título)',
    hora: e.isAllDay ? 'Todo el día' : horaChile(e.start?.dateTime + 'Z'),
    dia: fechaCortaChile(e.start?.dateTime + 'Z'),
    fuente: 'Outlook',
    orden: new Date(e.start?.dateTime + 'Z').getTime(),
  }));
  return { items, error: null };
}

// --- Armado del texto plano (mismo formato para pantalla y para el correo) ---

function armarTexto({ correos, eventos, dias }) {
  const lineas = [];
  lineas.push(`Resumen del ${new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Santiago' })}`);
  lineas.push('');
  lineas.push(`CORREOS RECIBIDOS HOY (${correos.length})`);
  if (correos.length === 0) {
    lineas.push('  Sin correos nuevos hoy.');
  } else {
    correos.forEach((c) => lineas.push(`  ${c.hora}  [${c.fuente}]  ${c.asunto} — ${c.de}`));
  }
  lineas.push('');
  lineas.push(`AGENDA — hoy y próximos ${dias} días (${eventos.length})`);
  if (eventos.length === 0) {
    lineas.push('  Sin eventos programados.');
  } else {
    let diaActual = '';
    eventos.forEach((e) => {
      if (e.dia !== diaActual) {
        diaActual = e.dia;
        lineas.push(`  — ${diaActual} —`);
      }
      lineas.push(`  ${e.hora}  [${e.fuente}]  ${e.titulo}`);
    });
  }
  return lineas.join('\n');
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Correo con tarjetas, en la misma paleta de la app (fondo durazno, acento
// burdeos, verde/rojo para agenda) — mismos datos que armarTexto, distinto
// formato.
function armarHTML({ correos, eventos, dias }) {
  const fechaTitulo = new Date().toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Santiago',
  });

  const BG = '#FDF4EE';
  const CARD_BG = '#FFFFFF';
  const BORDER = '#F0DCC9';
  const INK = '#55402E';
  const MUTED = '#8A7A6B';
  const ACCENT = '#8C3A3A';

  const badge = (texto, color) => `
    <span style="display:inline-block;font-size:11px;font-weight:700;color:#FFFFFF;background:${color};
      border-radius:999px;padding:2px 9px;letter-spacing:.02em;">${escapeHtml(texto)}</span>`;

  const fuenteColor = (fuente) => (fuente === 'Google' ? '#1A73E8' : fuente === 'Outlook' ? '#0F6CBD' : ACCENT);

  const tarjetaCorreo = (c) => `
    <div style="background:${CARD_BG};border:1px solid ${BORDER};border-radius:12px;padding:14px 16px;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="font-family:'SF Mono',Menlo,monospace;font-size:12px;color:${MUTED};">${escapeHtml(c.hora)}</span>
        ${badge(c.fuente, fuenteColor(c.fuente))}
      </div>
      <div style="font-size:15px;font-weight:700;color:${INK};margin-bottom:2px;">${escapeHtml(c.asunto)}</div>
      <div style="font-size:13px;color:${MUTED};">${escapeHtml(c.de)}</div>
    </div>`;

  const tarjetaEvento = (e) => `
    <div style="background:${CARD_BG};border:1px solid ${BORDER};border-radius:12px;padding:14px 16px;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="font-family:'SF Mono',Menlo,monospace;font-size:12px;color:${MUTED};">${escapeHtml(e.hora)}</span>
        ${badge(e.fuente, fuenteColor(e.fuente))}
      </div>
      <div style="font-size:15px;font-weight:700;color:${INK};">${escapeHtml(e.titulo)}</div>
    </div>`;

  let bloqueEventos = '';
  if (eventos.length === 0) {
    bloqueEventos = `<p style="color:${MUTED};font-size:14px;">Sin eventos programados.</p>`;
  } else {
    let diaActual = '';
    eventos.forEach((e) => {
      if (e.dia !== diaActual) {
        diaActual = e.dia;
        bloqueEventos += `<p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:${ACCENT};margin:16px 0 8px;">${escapeHtml(diaActual)}</p>`;
      }
      bloqueEventos += tarjetaEvento(e);
    });
  }

  const bloqueCorreos = correos.length === 0
    ? `<p style="color:${MUTED};font-size:14px;">Sin correos nuevos hoy.</p>`
    : correos.map(tarjetaCorreo).join('');

  return `<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:28px 18px;">
    <div style="text-align:center;margin-bottom:24px;">
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:${ACCENT};font-weight:700;margin:0 0 4px;">Resumen diario</p>
      <h1 style="font-family:Georgia,'Iowan Old Style',serif;font-size:24px;color:${INK};margin:0;text-transform:capitalize;">${escapeHtml(fechaTitulo)}</h1>
    </div>

    <p style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:${INK};margin:0 0 10px;">
      Correos recibidos hoy (${correos.length})
    </p>
    ${bloqueCorreos}

    <p style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:${INK};margin:24px 0 10px;">
      Agenda — hoy y próximos ${dias} días (${eventos.length})
    </p>
    ${bloqueEventos}

    <p style="text-align:center;font-size:11px;color:${MUTED};margin-top:28px;">Descuentos TC · resumen automático</p>
  </div>
</body>
</html>`;
}

async function enviarPorGmail(texto, html, asunto) {
  const accessToken = await getGoogleAccessToken();
  const destino = process.env.GMAIL_TO;
  if (!destino) throw new Error('Falta la variable de entorno GMAIL_TO.');
  // multipart/alternative: manda las dos versiones (texto plano y HTML con
  // tarjetas). Gmail y la mayoría de los clientes de correo muestran la
  // versión HTML; el texto plano queda como respaldo para lectores que no
  // rendericen HTML.
  const boundary = 'resumen-diario-boundary-' + Date.now();
  const mensaje = [
    `To: ${destino}`,
    `Subject: =?UTF-8?B?${Buffer.from(asunto, 'utf8').toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    texto,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    '',
    html,
    '',
    `--${boundary}--`,
  ].join('\r\n');
  const raw = Buffer.from(mensaje, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const resp = await fetchConTimeout('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  }, 8000);
  if (!resp.ok) {
    const detalle = await resp.text().catch(() => '');
    throw new Error(`Gmail no pudo enviar el correo (${resp.status}): ${detalle}`);
  }
}

// --- 1. Búsqueda de noticias vía Google News RSS filtrado por sitio ---
//
// No hay forma de que esta función "navegue" cada medio como lo haría Claude
// — pero Google News sí indexa todos estos sitios y expone un RSS filtrable
// por dominio (site:) y por antigüedad (when:), con fecha real de
// publicación. Es gratis, no necesita ninguna cuenta ni API key nueva, y
// cubre exactamente el mismo universo de fuentes que pedía la tarea original.
const FUENTES = [
  { nombre: 'Diario Financiero', dominio: 'df.cl' },
  { nombre: 'Emol', dominio: 'emol.com' },
  { nombre: 'El Mercurio', dominio: 'elmercurio.com' },
  { nombre: 'Infosalmon', dominio: 'infosalmon.cl' },
  { nombre: 'Aqua al Día', dominio: 'aqua.cl' },
  { nombre: 'Editec', dominio: 'editec.cl' },
  { nombre: 'La Tercera', dominio: 'latercera.com' },
  { nombre: 'BioBioChile', dominio: 'biobiochile.cl' },
  { nombre: 'Portal Agro Chile', dominio: 'portalagrochile.cl' },
  { nombre: 'SalmonExpert', dominio: 'salmonexpert.com' },
  { nombre: 'Supply Chain Dive', dominio: 'supplychaindive.com' },
  { nombre: 'FreightWaves', dominio: 'freightwaves.com' },
  { nombre: 'Reuters', dominio: 'reuters.com' },
  { nombre: 'Bloomberg', dominio: 'bloomberg.com' },
];

const CATEGORIAS = ['Operaciones', 'Supply Chain', 'Producción', 'Abastecimiento', 'Logística', 'Compras', 'Finanzas', 'Economía', 'Salmonicultura', 'Minería', 'Banca', 'Energías Renovables', 'Agroindustria'];

function extraerItemsRSS(xml) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  return items.map((bloque) => {
    const titulo = (bloque.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
    const link = (bloque.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
    const pubDate = (bloque.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
    const fuenteTexto = (bloque.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || '';
    const limpiar = (s) => s.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').trim();
    return { titulo: limpiar(titulo), link: limpiar(link), pubDate: limpiar(pubDate), fuenteTexto: limpiar(fuenteTexto) };
  });
}

async function buscarNoticiasFuente(fuente) {
  try {
    const url = `https://news.google.com/rss/search?q=site:${fuente.dominio}+when:3d&hl=es-419&gl=CL&ceid=CL:es`;
    const resp = await fetchConTimeout(url, {}, 8000);
    if (!resp.ok) return [];
    const xml = await resp.text();
    const items = extraerItemsRSS(xml).slice(0, 10);
    const ahora = Date.now();
    const limiteMs = 72 * 60 * 60 * 1000; // 72 horas
    return items
      .filter((it) => it.titulo && it.link)
      .filter((it) => {
        const fecha = it.pubDate ? new Date(it.pubDate).getTime() : NaN;
        return !Number.isNaN(fecha) && (ahora - fecha) <= limiteMs;
      })
      .map((it) => ({ ...it, fuente: fuente.nombre }));
  } catch (err) {
    console.error(`buscarNoticiasFuente(${fuente.nombre}): falló`, err);
    return [];
  }
}

// --- 2. Selección + redacción con Groq (dos llamadas separadas para no
// pasarse del límite de tokens por minuto del modelo liviano) ---

const MAX_NOTICIAS = 4;

async function seleccionarNoticias(candidatas) {
  const { GROQ_API_KEY } = process.env;
  if (!GROQ_API_KEY) throw new Error('Falta la variable de entorno GROQ_API_KEY.');
  const listado = candidatas
    .map((c, i) => `${i}. [${c.fuente}] ${c.titulo} (${c.pubDate})`)
    .join('\n')
    .slice(0, 3000);

  const resp = await fetchConTimeout('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `Eres el filtro editorial de un reporte ejecutivo diario para un COO/VP de Operaciones y Supply Chain en LATAM. Te doy una lista numerada de titulares recientes. Elige hasta ${MAX_NOTICIAS} con mayor relevancia ejecutiva (costos operacionales, cadena de suministro, regulación, tecnología aplicada a operaciones), y asigna a cada una la categoría que mejor le calce de esta lista exacta: ${CATEGORIAS.join(', ')}. Responde SOLO con un JSON array, sin texto adicional, formato: [{"indice": 0, "categoria": "Supply Chain"}, ...]`,
        },
        { role: 'user', content: listado },
      ],
      temperature: 0.2,
      max_tokens: 500,
    }),
  }, 20000);
  if (!resp.ok) throw new Error(`Groq (selección) respondió ${resp.status}: ${(await resp.text().catch(() => '')).slice(0, 200)}`);
  const data = await resp.json();
  const texto = data.choices?.[0]?.message?.content?.trim() || '[]';
  try {
    const limpio = texto.replace(/```json|```/g, '').trim();
    return JSON.parse(limpio);
  } catch {
    return [];
  }
}

async function redactarPosts(seleccion) {
  const { GROQ_API_KEY } = process.env;
  const listado = seleccion
    .map((n, i) => `${i}. [${n.categoria} — ${n.fuente}, ${n.pubDate}] ${n.titulo}\nLink: ${n.link}`)
    .join('\n\n')
    .slice(0, 2200);

  const resp = await fetchConTimeout('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: 'Eres el asistente ejecutivo de un COO/VP de Operaciones y Supply Chain LATAM con 20+ años de experiencia. Para cada noticia que te paso, redacta un post de LinkedIn: arranca directo con el dato más potente (nunca "según [medio]" ni el nombre de la empresa primero), 3-4 párrafos breves y conversacionales sin clichés ("apasionante", "transformador", "disruptivo"), perspectiva ejecutiva de qué significa para operaciones/supply chain en LATAM, cierre con una reflexión de 1-2 líneas + una pregunta que invite al debate, y 5-7 hashtags al final. Máximo 150 palabras, texto corrido, sin bullets ni asteriscos. También un resumen de 2 oraciones con datos concretos. Responde SOLO con un JSON array en este formato exacto, sin texto adicional ni explicaciones antes o después: [{"indice": 0, "resumen": "...", "post": "..."}]',
        },
        { role: 'user', content: listado },
      ],
      temperature: 0.5,
      max_tokens: 3200,
    }),
  }, 25000);
  if (!resp.ok) throw new Error(`Groq (redacción) respondió ${resp.status}: ${(await resp.text().catch(() => '')).slice(0, 200)}`);
  const data = await resp.json();
  const texto = data.choices?.[0]?.message?.content?.trim() || '[]';
  try {
    const limpio = texto.replace(/```json|```/g, '').trim();
    const resultado = JSON.parse(limpio);
    if (!Array.isArray(resultado) || resultado.length === 0) {
      console.error('redactarPosts: el modelo respondió sin posts utilizables. Texto crudo:', texto.slice(0, 1000));
    }
    return resultado;
  } catch (err) {
    // Se deja el texto crudo en los logs — así la próxima vez que falle se
    // puede ver exactamente qué devolvió el modelo (ej. si se cortó a la
    // mitad del JSON) en vez de adivinar.
    console.error('redactarPosts: no se pudo parsear la respuesta como JSON.', err.message, 'Texto crudo:', texto.slice(0, 1000));
    return [];
  }
}

// --- 3. Página HTML interactiva (tarjetas por categoría, botón para
// desplegar el post con opción de copiar, link directo a la noticia) ---

const FONDO = '#FDF4EE';
const ACENTO = '#8C3A3A';
const TINTA = '#2B2420';
const MUTED = '#8A7F76';

function tarjetaNoticia(n) {
  const id = `post-${n.id}`;
  return `
  <div style="background:#fff;border:1px solid #eadfd6;border-radius:12px;padding:16px 18px;margin-bottom:12px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
      <span style="font-size:11px;color:${MUTED};">${escapeHtml(n.fuente)} · ${escapeHtml(n.fechaLegible)}</span>
    </div>
    <p style="font-size:15px;font-weight:700;color:${TINTA};margin:0 0 6px;">${escapeHtml(n.titulo)}</p>
    <p style="font-size:13px;color:${MUTED};margin:0 0 10px;line-height:1.5;">${escapeHtml(n.resumen)}</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap;">
      <a href="${escapeHtml(n.link)}" target="_blank" rel="noreferrer" style="font-size:12px;color:${ACENTO};font-weight:700;text-decoration:none;">Ir a la noticia ↗</a>
      <button onclick="document.getElementById('${id}').style.display = document.getElementById('${id}').style.display === 'block' ? 'none' : 'block'; this.textContent = this.textContent.startsWith('▼') ? '▲ Ocultar análisis' : '▼ ¿Analizar para LinkedIn?';" style="font-size:12px;color:${ACENTO};font-weight:700;background:none;border:1px solid ${ACENTO};border-radius:999px;padding:2px 12px;cursor:pointer;">▼ ¿Analizar para LinkedIn?</button>
    </div>
    <div id="${id}" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid #eadfd6;">
      <p style="font-size:13px;color:${TINTA};white-space:pre-wrap;line-height:1.6;margin:0 0 10px;">${escapeHtml(n.post)}</p>
      <button onclick="navigator.clipboard.writeText(document.getElementById('${id}').querySelector('p').textContent); this.textContent='Copiado ✓';" style="font-size:12px;color:#fff;background:${ACENTO};border:none;border-radius:999px;padding:6px 14px;cursor:pointer;">Copiar post</button>
    </div>
  </div>`;
}

function armarPaginaHTML(noticiasPorCategoria, fechaTitulo, sinNovedades, sugerencia) {
  const bloques = Object.entries(noticiasPorCategoria)
    .map(([categoria, lista]) => `
    <p style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:${TINTA};margin:24px 0 10px;">${escapeHtml(categoria)} (${lista.length})</p>
    ${lista.map(tarjetaNoticia).join('')}
  `).join('');

  const bloqueSinNovedades = sinNovedades.length > 0
    ? `<p style="font-size:11px;color:${MUTED};margin-top:28px;">Sin novedades verificadas hoy en: ${sinNovedades.map(escapeHtml).join(', ')}</p>`
    : '';
  const bloqueSugerencia = sugerencia
    ? `<p style="font-size:11px;color:${ACENTO};margin-top:8px;">${escapeHtml(sugerencia)}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Reporte de noticias — ${escapeHtml(fechaTitulo)}</title></head>
<body style="margin:0;padding:0;background:${FONDO};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:620px;margin:0 auto;padding:32px 18px;">
    <div style="text-align:center;margin-bottom:24px;">
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:${ACENTO};font-weight:700;margin:0 0 4px;">Reporte de noticias</p>
      <h1 style="font-family:Georgia,serif;font-size:26px;color:${TINTA};margin:0;text-transform:capitalize;">${escapeHtml(fechaTitulo)}</h1>
    </div>
    ${bloques}
    ${bloqueSinNovedades}
    ${bloqueSugerencia}
    <p style="text-align:center;font-size:11px;color:${MUTED};margin-top:28px;">Reporte generado automáticamente</p>
  </div>
</body>
</html>`;
}

// --- 4. Armado completo del reporte: busca, selecciona, redacta, sube a
// Blob y devuelve la URL ---

async function generarReporteNoticias() {
  const resultadosPorFuente = await Promise.all(FUENTES.map(buscarNoticiasFuente));
  const todas = resultadosPorFuente.flat();
  const fuentesConResultados = new Set();
  todas.forEach((n) => fuentesConResultados.add(n.fuente));
  const sinNovedades = FUENTES.map((f) => f.nombre).filter((n) => !fuentesConResultados.has(n));

  if (todas.length === 0) {
    throw new Error('No se encontraron noticias recientes en ninguna fuente hoy.');
  }

  const seleccion = await seleccionarNoticias(todas);
  const elegidas = seleccion
    .filter((s) => todas[s.indice])
    .map((s) => ({ ...todas[s.indice], categoria: s.categoria }));

  if (elegidas.length === 0) {
    throw new Error('El modelo no seleccionó ninguna noticia relevante hoy.');
  }

  const posts = await redactarPosts(elegidas);
  const conPost = elegidas.map((n, i) => {
    const p = posts.find((x) => x.indice === i);
    return {
      ...n,
      id: i,
      resumen: p?.resumen || '(sin resumen)',
      post: p?.post || '(no se pudo generar el post)',
      fechaLegible: n.pubDate ? new Date(n.pubDate).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }) : '',
    };
  });

  const porCategoria = {};
  conPost.forEach((n) => {
    const cat = CATEGORIAS.includes(n.categoria) ? n.categoria : 'Otros';
    if (!porCategoria[cat]) porCategoria[cat] = [];
    porCategoria[cat].push(n);
  });

  const hoy = new Date();
  const fechaTitulo = hoy.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const html = armarPaginaHTML(porCategoria, fechaTitulo, sinNovedades, null);

  const { put } = await import('@vercel/blob');
  const nombreArchivo = `reportes-noticias/${hoy.toISOString().slice(0, 10)}.html`;
  const { url } = await put(nombreArchivo, html, { access: 'public', contentType: 'text/html', allowOverwrite: true });

  return { url, cantidad: conPost.length, fechaTitulo };
}

async function enviarLinkReporteNoticias(url, fechaTitulo, cantidad) {
  const accessToken = await getGoogleAccessToken();
  const destino = process.env.GMAIL_TO;
  if (!destino) throw new Error('Falta la variable de entorno GMAIL_TO.');
  const asunto = `Reporte de Noticias — ${fechaTitulo}`;
  const texto = `Tu reporte de noticias de hoy está listo (${cantidad} noticias seleccionadas).\n\nÁbrelo acá: ${url}`;
  const html = `<p style="font-family:sans-serif;font-size:15px;">Tu reporte de noticias de hoy está listo (<b>${cantidad}</b> noticias seleccionadas).</p><p><a href="${escapeHtml(url)}" style="background:${ACENTO};color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700;font-family:sans-serif;">Abrir reporte de hoy</a></p>`;
  const boundary = 'reporte-noticias-boundary-' + Date.now();
  const mensaje = [
    `To: ${destino}`,
    `Subject: =?UTF-8?B?${Buffer.from(asunto, 'utf8').toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    texto,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    '',
    html,
    '',
    `--${boundary}--`,
  ].join('\r\n');
  const raw = Buffer.from(mensaje, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const resp = await fetchConTimeout('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  }, 10000);
  if (!resp.ok) throw new Error(`Gmail respondió con error (${resp.status}) al enviar el link del reporte.`);
}

export default async function handler(req, res) {
  // El reporte de noticias LinkedIn vive en este mismo archivo (no en uno
  // aparte) porque el proyecto ya está en el tope de 12 funciones que
  // permite el plan de Vercel — un archivo nuevo habría roto el deploy.
  if (req.query.reporte === 'noticias') {
    const accionNoticias = req.query.accion === 'enviar' ? 'enviar' : 'ver';
    try {
      if (accionNoticias === 'enviar') {
        const auth = req.headers['authorization'] || '';
        if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
          return res.status(401).json({ error: 'No autorizado.' });
        }
        const { url, cantidad, fechaTitulo } = await generarReporteNoticias();
        await enviarLinkReporteNoticias(url, fechaTitulo, cantidad);
        return res.status(200).json({ ok: true, url, cantidad });
      }
      const { url, cantidad, fechaTitulo } = await generarReporteNoticias();
      return res.status(200).json({ ok: true, url, cantidad, fechaTitulo });
    } catch (err) {
      console.error('resumen-diario (reporte=noticias) error:', err);
      return res.status(500).json({ error: err.message || 'Error generando el reporte de noticias.' });
    }
  }

  console.log('resumen-diario: INICIO, accion=', req.query.accion);
  const accion = req.query.accion === 'enviar' ? 'enviar' : 'ver';
  const dias = 3;

  if (accion === 'enviar') {
    // Solo el Cron de Vercel (que manda este header automáticamente cuando
    // CRON_SECRET está configurado) puede disparar el envío real por correo.
    const auth = req.headers['authorization'] || '';
    if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
      console.log('resumen-diario: 401 no autorizado. CRON_SECRET presente?', !!process.env.CRON_SECRET);
      return res.status(401).json({ error: 'No autorizado.' });
    }
    console.log('resumen-diario: auth OK, arrancando busqueda de correos/eventos');
  }

  try {
    const [gCorreos, oCorreos, gEventos, oEventos] = await Promise.all([
      correosGoogle().catch((e) => ({ items: [], error: e.message })),
      correosOutlook().catch((e) => ({ items: [], error: e.message })),
      eventosGoogle(dias).catch((e) => ({ items: [], error: e.message })),
      eventosOutlook(dias).catch((e) => ({ items: [], error: e.message })),
    ]);

    const correos = [...gCorreos.items, ...oCorreos.items].sort((a, b) => a.orden - b.orden);
    const eventos = [...gEventos.items, ...oEventos.items].sort((a, b) => a.orden - b.orden);
    const errores = [gCorreos.error, oCorreos.error, gEventos.error, oEventos.error].filter(Boolean);

    const texto = armarTexto({ correos, eventos, dias });
    const html = armarHTML({ correos, eventos, dias });

    console.log('resumen-diario: resumen armado, correos=', correos.length, 'eventos=', eventos.length, 'errores=', errores);
    if (accion === 'enviar') {
      const asunto = `Resumen diario — ${new Date().toLocaleDateString('es-CL', { timeZone: 'America/Santiago' })}`;
      console.log('resumen-diario: intentando enviar por Gmail a', process.env.GMAIL_TO);
      await enviarPorGmail(texto, html, asunto);
      console.log('resumen-diario: correo enviado OK');
      return res.status(200).json({ ok: true, enviado: true });
    }

    return res.status(200).json({ ok: true, correos, eventos, texto, errores: errores.length ? errores : null });
  } catch (err) {
    console.error('resumen-diario error:', err);
    return res.status(500).json({ error: err.message || 'Error generando el resumen.' });
  }
}
