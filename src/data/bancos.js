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

// Colores de marca por banco, para que cada tarjeta en "Mis tarjetas" se vea como la
// tarjeta física real. Igual que con las fuentes oficiales: cada banco tiene una lista
// de "perfiles" de color. Un perfil puede tener `match` (regex sobre el nombre de la
// tarjeta) para aplicar solo a ciertas tarjetas; el perfil sin `match` es el color por
// defecto del banco.
export const BANK_COLORS = {
  Scotiabank: [
    {
      // Singular by Scotiabank: metal cepillado gris/plata
      match: /singular/i,
      from: '#B0B0B0', to: '#5E5E5E', text: '#FFFFFF',
    },
    {
      // Resto de tarjetas Scotiabank (ej: Visa Infinite): azul marino profundo
      from: '#0B1F4D', to: '#050D26', text: '#D7E3F0',
    },
  ],
  Santander: [
    {
      // Amex Limited / WorldMember: negro con dorado (LATAM Pass)
      match: /amex|limited|world\s?member/i,
      from: '#1A1A1A', to: '#000000', text: '#D4AF37',
    },
    {
      // Resto de tarjetas Santander: rojo de marca
      from: '#EC0000', to: '#8C0000', text: '#FFFFFF',
    },
  ],
  'Banco de Chile / Edwards': [
    {
      // Visa Infinite: negro con detalles dorados
      match: /infinite/i,
      from: '#1A1A1A', to: '#000000', text: '#D4AF37',
    },
    {
      // Resto de tarjetas Banco de Chile / Edwards: azul de marca
      from: '#004A93', to: '#00284F', text: '#FFFFFF',
    },
  ],
  BancoEstado: [{ from: '#FF7A00', to: '#B34F00', text: '#FFFFFF' }],
  BCI: [{ from: '#F5821F', to: '#A6560F', text: '#FFFFFF' }],
  Itaú: [
    {
      // Tarjeta Black: negro con franja naranja inferior
      match: /black/i,
      from: '#1A1A1A', to: '#000000', text: '#FFFFFF', accent: '#FF7900',
    },
    {
      // Resto de tarjetas Itaú
      from: '#FF7900', to: '#0033A0', text: '#FFFFFF',
    },
  ],
  'Falabella (CMR)': [{ from: '#78BE21', to: '#3F6B10', text: '#FFFFFF' }],
  Ripley: [{ from: '#E4007C', to: '#8C004D', text: '#FFFFFF' }],
  'Banco Security': [{ from: '#0B3B5C', to: '#041C2C', text: '#E8C583' }],
  'Banco Consorcio': [{ from: '#00594C', to: '#00302A', text: '#E8C583' }],
  'Banco Falabella': [{ from: '#78BE21', to: '#3F6B10', text: '#FFFFFF' }],
  Coopeuch: [{ from: '#0057A0', to: '#00365F', text: '#FFFFFF' }],
  Tenpo: [{ from: '#7B2FF7', to: '#4A1594', text: '#FFFFFF' }],
  'Mach (Banco BICE)': [{ from: '#00E58A', to: '#00A566', text: '#0A1F1A' }],
};

// Colores por defecto para bancos que no están en la lista de arriba
// (mismo look navy/dorado que usa el resto de la app).
export const BANK_COLOR_DEFAULT = { from: '#204B6B', to: '#163A52', text: '#F4EFE6' };

export function getBankColors(banco, tarjetaNombre = '') {
  const perfiles = BANK_COLORS[banco];
  if (!perfiles) return BANK_COLOR_DEFAULT;

  const coincidencia = perfiles.find((p) => p.match && p.match.test(tarjetaNombre));
  if (coincidencia) return coincidencia;

  return perfiles.find((p) => !p.match) || perfiles[0] || BANK_COLOR_DEFAULT;
}
