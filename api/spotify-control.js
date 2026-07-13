// api/spotify-control.js
// Vercel Serverless Function
// POST /api/spotify-control  body: { accion: 'play' | 'pause' | 'next' | 'previous' }
//
// Controla la reproducción de Spotify (pausar, reanudar, siguiente, anterior)
// en el dispositivo activo de la cuenta. Requiere el mismo refresh_token que
// api/spotify-now-playing.js, pero con el permiso adicional
// "user-modify-playback-state" (hay que volver a autorizar la app con ese
// scope agregado si el token anterior no lo incluye).

const fetchConTimeout = (url, options, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
};

async function getAccessToken() {
  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN } = process.env;
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REFRESH_TOKEN) {
    throw new Error('Faltan las variables de entorno de Spotify.');
  }
  const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const resp = await fetchConTimeout('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: SPOTIFY_REFRESH_TOKEN,
    }),
  }, 8000);
  if (!resp.ok) throw new Error(`No se pudo renovar el token de Spotify (${resp.status}).`);
  const data = await resp.json();
  return data.access_token;
}

const ACCIONES = {
  play: { metodo: 'PUT', ruta: 'me/player/play' },
  pause: { metodo: 'PUT', ruta: 'me/player/pause' },
  next: { metodo: 'POST', ruta: 'me/player/next' },
  previous: { metodo: 'POST', ruta: 'me/player/previous' },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const accion = req.body?.accion;
  const config = ACCIONES[accion];
  if (!config) {
    return res.status(400).json({ error: 'Acción inválida. Usa: play, pause, next o previous.' });
  }

  try {
    const accessToken = await getAccessToken();
    const resp = await fetchConTimeout(`https://api.spotify.com/v1/${config.ruta}`, {
      method: config.metodo,
      headers: { Authorization: `Bearer ${accessToken}` },
    }, 8000);

    // Spotify responde 204 (sin contenido) cuando el comando se ejecuta bien
    if (resp.status === 204 || resp.ok) {
      return res.status(200).json({ ok: true });
    }

    const cuerpo = await resp.text().catch(() => '');
    let mensaje = `Spotify respondió con error (${resp.status}).`;
    if (resp.status === 404) mensaje = 'No hay ningún dispositivo activo reproduciendo música en este momento.';
    if (resp.status === 403) mensaje = 'Esta cuenta de Spotify no tiene Premium (el control de reproducción requiere Premium).';
    return res.status(200).json({ ok: false, error: mensaje, detalle: cuerpo.slice(0, 200) });
  } catch (err) {
    return res.status(200).json({ ok: false, error: err.message || 'Error al controlar Spotify.' });
  }
}
