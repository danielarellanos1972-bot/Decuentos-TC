// api/geocode.js
// Vercel Serverless Function
// GET /api/geocode?nombre=Concepción
// GET  /api/geocode?type=sync&key=notas
// POST /api/geocode?type=sync&key=notas   body: { valor: <cualquier dato serializable> }
//
// Dos cosas viven en este mismo archivo (en vez de uno separado) porque el
// plan gratuito de Vercel permite un máximo de 12 funciones por proyecto, y
// ya se estaba justo en el límite:
//
// 1. Geocodificación (comportamiento normal, sin parámetro "type"):
//    resuelve un nombre de ciudad/lugar a coordenadas usando el
//    geocodificador gratuito de Open-Meteo (sin API key). Se usa para que
//    Nano pueda agregar cualquier ubicación de Chile o del mundo al panel
//    de clima.
//
// 2. Sincronización entre dispositivos (?type=sync): guarda y lee datos
//    (notas, tareas, postulaciones, etc.) en Vercel KV (una base de datos
//    tipo Redis), para que lo que se agregue en el PC aparezca en el
//    celular y viceversa — antes todo vivía solo en el navegador de cada
//    dispositivo (localStorage), sin compartirse entre ellos.
//    Variables de entorno requeridas: KV_REST_API_URL, KV_REST_API_TOKEN
//    (se agregan solas al crear una base de datos KV en Vercel → Storage).

const fetchConTimeout = (url, options, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
};

async function handlerGeocode(req, res) {
  const nombre = req.query.nombre;
  if (!nombre || !String(nombre).trim()) {
    return res.status(400).json({ error: 'Falta el nombre del lugar a buscar' });
  }
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(nombre)}&count=1&language=es&format=json`;
    const resp = await fetchConTimeout(url, {}, 4000);
    if (!resp.ok) throw new Error('Error consultando el geocodificador');
    const data = await resp.json();
    const r = data?.results?.[0];
    if (!r) {
      return res.status(404).json({ error: `No se encontró "${nombre}". Prueba con otro nombre.` });
    }
    return res.status(200).json({
      nombre: r.admin1 ? `${r.name}, ${r.admin1}` : r.name,
      pais: r.country,
      lat: r.latitude,
      lon: r.longitude,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error buscando la ubicación' });
  }
}

// Prefijo para no chocar con otras claves si la misma base de datos KV se
// usa para algo más en el futuro.
const PREFIJO = 'descuentos-tc:';

async function handlerSync(req, res) {
  const { KV_REST_API_URL, KV_REST_API_TOKEN } = process.env;
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
    return res.status(200).json({
      error: 'Falta configurar la base de datos (variables KV_REST_API_URL / KV_REST_API_TOKEN en Vercel).',
    });
  }

  const key = req.query.key;
  if (!key || !/^[a-zA-Z0-9_-]+$/.test(key)) {
    return res.status(400).json({ error: 'Falta o es inválido el parámetro "key".' });
  }

  const headers = { Authorization: `Bearer ${KV_REST_API_TOKEN}` };
  const claveCompleta = `${PREFIJO}${key}`;

  try {
    if (req.method === 'GET') {
      const resp = await fetchConTimeout(
        `${KV_REST_API_URL}/get/${encodeURIComponent(claveCompleta)}`,
        { headers },
        6000
      );
      if (!resp.ok) return res.status(200).json({ valor: null, error: `La base de datos respondió con error (${resp.status}).` });
      const data = await resp.json();
      let valor = null;
      if (data.result != null) {
        try {
          valor = JSON.parse(data.result);
        } catch {
          valor = data.result;
        }
      }
      return res.status(200).json({ valor });
    }

    if (req.method === 'POST') {
      const cuerpo = JSON.stringify(req.body?.valor ?? null);
      const resp = await fetchConTimeout(
        `${KV_REST_API_URL}/set/${encodeURIComponent(claveCompleta)}`,
        { method: 'POST', headers: { ...headers, 'Content-Type': 'text/plain' }, body: cuerpo },
        6000
      );
      if (!resp.ok) return res.status(200).json({ ok: false, error: `No se pudo guardar (${resp.status}).` });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método no permitido' });
  } catch (err) {
    return res.status(200).json({ valor: null, ok: false, error: err.message || 'Error de conexión con la base de datos.' });
  }
}

export default async function handler(req, res) {
  if (req.query.type === 'sync') {
    return handlerSync(req, res);
  }
  return handlerGeocode(req, res);
}
