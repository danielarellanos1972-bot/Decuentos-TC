// Vercel Serverless Function
// POST /api/weekly-offers
// body: { banco, tarjeta, dominioOficial, urlsOficiales, region, comuna }
//
// Estrategia:
// 1) Si tenemos URLs oficiales conocidas para esta tarjeta (urlsOficiales), usamos
//    Tavily EXTRACT para leer el contenido real de esas páginas directamente
//    (más preciso que una búsqueda genérica, porque sabemos exactamente qué página
//    corresponde a la promoción de restaurantes de ese banco/tarjeta).
// 2) Si la extracción no trae suficiente contenido (ej: la página carga todo por
//    JavaScript y el HTML crudo viene casi vacío), usamos Tavily SEARCH como respaldo.
// 3) Groq (llama-3.1-8b-instant) estructura el resultado por día de la semana.
//
// Requiere variables de entorno en Vercel: TAVILY_API_KEY, GROQ_API_KEY

const DIAS_VALIDOS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo', 'Todos los días'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { banco, tarjeta, dominioOficial, urlsOficiales, region, comuna } = req.body || {};

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
  const zona = comuna ? `${comuna}, ${region}` : region;

  const MAX_CHARS_POR_RESULTADO = 2500;
  const MIN_CHARS_UTILES = 200; // debajo de esto asumimos que la extracción no trajo nada útil

  let rawResults = '';
  let fuenteMetodo = 'extract';

  try {
    // 1) Intentamos leer directamente las URLs oficiales conocidas (máx. 2, para controlar costo)
    const urls = (urlsOficiales || []).slice(0, 2);

    if (urls.length > 0) {
      const extractResp = await fetch('https://api.tavily.com/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: TAVILY_API_KEY, urls }),
      });

      if (extractResp.ok) {
        const extractData = await extractResp.json();
        rawResults = (extractData.results || [])
          .map((r, i) => `[Fuente ${i + 1}] ${r.url}\nContenido: ${(r.raw_content || '').slice(0, MAX_CHARS_POR_RESULTADO)}`)
          .join('\n\n');
      }
    }

    // 2) Si la extracción no trajo suficiente contenido útil, buscamos como respaldo
    if (rawResults.trim().length < MIN_CHARS_UTILES) {
      fuenteMetodo = 'search';
      const query = `descuentos restaurantes gastronomía comida lunes a domingo ${tarjeta ? tarjeta + ' ' : ''}${banco} ${zona} Chile ${mesActual} tope máximo -ropa -tecnología -deporte`;

      const tavilyResp = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: TAVILY_API_KEY,
          query,
          search_depth: 'advanced',
          max_results: 5,
          include_domains: dominioOficial ? [dominioOficial] : [],
        }),
      });

      if (!tavilyResp.ok) {
        const errText = await tavilyResp.text();
        throw new Error(`Tavily error: ${tavilyResp.status} ${errText}`);
      }

      const tavilyData = await tavilyResp.json();
      rawResults = (tavilyData.results || [])
        .map((r, i) => {
          const contenido = (r.content || '').slice(0, 700);
          return `[Fuente ${i + 1}] ${r.title}\nURL: ${r.url}\nContenido: ${contenido}`;
        })
        .join('\n\n');
    }

    if (!rawResults.trim()) {
      return res.status(200).json({ ofertasPorDia: [], mensaje: 'No se encontraron resultados en la búsqueda web.' });
    }

    const groqResp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content:
              'Eres un analista que extrae descuentos bancarios reales en restaurantes desde resultados de búsqueda web, ' +
              'organizándolos por día de la semana. ' +
              'Responde SOLO con un JSON válido (sin markdown, sin texto extra) con la forma: ' +
              '{"ofertasPorDia": [{"dia": string, "comercio": string, "descuento": string, "tope": string, "comuna": string, "condiciones": string, "fuenteUrl": string}]}. ' +
              `El campo "dia" debe ser exactamente uno de estos valores: ${DIAS_VALIDOS.join(', ')}. ` +
              'Usa "Todos los días" si el descuento aplica todos los días de la semana. ' +
              'Si un dato no aparece explícitamente en el texto, usa "No especificado". No inventes descuentos, días, porcentajes ni topes que no estén en el texto. ' +
              'REGLAS ESTRICTAS sobre el campo "comercio": ' +
              '1) Debe ser el NOMBRE PROPIO de un restaurante, cadena, café, bar o servicio de delivery específico (ej: "Sushi One", "Cocina de Javier", "Rappi"). ' +
              '2) NUNCA uses una categoría o frase genérica como valor de "comercio". PROHIBIDO usar: "Restaurantes", "Comercios", "Descuentos", "Gastronomía", "Compras", "Restaurantes adheridos a...", "Restaurantes asociados a...", "Comercios participantes", o cualquier variante similar que no sea el nombre propio de un negocio específico. Si el texto solo menciona el porcentaje aplicable a "restaurantes" en general sin nombrar un comercio específico, DESCARTA esa fila por completo — no la incluyas con un nombre genérico inventado. ' +
              '3) EXCLUYE cualquier comercio que no sea de rubro gastronómico (comida, bebidas, café, delivery de comida). Ignora explícitamente tiendas de ropa, calzado, deporte, tecnología, farmacias, supermercados u otros rubros, aunque aparezcan en la misma página o listado. ' +
              '4) Si el mismo comercio aparece mencionado en más de una fuente para el mismo día, inclúyelo UNA SOLA VEZ (no dupliques filas idénticas). ' +
              'Ignora resultados que no correspondan a promociones bancarias reales de restaurantes.',
          },
          {
            role: 'user',
            content: `Banco: ${banco}\nTarjeta: ${tarjeta || 'No especificada'}\nZona: ${zona}\n\nResultados de búsqueda web:\n\n${rawResults}`,
          },
        ],
      }),
    });

    if (!groqResp.ok) {
      const errText = await groqResp.text();

      if (groqResp.status === 429) {
        let minutos = null;
        try {
          const parsedErr = JSON.parse(errText);
          const match = /try again in ([\d.]+)m([\d.]+)s/i.exec(parsedErr?.error?.message || '');
          if (match) minutos = Math.ceil(parseFloat(match[1]) + parseFloat(match[2]) / 60);
        } catch {
          // Ignorar, dejamos minutos en null
        }
        return res.status(429).json({
          error: minutos
            ? `Se alcanzó el límite diario de IA por hoy. Intenta de nuevo en unos ${minutos} minutos.`
            : 'Se alcanzó el límite diario de IA por hoy. Intenta de nuevo más tarde.',
        });
      }

      throw new Error(`Groq error: ${groqResp.status} ${errText}`);
    }

    const groqData = await groqResp.json();
    let content = groqData.choices?.[0]?.message?.content || '{"ofertasPorDia": []}';
    content = content.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { ofertasPorDia: [] };
    }

    // Filtramos por si Groq devuelve un valor de "dia" fuera de lo esperado, o un
    // "comercio" que en realidad es una frase genérica (no un nombre propio real).
    const PATRONES_GENERICOS = [
      /^restaurantes?\b/i,       // "Restaurantes", "Restaurante adherido..."
      /^comercios?\b/i,          // "Comercios asociados..."
      /^descuentos?\b/i,
      /^gastronom[ií]a\b/i,
      /^compras?\b/i,
      /adherid[oa]s?\s+a/i,      // "...adheridos a la promoción..."
      /asociad[oa]s?\s+a/i,      // "...asociados a Transbank..."
      /participantes?\b/i,
    ];
    const esGenerico = (nombre) => PATRONES_GENERICOS.some((rx) => rx.test(nombre.trim()));

    const vistos = new Set();
    const ofertasPorDia = (parsed.ofertasPorDia || [])
      .filter((o) => DIAS_VALIDOS.includes(o.dia))
      .filter((o) => o.comercio && !esGenerico(o.comercio))
      .filter((o) => {
        const clave = `${o.dia}|${o.comercio.trim().toLowerCase()}|${o.descuento}`;
        if (vistos.has(clave)) return false;
        vistos.add(clave);
        return true;
      });

    return res.status(200).json({ ofertasPorDia, metodo: fuenteMetodo });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Error interno buscando ofertas semanales' });
  }
}
