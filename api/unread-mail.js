import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

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

// El scope es un parámetro (no fijo) por la misma razón que en
// outlook-events.js: pedir de más en la renovación del token rompe hasta lo
// que ya funcionaba si el refresh_token no tiene ese permiso concedido
// todavía. El valor por defecto es el que ya está autorizado (correo +
// calendario); la búsqueda en OneDrive pide explícitamente el scope extra
// de Files.Read, que va a fallar con un error claro hasta que se reautorice
// la cuenta de Microsoft con ese permiso — sin afectar el contador de
// correos que ya funciona.
async function getMicrosoftAccessToken(scope = 'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Calendars.Read offline_access') {
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
      scope,
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

// Detecta el tipo de archivo por su extensión, para mostrar un ícono y una
// etiqueta reconocibles (Word / Excel / PDF / PowerPoint / otro).
function tipoDeArchivo(nombre) {
  const ext = (nombre.split('.').pop() || '').toLowerCase();
  if (['doc', 'docx'].includes(ext)) return { etiqueta: 'Word', icono: '📄', color: '#1B5FBD' };
  if (['xls', 'xlsx', 'csv'].includes(ext)) return { etiqueta: 'Excel', icono: '📊', color: '#1D7A46' };
  if (ext === 'pdf') return { etiqueta: 'PDF', icono: '📕', color: '#B3312C' };
  if (['ppt', 'pptx'].includes(ext)) return { etiqueta: 'PowerPoint', icono: '📙', color: '#C0431A' };
  if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) return { etiqueta: 'Imagen', icono: '🖼️', color: '#7A5AC2' };
  return { etiqueta: ext ? ext.toUpperCase() : 'Archivo', icono: '📁', color: '#6B6558' };
}

