// Vercel Serverless Function
// POST /api/search-offers
// body: { banco: string, tarjeta: string, categoria: string, categoriaLabel: string }
//
// 1) Busca en la web (Tavily) promociones/descuentos vigentes para ese banco+tarjeta+categoría
// 2) Usa Groq (llama-3.3-70b-versatile) para estructurar los resultados crudos en ofertas limpias
//
// Requiere variables de entorno en Vercel: TAVILY_API_KEY, GROQ_API_KEY

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { banco, tarjeta, categoria, categoriaLabel, dominioOficial } = req.body || {};

  if (!banco) {
    return res.status(400).json({ error: 'Falta el banco a buscar' });
  }

  const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
  const GROQ_API_KEY = process.env.GROQ_API_KEY;

  if (!TAVILY_API_KEY || !GROQ_API_KEY) {
    return res.status(500).json({
      error: 'Faltan API keys en el servidor (TAVILY_API_KEY / GROQ_API_KEY). Configúralas en Vercel > Settings > Environment Variables.',
    });
  }

  const mesActual = new Date().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });

  const query = `descuentos y promociones ${categoriaLabel || 'restaurantes y comercios'} con tarjeta ${tarjeta ? tarjeta + ' ' : ''}${banco} Chile ${mesActual}`;

  try {
    // 1) Búsqueda web en vivo con Tavily
    const tavilyResp = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: 'advanced',
        max_results: 8,
        // Si conocemos el portal oficial de beneficios del banco (ej: scotiarewards.cl para
        // Scotiabank, que es un dominio DISTINTO al del banco), priorizamos ese dominio para
        // no perdernos en la home genérica del banco.
        include_domains: dominioOficial ? [dominioOficial] : [],
      }),
    });

    if (!tavilyResp.ok) {
      const errText = await tavilyResp.text();
      throw new Error(`Tavily error: ${tavilyResp.status} ${errText}`);
    }

    const tavilyData = await tavilyResp.json();
    const rawResults = (tavilyData.results || [])
      .map((r, i) => `[Fuente ${i + 1}] ${r.title}\nURL: ${r.url}\nContenido: ${r.content}`)
      .join('\n\n');

    if (!rawResults) {
      return res.status(200).json({ ofertas: [], mensaje: 'No se encontraron resultados en la búsqueda web.' });
    }

    // 2) Estructurar con Groq
    const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content:
              'Eres un analista que extrae ofertas y descuentos bancarios reales desde resultados de búsqueda web. ' +
              'Responde SOLO con un JSON válido (sin markdown, sin texto extra) con la forma: ' +
              '{"ofertas": [{"comercio": string, "descuento": string, "condiciones": string, "vigencia": string, "fuenteUrl": string}]}. ' +
              'Si un dato no aparece explícitamente en el texto, usa "No especificado". No inventes descuentos que no estén en el texto. ' +
              'Ignora resultados que no correspondan a promociones bancarias reales.',
          },
          {
            role: 'user',
            content: `Banco: ${banco}\nTarjeta: ${tarjeta || 'No especificada'}\nCategoría buscada: ${categoriaLabel || 'General'}\n\nResultados de búsqueda web:\n\n${rawResults}`,
          },
        ],
      }),
    });

    if (!groqResp.ok) {
      const errText = await groqResp.text();
      throw new Error(`Groq error: ${groqResp.status} ${errText}`);
    }

    const groqData = await groqResp.json();
    let content = groqData.choices?.[0]?.message?.content || '{"ofertas": []}';
    content = content.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { ofertas: [] };
    }

    return res.status(200).json({
      ofertas: parsed.ofertas || [],
      consultado: query,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Error interno buscando ofertas' });
  }
}
