// Portales oficiales de beneficios/descuentos por banco en Chile.
//
// Estructura: cada banco tiene una lista de "perfiles". Cada perfil puede tener un
// `match` (regex sobre el nombre de la tarjeta) para aplicar solo a ciertas tarjetas,
// o no tener `match` para ser el perfil por defecto del banco.
//
// Cada perfil tiene `enlaces`: una lista de links relevantes (en vez de intentar
// adivinar "el" link correcto). Cada enlace puede tener `categorias` opcional:
// si se define, ese enlace solo se muestra cuando la categoría seleccionada está
// en esa lista. Si no tiene `categorias`, se muestra siempre.
//
// `dominio`: dominio a priorizar en la búsqueda web (include_domains de Tavily).

// ✅ Verificadas con búsqueda web real o confirmadas directamente por el usuario.
export const FUENTES_OFICIALES = {
  Scotiabank: [
    {
      match: /singular/i,
      dominio: 'scotiabankchile.cl',
      enlaces: [
        { url: 'https://www.scotiabankchile.cl/singular-by-scotiabank', nombre: 'Singular by Scotiabank — Principal' },
        { url: 'https://www.scotiabankchile.cl/singular-by-scotiabank/beneficios', nombre: 'Singular by Scotiabank — Beneficios' },
        {
          url: 'https://www.scotiarewards.cl/scclubfront/categoria/platosycomida/rutagourmet',
          nombre: 'ScotiaRewards — Ruta Gourmet',
          categorias: ['restaurantes'],
        },
      ],
    },
    {
      // Perfil por defecto para el resto de tarjetas Scotiabank (no Singular)
      dominio: 'scotiarewards.cl',
      enlaces: [
        { url: 'https://www.scotiarewards.cl', nombre: 'ScotiaRewards — Principal' },
        {
          url: 'https://www.scotiarewards.cl/scclubfront/categoria/platosycomida/rutagourmet',
          nombre: 'ScotiaRewards — Ruta Gourmet',
          categorias: ['restaurantes'],
        },
      ],
    },
  ],
  'Banco de Chile / Edwards': [
    {
      dominio: 'bancochile.cl',
      enlaces: [
        { url: 'https://sitiospublicos.bancochile.cl/personas/beneficios/sabores/restaurantes-y-bares', nombre: 'Banco de Chile — Beneficios' },
        {
          url: 'https://sitiospublicos.bancochile.cl/personas/beneficios/categoria?maincat=beneficios/sabores',
          nombre: 'Banco de Chile — Restaurantes y Bares',
          categorias: ['restaurantes'],
        },
      ],
    },
  ],
  Santander: [
    {
      dominio: 'santander.cl',
      enlaces: [
        { url: 'https://banco.santander.cl/beneficios/descuentos-restaurantes', nombre: 'Santander — Descuentos Restaurantes' },
      ],
    },
  ],
  BCI: [
    {
      dominio: 'bci.cl',
      enlaces: [{ url: 'https://www.bci.cl/beneficios', nombre: 'Beneficios Bci' }],
    },
  ],
  'Falabella (CMR)': [
    {
      dominio: 'bancofalabella.cl',
      enlaces: [
        { url: 'https://www.bancofalabella.cl/descuentos', nombre: 'Descuentos Banco Falabella / Club de Restaurantes CMR' },
      ],
    },
  ],
  Itaú: [
    {
      dominio: 'itaubeneficios.cl',
      enlaces: [
        { url: 'https://itaubeneficios.cl/beneficios-tarjeta/tarjeta-black/', nombre: 'Itaú — Beneficios Tarjeta Black' },
        {
          url: 'https://itaubeneficios.cl/ruta-gourmet-black/',
          nombre: 'Itaú — Ruta Gourmet Black',
          categorias: ['restaurantes'],
        },
      ],
    },
  ],
  // ⚠️ Pendientes de verificar: BancoEstado y Ripley no tienen portal confirmado
  // todavía. Si tienes el link real de beneficios de alguno de estos, avísame y lo agrego
  // (evito adivinar URLs para no mandarte a un sitio equivocado).
};

// Devuelve el perfil de fuente oficial correspondiente al banco y, si aplica,
// a la tarjeta específica (por nombre). Si ningún perfil con `match` coincide,
// devuelve el perfil sin `match` (el "por defecto" del banco).
export function getFuenteOficial(banco, tarjetaNombre = '') {
  const perfiles = FUENTES_OFICIALES[banco];
  if (!perfiles) return null;

  const coincidencia = perfiles.find((p) => p.match && p.match.test(tarjetaNombre));
  if (coincidencia) return coincidencia;

  return perfiles.find((p) => !p.match) || perfiles[0] || null;
}

// Dada una fuente y una categoría seleccionada, devuelve la lista de enlaces
// relevantes a mostrar (los generales + los específicos de esa categoría).
export function getEnlacesPortal(fuente, categoriaId) {
  if (!fuente || !fuente.enlaces) return [];
  return fuente.enlaces.filter((e) => !e.categorias || e.categorias.includes(categoriaId));
}