function formatoTamano(bytes) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.round(bytes / 1024)} KB`;
  return `${mb.toFixed(1)} MB`;
}

// El endpoint de búsqueda de Graph (/search) es conocidamente poco
// confiable para cuentas PERSONALES de OneDrive (Hotmail/Outlook.com) —
// Microsoft lo documenta como una limitación conocida, a diferencia de las
// cuentas empresariales donde sí funciona bien (a veces encuentra archivos,
// a veces no, sin que cambie nada de tu lado). En vez de depender de eso,
// esta función recorre el drive completo con /delta (mismo mecanismo que
// usa OneDrive para sincronizar) y el filtrado por nombre se hace acá
// mismo, en el servidor — encuentra TODOS los tipos de archivo por igual,
// no solo los que el índice de búsqueda de Microsoft decide mostrar.
//
// Tiene un tope de tiempo (no de páginas) para no pasarse del límite de
// ejecución de Vercel: si tu OneDrive es tan grande que no alcanza a
// recorrerse completo, corta ahí y avisa que el listado quedó incompleto,
// en vez de fallar o demorarse indefinidamente.
const PRESUPUESTO_TIEMPO_DELTA_MS = 22000;
const MAX_PAGINAS_DELTA = 60;

async function listarTodosLosArchivos(accessToken, presupuestoMs = PRESUPUESTO_TIEMPO_DELTA_MS) {
  const archivos = [];
  let url = 'https://graph.microsoft.com/v1.0/me/drive/root/delta?$select=id,name,webUrl,size,createdDateTime,lastModifiedDateTime,createdBy,lastModifiedBy,file,folder,parentReference,deleted';
  let paginas = 0;
  const inicio = Date.now();
  let completo = true;

  while (url && paginas < MAX_PAGINAS_DELTA) {
    if (Date.now() - inicio > presupuestoMs) {
      completo = false;
      break;
    }
    const resp = await fetchConTimeout(url, { headers: { Authorization: `Bearer ${accessToken}` } }, 8000);
    if (!resp.ok) {
      const detalle = await resp.text().catch(() => '');
      throw new Error(`OneDrive respondió con error (${resp.status}) al listar archivos. ${detalle.slice(0, 200)}`);
    }
    const data = await resp.json();
    (data.value || []).forEach((item) => {
      if (!item.folder && !item.deleted) archivos.push(item);
    });
    url = data['@odata.nextLink'] || null;
    paginas += 1;
  }
  if (url) completo = false; // quedaron páginas sin recorrer por el tope de páginas

  return { archivos, completo };
}

async function handlerBuscarOneDrive(req, res) {
  const q = (req.query.q || '').trim();
  if (!q) {
    return res.status(400).json({ error: 'Falta el término de búsqueda (parámetro "q").' });
  }
  try {
    const accessToken = await getMicrosoftAccessToken(
      'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Calendars.Read https://graph.microsoft.com/Files.Read offline_access'
    );
    const { archivos: todos, completo } = await listarTodosLosArchivos(accessToken);

    // Búsqueda por nombre: cada palabra escrita debe aparecer en el nombre
    // del archivo (sin importar mayúsculas/tildes), así "informe 2026"
    // encuentra "Informe_Financiero_2026.pdf".
    const palabras = q.toLowerCase().split(/\s+/).filter(Boolean);
    const normalizar = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const palabrasNorm = palabras.map(normalizar);
    const coincide = (nombre) => {
      const nombreNorm = normalizar(nombre);
      return palabrasNorm.every((p) => nombreNorm.includes(p));
    };

    const resultados = todos
      .filter((item) => coincide(item.name))
      .sort((a, b) => new Date(b.lastModifiedDateTime) - new Date(a.lastModifiedDateTime))
      .slice(0, 50)
      .map((item) => {
        const tipo = tipoDeArchivo(item.name);
        return {
          id: item.id,
          nombre: item.name,
          tipoEtiqueta: tipo.etiqueta,
          tipoIcono: tipo.icono,
          tipoColor: tipo.color,
          tamano: formatoTamano(item.size),
          modificado: item.lastModifiedDateTime,
          carpeta: decodeURIComponent(item.parentReference?.path?.replace(/^\/drive\/root:/, '') || ''),
          webUrl: item.webUrl,
          // El análisis solo tiene sentido para formatos de los que se
          // puede extraer texto de forma confiable.
          analizable: /\.(docx|xlsx|xls|csv|pdf|txt)$/i.test(item.name),
        };
      });
    return res.status(200).json({
      ok: true,
      resultados,
      avisoIncompleto: completo ? null : 'Tienes tantos archivos en OneDrive que no alcancé a revisarlos todos en el tiempo disponible — puede que falten algunos resultados. Prueba con un término más específico.',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error buscando en OneDrive.' });
  }
}

// --- Análisis de archivo: datos generales + resumen ejecutivo ---

// pdf-parse, importado así (apuntando directo al módulo interno en vez del
// índice del paquete), evita que intente leer un PDF de prueba propio al
// cargarse — un problema conocido de esa librería en entornos serverless.
async function extraerTextoPDF(buffer) {
  const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
  const data = await pdfParse(buffer);
  return data.text;
}

function extraerTextoXLSX(buffer) {
  const libro = XLSX.read(buffer, { type: 'buffer' });
  const partes = [];
  libro.SheetNames.slice(0, 5).forEach((nombreHoja) => {
    const hoja = libro.Sheets[nombreHoja];
    const csv = XLSX.utils.sheet_to_csv(hoja, { blankrows: false });
    partes.push(`Hoja "${nombreHoja}":\n${csv.slice(0, 4000)}`);
  });
  return partes.join('\n\n');
}

async function extraerTexto(nombre, buffer) {
  const ext = (nombre.split('.').pop() || '').toLowerCase();
  if (ext === 'docx') {
    const resultado = await mammoth.extractRawText({ buffer });
    return resultado.value;
  }
  if (ext === 'xlsx' || ext === 'xls') {
    return extraerTextoXLSX(buffer);
  }
  if (ext === 'csv' || ext === 'txt') {
    return buffer.toString('utf8');
  }
  if (ext === 'pdf') {
    return await extraerTextoPDF(buffer);
  }
  return null;
}

async function resumenEjecutivo(texto) {
  const { GROQ_API_KEY } = process.env;
  if (!GROQ_API_KEY) {
    throw new Error('Falta la variable de entorno GROQ_API_KEY.');
  }
  const textoRecortado = texto.slice(0, 4000);
  const resp = await fetchConTimeout('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: 'Eres un asistente ejecutivo. Resume el documento en español, en un tono directo y profesional, en 4 a 6 viñetas cortas con los puntos más importantes (de qué trata, cifras o fechas clave si las hay, y cualquier acción o decisión pendiente). No agregues introducción ni cierre, solo las viñetas.',
        },
        { role: 'user', content: textoRecortado },
      ],
      temperature: 0.3,
      max_tokens: 350,
    }),
  }, 20000);
  if (!resp.ok) {
    const detalle = await resp.text().catch(() => '');
    throw new Error(`No se pudo generar el resumen (${resp.status}): ${detalle.slice(0, 200)}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

