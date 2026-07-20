// api/weather-detail.js
// Vercel Serverless Function
// GET /api/weather-detail?lat=..&lon=..&nombre=..
//
// Detalle extendido del clima para UNA ubicación puntual (se pide solo
// cuando el usuario hace clic en una ciudad, para no cargar de más).
// Misma fuente que el panel resumen: Open-Meteo, gratuito, sin API key.

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

const PUNTOS_CARDINALES = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];

function direccionViento(grados) {
  if (grados == null) return null;
  const idx = Math.round(grados / 22.5) % 16;
  return PUNTOS_CARDINALES[idx];
}

const fetchConTimeout = (url, options, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const nombre = req.query.nombre || '';

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: 'Parámetros lat/lon inválidos.' });
  }

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  try {
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,precipitation,surface_pressure,cloud_cover',
      hourly: 'temperature_2m,weather_code,precipitation_probability',
      daily: 'temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max',
      timezone: 'America/Santiago',
      forecast_days: '2',
    });

    const resp = await fetchConTimeout(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {}, 5000);
    if (!resp.ok) {
      return res.status(502).json({ error: 'Open-Meteo respondió con error.' });
    }
    const data = await resp.json();

    const code = data?.current?.weather_code;
    const clima = CODIGO_CLIMA[code] || { texto: 'N/D', icono: '🌡️' };

    // Próximas 12 horas desde la hora actual (Open-Meteo entrega el arreglo
    // completo del día; recortamos desde "ahora" para que sea relevante).
    const horas = data?.hourly?.time || [];
    const ahoraISO = data?.current?.time;
    let desde = horas.findIndex((h) => h === ahoraISO);
    if (desde === -1) desde = 0;
    const proximasHoras = horas.slice(desde, desde + 12).map((hora, i) => {
      const idx = desde + i;
      const codigoHora = data.hourly.weather_code?.[idx];
      return {
        hora,
        temp: data.hourly.temperature_2m?.[idx] != null ? Math.round(data.hourly.temperature_2m[idx]) : null,
        icono: (CODIGO_CLIMA[codigoHora] || {}).icono || '🌡️',
        probLluvia: data.hourly.precipitation_probability?.[idx] ?? null,
      };
    });

    // Visibilidad actual: Open-Meteo la entrega por hora (metros), tomamos
    // el mismo índice "ahora" que usamos para las próximas horas.
    const visibilidadM = data?.hourly?.visibility?.[desde];
    const visibilidadKm = visibilidadM != null ? Math.round(visibilidadM / 1000) : null;

    // Pronóstico de 10 días: mismo formato que "proximasHoras" pero uno por
    // día, para la franja horizontal estilo Apple Weather.
    const diasFecha = data?.daily?.time || [];
    const pronostico10Dias = diasFecha.map((fecha, i) => ({
      fecha,
      icono: (CODIGO_CLIMA[data.daily.weather_code?.[i]] || {}).icono || '🌡️',
      min: data.daily.temperature_2m_min?.[i] != null ? Math.round(data.daily.temperature_2m_min[i]) : null,
      max: data.daily.temperature_2m_max?.[i] != null ? Math.round(data.daily.temperature_2m_max[i]) : null,
      probLluvia: data.daily.precipitation_probability_max?.[i] ?? null,
    }));

    return res.status(200).json({
      nombre,
      temp: data?.current?.temperature_2m != null ? Math.round(data.current.temperature_2m) : null,
      sensacion: data?.current?.apparent_temperature != null ? Math.round(data.current.apparent_temperature) : null,
      humedad: data?.current?.relative_humidity_2m ?? null,
      viento: data?.current?.wind_speed_10m != null ? Math.round(data.current.wind_speed_10m) : null,
      vientoDireccion: direccionViento(data?.current?.wind_direction_10m),
      presion: data?.current?.surface_pressure != null ? Math.round(data.current.surface_pressure) : null,
      precipitacion: data?.current?.precipitation ?? null,
      nubosidad: data?.current?.cloud_cover != null ? Math.round(data.current.cloud_cover) : null,
      texto: clima.texto,
      icono: clima.icono,
      max: data?.daily?.temperature_2m_max?.[0] != null ? Math.round(data.daily.temperature_2m_max[0]) : null,
      min: data?.daily?.temperature_2m_min?.[0] != null ? Math.round(data.daily.temperature_2m_min[0]) : null,
      uvMax: data?.daily?.uv_index_max?.[0] ?? null,
      probLluviaMax: data?.daily?.precipitation_probability_max?.[0] ?? null,
      amanecer: data?.daily?.sunrise?.[0] || null,
      atardecer: data?.daily?.sunset?.[0] || null,
      visibilidadKm,
      proximasHoras,
      pronostico10Dias,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error obteniendo el detalle del clima.' });
  }
}
