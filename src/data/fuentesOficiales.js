// Portales oficiales de beneficios/descuentos por banco en Chile.
// Muchos bancos publican sus promociones en un dominio DISTINTO al del banco mismo
// (ej: Scotiabank normal -> ScotiaRewards), Y ADEMÁS distintas tarjetas del mismo banco
// pueden tener portales distintos (ej: Scotiabank Singular tiene su propio sitio,
// separado de ScotiaRewards).
//
// Estructura: cada banco tiene una lista de "perfiles". Cada perfil puede tener un
// `match` (regex sobre el nombre de la tarjeta) para aplicar solo a ciertas tarjetas,
// o no tener `match` para ser el perfil por defecto del banco.
//
// Cada perfil puede definir:
//  - urlGeneral: portal general de beneficios (todas las categorías)
//  - urlRestaurantes: portal específico de restaurantes/gastronomía (si es distinto del general)
//  - dominio: dominio a priorizar en la búsqueda (include_domains de Tavily)
//  - nombrePortal: nombre a mostrar en el botón de acceso directo

// ✅ Verificadas con búsqueda web real o confirmadas directamente por el usuario.
export const FUENTES_OFICIALES = {
  Scotiabank: [
    {
      match: /singular/i,
      urlGeneral: 'https://www.scotiabankchile.cl/singular-by-scotiabank/beneficios',
      urlRestaurantes: 'https://www.scotiabankchile.cl/singular-by-scotiabank/beneficios',
      dominio: 'scotiabankchile.cl',
      nombrePortal: 'Singular by Scotiabank — Beneficios',
    },
    {
      // Perfil por defecto para el resto de tarjetas Scotiabank (no Singular)
      urlGeneral: 'https://www.scotiarewards.cl',
      urlRestaurantes: 'https://www.scotiarewards.cl/scclubfront/categoria/platosycomida/rutagourmet',
      dominio: 'scotiarewards.cl',
      nombrePortal: 'ScotiaRewards — Ruta Gourmet',
    },
  ],
  'Banco de Chile / Edwards': [
    {
      urlGeneral: 'https://sitiospublicos.bancochile.cl/personas/beneficios/sabores/restaurantes-y-bares',
      urlRestaurantes: 'https://sitiospublicos.bancochile.cl/personas/beneficios/categoria?maincat=beneficios/sabores',
      dominio: 'bancochile.cl',
      nombrePortal: 'Banco de Chile — Beneficios',
    },
  ],
  Santander: [
    {
      urlGeneral: 'https://banco.santander.cl/beneficios/descuentos-restaurantes',
      dominio: 'santander.cl',
      nombrePortal: 'Santander — Descuentos Restaurantes',
    },
  ],
  BCI: [
    {
      urlGeneral: 'https://www.bci.cl/beneficios',
      dominio: 'bci.cl',
      nombrePortal: 'Beneficios Bci',
    },
  ],
  'Falabella (CMR)': [
    {
      urlGeneral: 'https://www.bancofalabella.cl/descuentos',
      dominio: 'bancofalabella.cl',
      nombrePortal: 'Descuentos Banco Falabella / Club de Restaurantes CMR',
    },
  ],
  Itaú: [
    {
      urlGeneral: 'https://itaubeneficios.cl/beneficios-tarjeta/tarjeta-black/',
      urlRestaurantes: 'https://itaubeneficios.cl/ruta-gourmet-black/',
      dominio: 'itaubeneficios.cl',
      nombrePortal: 'Itaú Beneficios — Tarjeta Black',
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

// Dada una categoría seleccionada, devuelve la URL más adecuada y su nombre a mostrar.
export function getLinkPortal(fuente, categoriaId) {
  if (!fuente) return null;
  const esRestaurantes = categoriaId === 'restaurantes';
  const url = (esRestaurantes && fuente.urlRestaurantes) || fuente.urlGeneral || fuente.urlRestaurantes;
  if (!url) return null;

  const sufijo = esRestaurantes && fuente.urlRestaurantes ? ' — Restaurantes' : '';
  return { url, nombre: `${fuente.nombrePortal}${sufijo}` };
}