async function handlerAnalisisOneDrive(req, res) {
  const id = req.query.id;
  if (!id) {
    return res.status(400).json({ error: 'Falta el identificador del archivo (parámetro "id").' });
  }
  try {
    const accessToken = await getMicrosoftAccessToken(
      'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Calendars.Read https://graph.microsoft.com/Files.Read offline_access'
    );

    const metaResp = await fetchConTimeout(
      `https://graph.microsoft.com/v1.0/me/drive/items/${id}?$select=id,name,size,createdDateTime,lastModifiedDateTime,createdBy,lastModifiedBy,webUrl`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      8000
    );
    if (!metaResp.ok) {
      const detalle = await metaResp.text().catch(() => '');
      return res.status(502).json({ error: `OneDrive respondió con error (${metaResp.status}) al leer los datos del archivo.`, detalle });
    }
    const meta = await metaResp.json();

    const datosGenerales = {
      nombre: meta.name,
      tamano: formatoTamano(meta.size),
      creado: meta.createdDateTime,
      modificado: meta.lastModifiedDateTime,
      autor: meta.createdBy?.user?.displayName || null,
      ultimaEdicionPor: meta.lastModifiedBy?.user?.displayName || null,
      webUrl: meta.webUrl,
    };

    const ext = (meta.name.split('.').pop() || '').toLowerCase();
    if (!/^(docx|xlsx|xls|csv|pdf|txt)$/.test(ext)) {
      return res.status(200).json({
        ok: true,
        datosGenerales,
        resumen: null,
        disponible: false,
        motivo: `El resumen automático no está disponible para archivos .${ext} todavía — solo Word, Excel, CSV, texto plano y PDF.`,
      });
    }

    const contenidoResp = await fetchConTimeout(
      `https://graph.microsoft.com/v1.0/me/drive/items/${id}/content`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      15000
    );
    if (!contenidoResp.ok) {
      return res.status(200).json({
        ok: true,
        datosGenerales,
        resumen: null,
        disponible: false,
        motivo: 'No se pudo descargar el contenido del archivo para analizarlo.',
      });
    }
    const arrayBuffer = await contenidoResp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let texto;
    try {
      texto = await extraerTexto(meta.name, buffer);
    } catch (err) {
      return res.status(200).json({
        ok: true,
        datosGenerales,
        resumen: null,
        disponible: false,
        motivo: `No se pudo leer el contenido de este archivo (puede ser un PDF escaneado sin texto, o un formato dañado): ${err.message}`,
      });
    }

    if (!texto || !texto.trim()) {
      return res.status(200).json({
        ok: true,
        datosGenerales,
        resumen: null,
        disponible: false,
        motivo: 'El archivo no tiene texto que se pueda extraer (por ejemplo, un PDF con solo imágenes escaneadas).',
      });
    }

    const resumen = await resumenEjecutivo(texto);
    return res.status(200).json({ ok: true, datosGenerales, resumen, disponible: true, motivo: null });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error analizando el archivo.' });
  }
}

// --- Modo "Preguntar a mis documentos" (RAG) ---
//
// No arma un índice permanente de todo OneDrive (eso sería sobre-ingeniería
// para el volumen de documentos de una persona, y necesitaría una base de
// datos vectorial aparte). En vez de eso, arma el contexto "al vuelo" cada
// vez que se pregunta:
//   1. Busca en OneDrive los archivos candidatos para la pregunta.
//   2. Le extrae el texto a los que sean legibles (mismo extractor que usa
//      el botón "¿Análisis?").
//   3. Le pide al modelo que responda SOLO con lo que encuentre en esos
//      documentos, citando de cuál salió cada dato.
// Funciona bien cuando la búsqueda por palabra clave ya acerca los
// documentos correctos (algunas decenas como mucho); no reemplaza un
// índice vectorial real si algún día hace falta preguntar "a ciegas" sobre
// todo un OneDrive de miles de archivos.

const MAX_CANDIDATOS_RAG = 5;
const MAX_CARACTERES_POR_DOC = 900;

// --- Fuentes adicionales para "Preguntar a mis documentos": correos y agenda ---
//
// A diferencia de OneDrive, la búsqueda nativa de Gmail y de correo en
// Microsoft Graph SÍ es confiable (es la limitación de /search que era
// específica de archivos en OneDrive personal, no de correo) — así que acá
// sí se usa el buscador de cada servicio directamente, en vez de listar
// todo a mano.

const MAX_CORREOS_RAG = 3;
const MAX_EVENTOS_RAG = 5;
const MAX_CARACTERES_CORREO = 600;

function extraerCuerpoGmail(payload) {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf8');
  }
  if (payload.parts) {
    // Prioriza texto plano; si no hay, cae a HTML y le saca las etiquetas.
    const plano = payload.parts.find((p) => p.mimeType === 'text/plain');
    if (plano?.body?.data) return Buffer.from(plano.body.data, 'base64').toString('utf8');
    for (const parte of payload.parts) {
      const texto = extraerCuerpoGmail(parte);
      if (texto) return texto;
    }
  }
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    const html = Buffer.from(payload.body.data, 'base64').toString('utf8');
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  }
  return '';
}

// Mismo criterio de "prefiere 2+ palabras clave" que documentos y agenda —
// se aplica después de traer los resultados de Gmail/Outlook (que hacen su
// propia búsqueda "OR", bastante más laxa) para no mostrar como fuente un
// correo que solo calzó por una palabra suelta y muy genérica.
function filtrarPorRelevancia(items, palabrasClave, obtenerTexto) {
  if (palabrasClave.length < 2) return items; // con 1 sola palabra no hay nada que priorizar
  const normalizar = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const puntuados = items.map((item) => {
    const texto = normalizar(obtenerTexto(item));
    const puntaje = palabrasClave.reduce((acc, p) => acc + (texto.includes(p) ? 1 : 0), 0);
    return { item, puntaje };
  });
  const conVarias = puntuados.filter((p) => p.puntaje >= 2);
  const mejorGrupo = conVarias.length > 0 ? conVarias : puntuados;
  return mejorGrupo.sort((a, b) => b.puntaje - a.puntaje).map((p) => p.item);
}

