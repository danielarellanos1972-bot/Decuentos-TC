// Vercel Serverless Function
// GET /api/weather
//
// Clima actual para las ubicaciones fijas de Nano, usando Open-Meteo
// (gratuito, sin API key, datos de agencias meteorológicas oficiales).

const UBICACIONES = [
  { nombre: 'Colina', lat: -33.2003, lon: -70.6746 },
  { nombre: 'Santiago (RM)', lat: -33.4489, lon: -70.6693 },
  { nombre: 'Panguipulli', lat: -39.6404, lon: -72.3355 },
  { nombre: 'Valparaíso', lat: -33.0472, lon: -71.6127 },
  { nombre: 'Quilpué', lat: -33.0458, lon: -71.4419 },
];

// Mapeo simplificado de los códigos de clima de Open-Meteo a texto + emoji
const CODIGO_CLIMA = {
  0: { texto: 'Despejado', icono: '☀️' },
  1: { texto: 'Mayormente despejado', icono: '🌤️' },
  2: { texto: 'Parcialmente nublado', icono: '⛅' },
  3: { texto: 'Nublado', icono: '☁️' },
  45: { texto: 'Neblina', icono: '🌫️' },
  48: { texto: 'Neblina helada', icono: '🌫️' },
  51: { texto: 'Llovizna leve', icono: '🌦️' },
  53: { texto: 'Llovizna', icono: '🌦️' },
  55: { texto: 'Llovizna densa', icono: '🌧️' },
  61: { texto: 'Lluvia leve', icono: '🌧️' },
  63: { texto: 'Lluvia', icono: '🌧️' },
  65: { texto: 'Lluvia intensa', icono: '🌧️' },
  71: { texto: 'Nieve leve', icono: '🌨️' },
  73: { texto: 'Nieve', icono: '🌨️' },
  75: { texto: 'Nieve intensa', icono: '❄️' },
  80: { texto: 'Chubascos leves', icono: '🌦️' },
  81: { texto: 'Chubascos', icono: '🌧️' },
  82: { texto: 'Chubascos intensos', icono: '⛈️' },
  95: { texto: 'Tormenta eléctrica', icono: '⛈️' },
};

const fetchConTimeout = (url, options, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
};

async function getClimaUbicacion(u) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${u.lat}&longitude=${u.lon}&current=temperature_2m,weather_code&timezone=America%2FSantiago`;
    const resp = await fetchConTimeout(url, {}, 3500);
    if (!resp.ok) return { nombre: u.nombre, error: true };
    const data = await resp.json();
    const temp = data?.current?.temperature_2m;
    const code = data?.current?.weather_code;
    const clima = CODIGO_CLIMA[code] || { texto: 'N/D', icono: '🌡️' };
    return {
      nombre: u.nombre,
      temp: temp != null ? Math.round(temp) : null,
      texto: clima.texto,
      icono: clima.icono,
    };
  } catch {
    return { nombre: u.nombre, error: true };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  try {
    const resultados = await Promise.all(UBICACIONES.map(getClimaUbicacion));
    return res.status(200).json({ ubicaciones: resultados });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Error obteniendo clima' });
  }
}
