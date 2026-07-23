// api/spotify.js
// GET  /api/spotify   -> canción sonando ahora mismo (antes: api/spotify-now-playing.js)
// POST /api/spotify   body: { accion: 'play'|'pause'|'next'|'previous' } -> controla la reproducción
//                      (antes: api/spotify-control.js)
//
// Se fusionaron en un solo archivo porque el plan Hobby de Vercel permite un
// máximo de 12 funciones serverless por deployment — separar GET/POST por
// método en un mismo archivo no cuenta como dos funciones.
//
// Variables de entorno requeridas:
//   SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN
//   (el control de reproducción necesita además el scope "user-modify-playback-state")

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

async function handlerNowPlaying(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const accessToken = await getAccessToken();
    const resp = await fetchConTimeout('https://api.spotify.com/v1/me/player/currently-playing?additional_types=track', {
      headers: { Authorization: `Bearer ${accessToken}` },
    }, 8000);

    // 204 = no hay nada sonando ahora mismo (respuesta válida, no un error)
    if (resp.status === 204) {
      return res.status(200).json({ reproduciendo: false });
    }
    if (!resp.ok) {
      return res.status(200).json({ reproduciendo: false, error: `Spotify respondió con error (${resp.status}).` });
    }

    const data = await resp.json();
    if (!data || !data.item || data.currently_playing_type !== 'track') {
      return res.status(200).json({ reproduciendo: false });
    }

    const track = data.item;
    return res.status(200).json({
      reproduciendo: !!data.is_playing,
      cancion: track.name,
      artistas: (track.artists || []).map((a) => a.name).join(', '),
      album: track.album?.name || null,
      portada: track.album?.images?.[1]?.url || track.album?.images?.[0]?.url || null,
      progresoMs: data.progress_ms || 0,
      duracionMs: track.duration_ms || 0,
      urlSpotify: track.external_urls?.spotify || null,
    });
  } catch (err) {
    return res.status(200).json({ reproduciendo: false, error: err.message || 'Error consultando Spotify.' });
  }
}

const ACCIONES = {
  play: { metodo: 'PUT', ruta: 'me/player/play' },
  pause: { metodo: 'PUT', ruta: 'me/player/pause' },
  next: { metodo: 'POST', ruta: 'me/player/next' },
  previous: { metodo: 'POST', ruta: 'me/player/previous' },
};

async function handlerControl(req, res) {
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

export default async function handler(req, res) {
  if (req.method === 'GET') return handlerNowPlaying(req, res);
  if (req.method === 'POST') return handlerControl(req, res);
  return res.status(405).json({ error: 'Método no permitido' });
}