async function buscarCorreosGmail(palabrasClave) {
  if (palabrasClave.length === 0) return [];
  try {
    const accessToken = await getGoogleAccessToken();
    // Gmail entiende palabras clave, no una pregunta completa en lenguaje
    // natural — "puedes mostrarme los correos de LinkedIn?" no encuentra
    // nada, pero "linkedin" sí. Se unen con OR para que baste con que
    // aparezca alguna, no todas (el filtro de relevancia de abajo se
    // encarga de priorizar los que calzan con varias).
    const consulta = palabrasClave.map((p) => `"${p}"`).join(' OR ');
    const resp = await fetchConTimeout(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(consulta)}&maxResults=${MAX_CORREOS_RAG * 3}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      8000
    );
    if (!resp.ok) {
      console.error('buscarCorreosGmail: respuesta', resp.status, await resp.text().catch(() => ''));
      return [];
    }
    const data = await resp.json();
    const ids = (data.messages || []).slice(0, MAX_CORREOS_RAG * 3);
    const detalles = await Promise.all(ids.map(async (m) => {
      const r = await fetchConTimeout(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
        8000
      );
      if (!r.ok) return null;
      const d = await r.json();
      const headers = d.payload?.headers || [];
      const asunto = headers.find((h) => h.name === 'Subject')?.value || '(sin asunto)';
      const de = (headers.find((h) => h.name === 'From')?.value || '').replace(/<.*>/, '').trim();
      const cuerpo = extraerCuerpoGmail(d.payload).slice(0, MAX_CARACTERES_CORREO);
      if (!cuerpo.trim()) return null;
      const fechaRecibido = d.internalDate
        ? new Date(Number(d.internalDate)).toLocaleString('es-CL', { timeZone: 'America/Santiago', dateStyle: 'medium', timeStyle: 'short' })
        : 'fecha desconocida';
      return {
        tipo: 'Correo', fuente: 'Gmail',
        nombre: `${asunto} (de ${de}, recibido ${fechaRecibido})`,
        texto: `Recibido: ${fechaRecibido}\n${cuerpo}`,
        webUrl: null,
        _asunto: asunto,
      };
    }));
    const validos = detalles.filter(Boolean);
    return filtrarPorRelevancia(validos, palabrasClave, (c) => `${c._asunto} ${c.texto}`).slice(0, MAX_CORREOS_RAG);
  } catch (err) {
    console.error('buscarCorreosGmail: falló', err);
    return [];
  }
}

async function buscarCorreosOutlook(palabrasClave) {
  if (palabrasClave.length === 0) return [];
  try {
    const accessToken = await getMicrosoftAccessToken();
    // $search de Graph funciona mejor con un puñado de palabras clave que
    // con una oración completa — mismo motivo que en Gmail.
    const consulta = palabrasClave.join(' ');
    const resp = await fetchConTimeout(
      `https://graph.microsoft.com/v1.0/me/messages?$search="${encodeURIComponent(consulta)}"&$top=${MAX_CORREOS_RAG * 3}&$select=subject,from,receivedDateTime,body,webLink`,
      { headers: { Authorization: `Bearer ${accessToken}`, ConsistencyLevel: 'eventual' } },
      8000
    );
    if (!resp.ok) {
      console.error('buscarCorreosOutlook: respuesta', resp.status, await resp.text().catch(() => ''));
      return [];
    }
    const data = await resp.json();
    const validos = (data.value || []).map((m) => {
      const asunto = m.subject || '(sin asunto)';
      const de = m.from?.emailAddress?.name || m.from?.emailAddress?.address || '';
      const htmlOTexto = m.body?.content || '';
      const cuerpo = htmlOTexto.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_CARACTERES_CORREO);
      if (!cuerpo) return null;
      const fechaRecibido = m.receivedDateTime
        ? new Date(m.receivedDateTime).toLocaleString('es-CL', { timeZone: 'America/Santiago', dateStyle: 'medium', timeStyle: 'short' })
        : 'fecha desconocida';
      return {
        tipo: 'Correo', fuente: 'Outlook',
        nombre: `${asunto} (de ${de}, recibido ${fechaRecibido})`,
        texto: `Recibido: ${fechaRecibido}\n${cuerpo}`,
        webUrl: m.webLink || null,
        _asunto: asunto,
      };
    }).filter(Boolean);
    return filtrarPorRelevancia(validos, palabrasClave, (c) => `${c._asunto} ${c.texto}`).slice(0, MAX_CORREOS_RAG);
  } catch (err) {
    console.error('buscarCorreosOutlook: falló', err);
    return [];
  }
}

