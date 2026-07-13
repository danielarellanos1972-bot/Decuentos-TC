// api/spotify-now-playing.js
// Vercel Serverless Function
// GET /api/spotify-now-playing
//
// Devuelve la canción que está sonando ahora mismo en la cuenta de Spotify
// de Nano. Mismo patrón de un solo usuario que api/calendar-events.js y
// api/unread-mail.js: usa un refresh_token guardado en variables de entorno
// para renovar el acceso cada vez, sin exponer nada sensible al navegador.
//
// Variables de entorno requeridas:
//   SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN

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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

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
