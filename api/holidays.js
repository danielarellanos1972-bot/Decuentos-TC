// api/holidays.js
// Vercel Serverless Function
// GET /api/holidays?year=2026&country=CL
//
// Feriados oficiales de cualquier país, vía Nager.Date (API pública
// gratuita, sin necesidad de clave, hecha justo para esto — cubre más de
// 100 países por código ISO de 2 letras). Se usa en vez de raspar
// calendario.cl u otro sitio, que sería frágil y menos confiable.

const fetchConTimeout = (url, options, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const year = parseInt(req.query.year, 10) || new Date().getFullYear();
  const country = (req.query.country || 'CL').toUpperCase();

  // Los feriados de un año no cambian una vez publicados: se puede cachear
  // por bastante tiempo sin problema.
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');

  try {
    const resp = await fetchConTimeout(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DescuentosTC/1.0)', Accept: 'application/json' } },
      8000
    );
    if (!resp.ok) {
      return res.status(200).json({ feriados: [], error: `No se encontraron feriados para "${country}" (¿código de país válido?).` });
    }
    const data = await resp.json();
    const feriados = (Array.isArray(data) ? data : []).map((f) => ({
      fecha: f.date,
      nombre: f.localName || f.name,
      pais: country,
    }));
    return res.status(200).json({ feriados });
  } catch (err) {
    return res.status(200).json({ feriados: [], error: err.message || 'Error obteniendo los feriados.' });
  }
}