async function buscarEventosRelevantes(pregunta, palabrasClave) {
  const ahora = new Date();
  // Cubre todo el año en curso (no solo unos meses para cada lado) — así
  // encuentra tanto reuniones ya pasadas de este año como las agendadas
  // para más adelante.
  const anioActual = ahora.getFullYear();
  const desde = new Date(Date.UTC(anioActual, 0, 1, 0, 0, 0));
  const hasta = new Date(Date.UTC(anioActual, 11, 31, 23, 59, 59));
  const normalizar = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Puntaje por cuántas palabras clave calzan (no solo sí/no) — así un
  // evento que calza con 3 palabras ("reunión", "alejandro", "aguilera")
  // le gana el cupo a uno que solo calza con 1 ("reunión" a secas).
  const puntaje = (texto) => {
    const n = normalizar(texto || '');
    return palabrasClave.reduce((acc, p) => acc + (n.includes(p) ? 1 : 0), 0);
  };

  const puntuados = [];
  // Diagnóstico visible en la propia respuesta — para no depender de ir a
  // buscar en los logs de Vercel cada vez que algo falla en silencio.
  const diagnostico = { google: 'no intentado', outlook: 'no intentado' };

  try {
    const accessToken = await getGoogleAccessToken();
    const params = new URLSearchParams({
      timeMin: desde.toISOString(), timeMax: hasta.toISOString(),
      singleEvents: 'true', orderBy: 'startTime', maxResults: '2500',
    });
    const resp = await fetchConTimeout(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      8000
    );
    if (resp.ok) {
      const data = await resp.json();
      let coincidencias = 0;
      (data.items || []).forEach((e) => {
        const p = puntaje(`${e.summary} ${e.description || ''}`);
        if (p > 0) {
          coincidencias += 1;
          puntuados.push({
            puntaje: p,
            evento: {
              tipo: 'Agenda', fuente: 'Google',
              nombre: e.summary || '(sin título)',
              texto: `Fecha: ${e.start?.dateTime || e.start?.date}. ${e.description || ''}`.slice(0, 500),
              webUrl: e.htmlLink || null,
            },
          });
        }
      });
      diagnostico.google = `OK: ${data.items?.length || 0} eventos revisados, ${coincidencias} calzaron`;
    } else {
      diagnostico.google = `Error ${resp.status}: ${(await resp.text().catch(() => '')).slice(0, 150)}`;
    }
  } catch (err) {
    diagnostico.google = `Excepción: ${err.message}`;
  }

  try {
    const accessToken = await getMicrosoftAccessToken();
    const params = new URLSearchParams({ startDateTime: desde.toISOString(), endDateTime: hasta.toISOString(), $top: '999' });
    const resp = await fetchConTimeout(
      `https://graph.microsoft.com/v1.0/me/calendarView?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      11000
    );
    if (resp.ok) {
      const data = await resp.json();
      let coincidencias = 0;
      (data.value || []).forEach((e) => {
        const p = puntaje(`${e.subject} ${e.bodyPreview || ''}`);
        if (p > 0) {
          coincidencias += 1;
          puntuados.push({
            puntaje: p,
            evento: {
              tipo: 'Agenda', fuente: 'Outlook',
              nombre: e.subject || '(sin título)',
              texto: `Fecha: ${e.start?.dateTime}. ${e.bodyPreview || ''}`.slice(0, 500),
              webUrl: e.webLink || null,
            },
          });
        }
      });
      diagnostico.outlook = `OK: ${data.value?.length || 0} eventos revisados, ${coincidencias} calzaron`;
    } else {
      diagnostico.outlook = `Error ${resp.status}: ${(await resp.text().catch(() => '')).slice(0, 150)}`;
    }
  } catch (err) {
    diagnostico.outlook = `Excepción: ${err.message}`;
  }

  // Mismo criterio que en los documentos: si hay varios que calzan con 2
  // palabras o más, esos ganan por sobre los que solo calzan con una
  // palabra genérica ("reunión" sola aparece en decenas de eventos).
  const conVarias = puntuados.filter((p) => p.puntaje >= 2);
  const mejorGrupo = conVarias.length > 0 ? conVarias : puntuados;

  const eventos = mejorGrupo
    .sort((a, b) => b.puntaje - a.puntaje)
    .slice(0, MAX_EVENTOS_RAG)
    .map((p) => p.evento);

  return { eventos, diagnostico };
}

async function handlerPreguntarOneDrive(req, res) {
  const pregunta = (req.query.q || '').trim();
  // 'todos' (comportamiento anterior), 'documentos', 'correos' o 'agenda'
  // — separar por botón evita que el ruido de una fuente tape los
  // resultados de otra, y de paso cada búsqueda es más rápida.
  const fuente = req.query.fuente || 'todos';
  if (!pregunta) {
    return res.status(400).json({ error: 'Falta la pregunta (parámetro "q").' });
  }
  try {
    const accessToken = await getMicrosoftAccessToken(
      'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Calendars.Read https://graph.microsoft.com/Files.Read offline_access'
    );

    const STOPWORDS = new Set(['que', 'los', 'las', 'del', 'con', 'para', 'por', 'una', 'unos', 'unas', 'como', 'donde', 'cuando', 'sobre', 'este', 'esta', 'estos', 'estas', 'tiene', 'tengo']);
    const normalizar = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const palabrasClave = normalizar(pregunta)
      .split(/[^a-z0-9áéíóúñ]+/i)
      .filter((p) => p.length > 2 && !STOPWORDS.has(p));

    const quiereDocumentos = fuente === 'todos' || fuente === 'documentos';
    const quiereCorreos = fuente === 'todos' || fuente === 'correos';
    const quiereAgenda = fuente === 'todos' || fuente === 'agenda';

    const SIN_RESULTADOS = { archivos: [], completo: true };
    const SIN_EVENTOS = { eventos: [], diagnostico: { google: 'no consultado (fuente no pedida)', outlook: 'no consultado (fuente no pedida)' } };

    // Las búsquedas arrancan a la vez en vez de una tras otra — con el
    // listado de OneDrive solo, que ya puede tomar hasta 22 segundos por sí
    // solo, hacer todo en cadena se pasaba del límite de 30 segundos que
    // permite Vercel y la función terminaba cayéndose. Acá además solo se
    // consultan las fuentes que el botón elegido realmente pidió.
    const [{ archivos: todos, completo }, correosGmail, correosOutlook, { eventos, diagnostico: diagnosticoAgenda }] = await Promise.all([
      quiereDocumentos ? listarTodosLosArchivos(accessToken, 12000) : Promise.resolve(SIN_RESULTADOS),
      quiereCorreos ? buscarCorreosGmail(palabrasClave) : Promise.resolve([]),
      quiereCorreos ? buscarCorreosOutlook(palabrasClave) : Promise.resolve([]),
      quiereAgenda ? buscarEventosRelevantes(pregunta, palabrasClave) : Promise.resolve(SIN_EVENTOS),
    ]);
    const correos = [...correosGmail, ...correosOutlook];

    const analizables = todos.filter((item) => /\.(docx|xlsx|xls|csv|pdf|txt)$/i.test(item.name));

    // Igual que en handlerBuscarOneDrive, esto no depende del buscador de
    // Graph (poco confiable en cuentas personales) — se puntúa cada archivo
    // por cuántas palabras de la pregunta aparecen en su nombre o carpeta,
    // sin exigir que coincidan todas (una pregunta en lenguaje natural rara
    // vez calza palabra por palabra con el nombre del archivo).
    const puntuados = analizables.map((item) => {
      const textoBusqueda = normalizar(`${item.name} ${item.parentReference?.path || ''}`);
      const puntaje = palabrasClave.reduce((acc, p) => acc + (textoBusqueda.includes(p) ? 1 : 0), 0);
      return { item, puntaje };
    });

    const conCoincidencias = puntuados.filter((p) => p.puntaje > 0);
    // Cuando hay varias palabras clave, se prioriza a los que calzan con 2
    // o más — así una palabra genérica sola (ej. "reunión", que aparece en
    // cientos de archivos) no llena los cupos y tapa al que sí calza con
    // el nombre completo de la persona/tema. Solo se baja la exigencia a 1
    // palabra si nadie llega a 2.
    const conVariasCoincidencias = conCoincidencias.filter((p) => p.puntaje >= 2);
    const mejorGrupo = conVariasCoincidencias.length > 0 ? conVariasCoincidencias : conCoincidencias;
    const listaOrdenada = (mejorGrupo.length > 0 ? mejorGrupo : puntuados)
      .sort((a, b) => b.puntaje - a.puntaje || new Date(b.item.lastModifiedDateTime) - new Date(a.item.lastModifiedDateTime));

    const candidatos = listaOrdenada.slice(0, MAX_CANDIDATOS_RAG).map((p) => p.item);
    // Si nada calzó por nombre, se avisa que la respuesta es sobre los
    // documentos más recientes en vez de fingir que encontró justo lo que
    // se preguntó.
    const usoRespaldo = conCoincidencias.length === 0;

    // Si no hay candidatos de OneDrive no se corta la búsqueda — puede que
    // la respuesta esté en un correo o en la agenda igual.
    const documentos = candidatos.length === 0 ? [] : await Promise.all(candidatos.map(async (item) => {
      try {
        const contenidoResp = await fetchConTimeout(
          `https://graph.microsoft.com/v1.0/me/drive/items/${item.id}/content`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
          10000
        );
        if (!contenidoResp.ok) return null;
        const buffer = Buffer.from(await contenidoResp.arrayBuffer());
        const texto = await extraerTexto(item.name, buffer);
        if (!texto || !texto.trim()) return null;
        return { nombre: item.name, webUrl: item.webUrl, texto: texto.slice(0, MAX_CARACTERES_POR_DOC) };
      } catch {
        return null;
      }
    }));

    const documentosValidos = documentos.filter(Boolean);

    if (documentosValidos.length === 0 && correos.length === 0 && eventos.length === 0) {
      return res.status(200).json({
        ok: true,
        respuesta: 'No encontré nada relacionado con esa pregunta en tus documentos, correos ni agenda.',
        fuentes: [],
      });
    }

    const bloques = [
      ...documentosValidos.map((d) => ({ ...d, tipo: 'Documento', fuente: 'OneDrive' })),
      ...correos,
      ...eventos,
    ];

    const contexto = bloques
      .map((b, i) => `[${b.tipo} ${i + 1} — ${b.fuente} — "${b.nombre}"]\n${b.texto}`)
      .join('\n\n---\n\n')
      // Tope de seguridad final: aunque cada fuente ya viene recortada, la
      // suma de varias fuentes igual puede acercarse al límite de 6.000
      // tokens por minuto del modelo liviano — mejor recortar el contexto
      // que dejar que la IA falle con un error de "solicitud muy grande".
      .slice(0, 14000);

    const { GROQ_API_KEY } = process.env;
    if (!GROQ_API_KEY) throw new Error('Falta la variable de entorno GROQ_API_KEY.');

    const respGroq = await fetchConTimeout('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'Eres un asistente que responde preguntas usando la información que se te entrega a continuación — puede venir de documentos de OneDrive, correos (Gmail/Outlook) o eventos de calendario (Google/Outlook). Si algo de lo entregado es relevante para la pregunta, aunque no calce perfecto en cada detalle (por ejemplo la fecha exacta), menciónalo igual y aclara en qué no calza — no digas "no hay información" si hay algo relacionado en el material entregado. Solo di que no encontraste nada si de verdad no hay ningún dato relacionado. Responde en español, directo, y menciona entre paréntesis de dónde sale cada dato importante (ej: "(correo de Gmail: Reunión Alejandro Aguilera)" o "(documento: CV_Daniel...)" o "(agenda: Reunión networking, 24 jul)").',
          },
          { role: 'user', content: `${contexto}\n\nPregunta: ${pregunta}` },
        ],
        temperature: 0.2,
        max_tokens: 400,
      }),
    }, 25000);

    if (!respGroq.ok) {
      const detalle = await respGroq.text().catch(() => '');
      throw new Error(`No se pudo generar la respuesta (${respGroq.status}): ${detalle.slice(0, 200)}`);
    }
    const dataGroq = await respGroq.json();
    const respuesta = dataGroq.choices?.[0]?.message?.content?.trim() || 'No se generó una respuesta.';

    return res.status(200).json({
      ok: true,
      respuesta,
      fuentes: bloques.map((b) => ({ nombre: b.nombre, webUrl: b.webUrl, tipo: b.tipo, origen: b.fuente })),
      avisoRespaldo: usoRespaldo && documentosValidos.length > 0
        ? 'Ningún nombre de archivo coincidió con tu pregunta, así que los documentos de esta respuesta se basan en tus archivos más recientes — puede no ser justo lo que buscabas.'
        : (!completo
          ? 'Tienes tantos archivos en OneDrive que no alcancé a revisarlos todos — la respuesta puede no incluir algún documento relevante que quedó fuera.'
          : null),
      diagnosticoAgenda,
    });
  } catch (err) {
    console.error('handlerPreguntarOneDrive error:', err);
    return res.status(500).json({ error: err.message || 'Error respondiendo la pregunta.' });
  }
}

