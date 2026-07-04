// Portales oficiales de beneficios/descuentos por banco en Chile.
// Muchos bancos publican sus promociones en un dominio DISTINTO al del banco mismo
// (ej: Scotiabank -> ScotiaRewards), así que esto ayuda a la búsqueda a apuntar bien
// y además le damos al usuario un acceso directo aunque la búsqueda no traiga nada.
//
// url: portal general de beneficios del banco
// dominio: dominio a priorizar en la búsqueda (include_domains de Tavily)

// ✅ Verificadas con búsqueda web real (no adivinadas) al 03-jul-2026.
export const FUENTES_OFICIALES = {
  Scotiabank: {
    url: 'https://www.scotiarewards.cl/scclubfront/categoria/platosycomida/rutagourmet',
    dominio: 'scotiarewards.cl',
    nombrePortal: 'ScotiaRewards — Ruta Gourmet',
  },
  'Banco de Chile / Edwards': {
    url: 'https://sitiospublicos.bancochile.cl/personas/beneficios/sabores/restaurantes-y-bares',
    dominio: 'bancochile.cl',
    nombrePortal: 'Banco de Chile — Sabores (Restaurantes y Bares)',
  },
  Santander: {
    url: 'https://banco.santander.cl/beneficios/descuentos-restaurantes',
    dominio: 'santander.cl',
    nombrePortal: 'Santander — Descuentos Restaurantes',
  },
  BCI: {
    url: 'https://www.bci.cl/beneficios',
    dominio: 'bci.cl',
    nombrePortal: 'Beneficios Bci',
  },
  'Falabella (CMR)': {
    url: 'https://www.bancofalabella.cl/descuentos',
    dominio: 'bancofalabella.cl',
    nombrePortal: 'Descuentos Banco Falabella / Club de Restaurantes CMR',
  },
  Itaú: {
    url: 'https://itaubeneficios.cl/ruta-gourmet-black/',
    dominio: 'itaubeneficios.cl',
    nombrePortal: 'Itaú Beneficios — Ruta Gourmet Black',
    // Portal general de beneficios (no solo restaurantes), por si sirve para otras categorías:
    urlGeneral: 'https://itaubeneficios.cl/beneficios-tarjeta/tarjeta-black/',
  },
  // ⚠️ Pendientes de verificar: BancoEstado y Ripley no tienen portal confirmado
  // todavía. Si tienes el link real de beneficios de alguno de estos, avísame y lo agrego
  // (evito adivinar URLs para no mandarte a un sitio equivocado).
};

export function getFuenteOficial(banco) {
  return FUENTES_OFICIALES[banco] || null;
}
