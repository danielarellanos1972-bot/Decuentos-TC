// Vercel Serverless Function
// GET /api/geocode?nombre=Concepción
//
// Resuelve un nombre de ciudad/lugar a coordenadas usando el geocodificador
// gratuito de Open-Meteo (sin API key). Se usa para que Nano pueda agregar
// cualquier ubicación de Chile o del mundo al panel de clima.

const fetchConTimeout = (url, options, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
};

export default async function handler(req, res) {
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