// --- Comparador de CV contra un aviso de trabajo ---
//
// Encuentra tus CVs en OneDrive (por nombre de archivo), les extrae el
// texto, y le pide al modelo que los evalúe contra el aviso que pegaste:
// cuál calza mejor, por qué, y una sugerencia de ajustes. Mismo mecanismo
// de extracción que usan "¿Análisis?" y "Preguntar a mis documentos".

const MAX_CVS_COMPARAR = 6;
const MAX_CARACTERES_CV = 900;

async function handlerCompararCV(req, res) {
  const aviso = (req.body?.aviso || '').trim();
  const filtro = (req.body?.filtro || '').trim();
  const archivoSubidoBase64 = req.body?.archivoBase64;
  const archivoSubidoNombre = req.body?.archivoNombre;
  if (!aviso) {
    return res.status(400).json({ error: 'Falta el texto del aviso de trabajo.' });
  }
  try {
    let cvsValidos;
    let avisoIncompleto = null;

    if (archivoSubidoBase64 && archivoSubidoNombre) {
      // Camino directo: el archivo se subió desde el computador, no hace
      // falta tocar OneDrive en absoluto para esta comparación — más
      // rápido y sin depender de que el listado de archivos alcance a
      // encontrarlo.
      try {
        const buffer = Buffer.from(archivoSubidoBase64, 'base64');
        const texto = await extraerTexto(archivoSubidoNombre, buffer);
        if (!texto || !texto.trim()) {
          return res.status(200).json({
            ok: true,
            evaluacion: 'No pude leer el contenido de ese archivo (puede ser un PDF escaneado sin texto, o un formato dañado).',
            cvs: [],
          });
        }
        cvsValidos = [{ nombre: archivoSubidoNombre, webUrl: null, texto: texto.slice(0, MAX_CARACTERES_CV) }];
      } catch (err) {
        return res.status(200).json({
          ok: true,
          evaluacion: `No pude leer el contenido de ese archivo: ${err.message}`,
          cvs: [],
        });
      }
    } else {
      // Camino de siempre: buscar en OneDrive (por nombre exacto si se dio
      // un filtro, o auto-detectando archivos que parecen CV si no).
      const accessToken = await getMicrosoftAccessToken(
        'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Calendars.Read https://graph.microsoft.com/Files.Read offline_access'
      );
      const { archivos: todos, completo } = await listarTodosLosArchivos(accessToken);
      const normalizar = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      let candidatos;
      if (filtro) {
        const filtroNorm = normalizar(filtro);
        candidatos = todos
          .filter((item) => /\.(docx|xlsx|xls|csv|pdf|txt)$/i.test(item.name) && normalizar(item.name).includes(filtroNorm))
          .sort((a, b) => new Date(b.lastModifiedDateTime) - new Date(a.lastModifiedDateTime))
          .slice(0, MAX_CVS_COMPARAR);
      } else {
        const esCV = (nombre) => {
          const n = normalizar(nombre);
          return (n.includes('cv') || n.includes('resume')) && /\.(docx|pdf|txt)$/i.test(nombre);
        };
        candidatos = todos
          .filter((item) => esCV(item.name))
          .sort((a, b) => new Date(b.lastModifiedDateTime) - new Date(a.lastModifiedDateTime))
          .slice(0, MAX_CVS_COMPARAR);
      }

      if (candidatos.length === 0) {
        return res.status(200).json({
          ok: true,
          evaluacion: filtro
            ? `No encontré ningún archivo cuyo nombre contenga "${filtro}" — si sabes que existe, prueba subiéndolo directo con el botón "Subir archivo" en vez de buscarlo por nombre.`
            : 'No encontré archivos que parezcan CVs en tu OneDrive (busco archivos Word, PDF o texto con "CV" o "resume" en el nombre). Prueba escribiendo el nombre exacto, o sube el archivo directo.',
          cvs: [],
        });
      }

      const cvsConTexto = await Promise.all(candidatos.map(async (item) => {
        try {
          const contenidoResp = await fetchConTimeout(
            `https://graph.microsoft.com/v1.0/me/drive/items/${item.id}/content`,
            { headers: { Authorization: `Bearer ${accessToken}` } },
            15000
          );
          if (!contenidoResp.ok) return null;
          const buffer = Buffer.from(await contenidoResp.arrayBuffer());
          const texto = await extraerTexto(item.name, buffer);
          if (!texto || !texto.trim()) return null;
          return { nombre: item.name, webUrl: item.webUrl, texto: texto.slice(0, MAX_CARACTERES_CV) };
        } catch {
          return null;
        }
      }));

      cvsValidos = cvsConTexto.filter(Boolean);
      if (cvsValidos.length === 0) {
        return res.status(200).json({
          ok: true,
          evaluacion: 'Encontré archivos, pero no pude leer el contenido de ninguno (formato dañado o PDF escaneado sin texto).',
          cvs: candidatos.map((c) => ({ nombre: c.name, webUrl: c.webUrl })),
        });
      }
      avisoIncompleto = completo ? null : 'Tienes tantos archivos en OneDrive que puede que no haya revisado todas tus versiones de CV.';
    }

    const contexto = cvsValidos
      .map((d, i) => `[CV ${i + 1}: "${d.nombre}"]\n${d.texto}`)
      .join('\n\n---\n\n');

    const { GROQ_API_KEY } = process.env;
    if (!GROQ_API_KEY) throw new Error('Falta la variable de entorno GROQ_API_KEY.');

    const respGroq = await fetchConTimeout('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'Eres un reclutador ejecutivo experto en perfiles senior/C-level. Te doy un aviso de trabajo y una o varias versiones de CV de la misma persona. Para cada CV, dale un puntaje del 1 al 10 de qué tan bien calza con el aviso y una razón breve (1-2 líneas). Al final, indica claramente cuál CV es el mejor punto de partida para postular a ESTE aviso específico (o, si solo hay uno, evalúalo igual y da tu veredicto), y da 2-3 sugerencias concretas de ajuste (qué destacar, qué agregar o reordenar) para mejorar el calce. Responde en español, directo, en formato de lista. Usa el nombre real de cada CV (no "CV 1").',
          },
          { role: 'user', content: `AVISO DE TRABAJO:\n${aviso.slice(0, 2500)}\n\n${contexto}` },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    }, 25000);

    if (!respGroq.ok) {
      const detalle = await respGroq.text().catch(() => '');
      throw new Error(`No se pudo generar la evaluación (${respGroq.status}): ${detalle.slice(0, 200)}`);
    }
    const dataGroq = await respGroq.json();
    const evaluacion = dataGroq.choices?.[0]?.message?.content?.trim() || 'No se generó una respuesta.';

    return res.status(200).json({
      ok: true,
      evaluacion,
      cvs: cvsValidos.map((d) => ({ nombre: d.nombre, webUrl: d.webUrl })),
      avisoIncompleto,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error comparando los CVs.' });
  }
}

export default async function handler(req, res) {
  if (req.method === 'POST' && req.query.tipo === 'onedrive-comparar-cv') {
    return handlerCompararCV(req, res);
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  if (req.query.tipo === 'onedrive') {
    return handlerBuscarOneDrive(req, res);
  }

  if (req.query.tipo === 'onedrive-analisis') {
    return handlerAnalisisOneDrive(req, res);
  }

  if (req.query.tipo === 'onedrive-preguntar') {
    return handlerPreguntarOneDrive(req, res);
  }

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=180');

  const [gmail, outlook] = await Promise.all([getGmailUnread(), getOutlookUnread()]);

  return res.status(200).json({ gmail, outlook });
}
