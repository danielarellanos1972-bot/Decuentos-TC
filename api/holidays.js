// api/holidays.js
// Vercel Serverless Function
// GET /api/holidays?year=2026&country=CL
//
// Feriados oficiales por país. Dos fuentes:
// - Chile (CL): api.boostr.cl — API chilena gratuita y sin clave, hecha
//   específicamente para esto. Se usa como fuente principal porque
//   Nager.Date (la fuente genérica) todavía no tenía cargados los feriados
//   2026 de Chile al momento de escribir esto.
// - Cualquier otro país: Nager.Date — API pública gratuita, sin clave,
//   cubre más de 100 países por código ISO de 2 letras.

const fetchConTimeout = (url, options, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
};

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; DescuentosTC/1.0)', Accept: 'application/json' };

async function feriadosChile(year) {
  const resp = await fetchConTimeout('https://api.boostr.cl/holidays.json', { headers: HEADERS }, 8000);
  if (!resp.ok) throw new Error(`Boostr respondió HTTP ${resp.status}`);
  const data = await resp.json();
  const lista = data?.data || [];
  return lista
    .filter((f) => f.date?.startsWith(String(year)))
    .map((f) => ({ fecha: f.date, nombre: f.title, pais: 'CL' }));
}

async function feriadosOtroPais(year, country) {
  const resp = await fetchConTimeout(
    `https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`,
    { headers: HEADERS },
    8000
  );
  if (!resp.ok) throw new Error(`Nager.Date respondió HTTP ${resp.status}`);
  const data = await resp.json();
  return (Array.isArray(data) ? data : []).map((f) => ({
    fecha: f.date,
    nombre: f.localName || f.name,
    pais: country,
  }));
}

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
    const feriados = country === 'CL' ? await feriadosChile(year) : await feriadosOtroPais(year, country);
    if (feriados.length === 0) {
      return res.status(200).json({ feriados: [], error: `No se encontraron feriados para "${country}" en ${year}.` });
    }
    return res.status(200).json({ feriados });
  } catch (err) {
    return res.status(200).json({ feriados: [], error: err.message || 'Error obteniendo los feriados.' });
  }
}
