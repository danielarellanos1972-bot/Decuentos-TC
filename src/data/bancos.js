// Bancos y tarjetas comunes en Chile, precargados para partir sin escribir nada.
// El usuario puede agregar, editar o eliminar libremente desde la UI (se guarda en localStorage).

export const BANCOS_CHILE = [
  'Scotiabank',
  'Banco de Chile / Edwards',
  'BancoEstado',
  'Santander',
  'BCI',
  'Itaú',
  'Falabella (CMR)',
  'Ripley',
  'Banco Security',
  'Banco Consorcio',
  'Banco Falabella',
  'Coopeuch',
  'Tenpo',
  'Mach (Banco BICE)',
];

export const TARJETAS_PRECARGADAS = [
  { id: 'seed-1', banco: 'Scotiabank', nombre: 'Scotiabank Signature', tipo: 'Crédito' },
  { id: 'seed-2', banco: 'Falabella (CMR)', nombre: 'CMR Falabella Mastercard', tipo: 'Crédito' },
  { id: 'seed-3', banco: 'BCI', nombre: 'BCI Mastercard Black', tipo: 'Crédito' },
  { id: 'seed-4', banco: 'Santander', nombre: 'Santander LifeMiles', tipo: 'Crédito' },
];

export const CATEGORIAS = [
  { id: 'restaurantes', label: 'Restaurantes', emoji: '🍽️' },
  { id: 'supermercados', label: 'Supermercados', emoji: '🛒' },
  { id: 'retail', label: 'Retail / Tiendas', emoji: '🛍️' },
  { id: 'entretenimiento', label: 'Entretenimiento / Cine', emoji: '🎬' },
  { id: 'viajes', label: 'Viajes / Pasajes', emoji: '✈️' },
  { id: 'combustible', label: 'Combustible', emoji: '⛽' },
  { id: 'delivery', label: 'Delivery', emoji: '🛵' },
  { id: 'otros', label: 'Otros comercios', emoji: '🏷️' },
];
