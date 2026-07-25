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

async function listarTodosLosArchivos(accessToken) {
  const archivos = [];
  let url = 'https://graph.microsoft.com/v1.0/me/drive/root/delta?$select=id,name,webUrl,size,createdDateTime,lastModifiedDateTime,createdBy,lastModifiedBy,file,folder,parentReference,deleted';
  let paginas = 0;
  const inicio = Date.now();
  let completo = true;

  while (url && paginas < MAX_PAGINAS_DELTA) {
    if (Date.now() - inicio > PRESUPUESTO_TIEMPO_DELTA_MS) {
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
  const textoRecortado = texto.slice(0, 12000);
  const resp = await fetchConTimeout('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'Eres un asistente ejecutivo. Resume el documento en español, en un tono directo y profesional, en 4 a 6 viñetas cortas con los puntos más importantes (de qué trata, cifras o fechas clave si las hay, y cualquier acción o decisión pendiente). No agregues introducción ni cierre, solo las viñetas.',
        },
        { role: 'user', content: textoRecortado },
      ],
      temperature: 0.3,
      max_tokens: 500,
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

const MAX_CANDIDATOS_RAG = 12;
const MAX_CARACTERES_POR_DOC = 3000;

async function handlerPreguntarOneDrive(req, res) {
  const pregunta = (req.query.q || '').trim();
  if (!pregunta) {
    return res.status(400).json({ error: 'Falta la pregunta (parámetro "q").' });
  }
  try {
    const accessToken = await getMicrosoftAccessToken(
      'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Calendars.Read https://graph.microsoft.com/Files.Read offline_access'
    );

    const { archivos: todos, completo } = await listarTodosLosArchivos(accessToken);
    const analizables = todos.filter((item) => /\.(docx|xlsx|xls|csv|pdf|txt)$/i.test(item.name));

    // Igual que en handlerBuscarOneDrive, esto no depende del buscador de
    // Graph (poco confiable en cuentas personales) — se puntúa cada archivo
    // por cuántas palabras de la pregunta aparecen en su nombre o carpeta,
    // sin exigir que coincidan todas (una pregunta en lenguaje natural rara
    // vez calza palabra por palabra con el nombre del archivo).
    const STOPWORDS = new Set(['que', 'los', 'las', 'del', 'con', 'para', 'por', 'una', 'unos', 'unas', 'como', 'donde', 'cuando', 'sobre', 'este', 'esta', 'estos', 'estas', 'tiene', 'tengo']);
    const normalizar = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const palabrasClave = normalizar(pregunta)
      .split(/[^a-z0-9áéíóúñ]+/i)
      .filter((p) => p.length > 2 && !STOPWORDS.has(p));

    const puntuados = analizables.map((item) => {
      const textoBusqueda = normalizar(`${item.name} ${item.parentReference?.path || ''}`);
      const puntaje = palabrasClave.reduce((acc, p) => acc + (textoBusqueda.includes(p) ? 1 : 0), 0);
      return { item, puntaje };
    });

    const conCoincidencias = puntuados.filter((p) => p.puntaje > 0);
    const listaOrdenada = (conCoincidencias.length > 0 ? conCoincidencias : puntuados)
      .sort((a, b) => b.puntaje - a.puntaje || new Date(b.item.lastModifiedDateTime) - new Date(a.item.lastModifiedDateTime));

    const candidatos = listaOrdenada.slice(0, MAX_CANDIDATOS_RAG).map((p) => p.item);
    // Si nada calzó por nombre, se avisa que la respuesta es sobre los
    // documentos más recientes en vez de fingir que encontró justo lo que
    // se preguntó.
    const usoRespaldo = conCoincidencias.length === 0;

    if (candidatos.length === 0) {
      return res.status(200).json({
        ok: true,
        respuesta: 'No tienes documentos en formatos que pueda leer todavía (Word, Excel, CSV, texto o PDF).',
        fuentes: [],
      });
    }

    // Descarga y extrae el texto de cada candidato en paralelo. Un documento
    // que falle (dañado, PDF escaneado, etc.) simplemente se descarta en vez
    // de tumbar toda la respuesta.
    const documentos = await Promise.all(candidatos.map(async (item) => {
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
        return { nombre: item.name, webUrl: item.webUrl, texto: texto.slice(0, MAX_CARACTERES_POR_DOC) };
      } catch {
        return null;
      }
    }));

    const documentosValidos = documentos.filter(Boolean);
    if (documentosValidos.length === 0) {
      return res.status(200).json({
        ok: true,
        respuesta: 'Encontré documentos relacionados, pero no pude leer el contenido de ninguno (pueden ser PDFs escaneados sin texto, u otro problema de formato).',
        fuentes: candidatos.map((c) => ({ nombre: c.name, webUrl: c.webUrl })),
      });
    }

    const contexto = documentosValidos
      .map((d, i) => `[Documento ${i + 1}: "${d.nombre}"]\n${d.texto}`)
      .join('\n\n---\n\n');

    const { GROQ_API_KEY } = process.env;
    if (!GROQ_API_KEY) throw new Error('Falta la variable de entorno GROQ_API_KEY.');

    const respGroq = await fetchConTimeout('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'Eres un asistente que responde preguntas SOLO con la información de los documentos que se te entregan a continuación. Si la respuesta no está en los documentos, dilo claramente en vez de inventarla. Responde en español, directo, y menciona entre paréntesis de qué documento sale cada dato importante (usa el nombre del documento, no "Documento 1").',
          },
          { role: 'user', content: `Documentos:\n\n${contexto}\n\nPregunta: ${pregunta}` },
        ],
        temperature: 0.2,
        max_tokens: 600,
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
      fuentes: documentosValidos.map((d) => ({ nombre: d.nombre, webUrl: d.webUrl })),
      avisoRespaldo: usoRespaldo
        ? 'Ningún nombre de archivo coincidió con tu pregunta, así que esta respuesta se basa en tus documentos más recientes — puede no ser justo lo que buscabas.'
        : (!completo
          ? 'Tienes tantos archivos en OneDrive que no alcancé a revisarlos todos — la respuesta puede no incluir algún documento relevante que quedó fuera.'
          : null),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error respondiendo la pregunta.' });
  }
}

export default async function handler(req, res) {
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
