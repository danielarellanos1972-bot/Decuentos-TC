const KEY = 'descuentos-tc-relojes-mundo';

export const DEFAULT_RELOJES = [
  { nombre: 'Santiago (Chile continental)', tz: 'America/Santiago' },
  { nombre: 'Isla de Pascua (Chile insular)', tz: 'Pacific/Easter' },
  { nombre: 'Aysén-Magallanes', tz: 'America/Santiago' },
  { nombre: 'Toronto', tz: 'America/Toronto' },
  { nombre: 'Nueva York', tz: 'America/New_York' },
  { nombre: 'Miami', tz: 'America/New_York' },
  { nombre: 'Ciudad de México', tz: 'America/Mexico_City' },
  { nombre: 'Lima', tz: 'America/Lima' },
  { nombre: 'Buenos Aires', tz: 'America/Argentina/Buenos_Aires' },
  { nombre: 'Madrid', tz: 'Europe/Madrid' },
];

// Mapa de nombres comunes en español a su zona horaria IANA, para que agregar
// una ciudad nueva sea tan simple como escribir su nombre.
const MAPA_CIUDADES = {
  'santiago': 'America/Santiago',
  'chile': 'America/Santiago',
  'isla de pascua': 'Pacific/Easter',
  'rapa nui': 'Pacific/Easter',
  'toronto': 'America/Toronto',
  'nueva york': 'America/New_York',
  'new york': 'America/New_York',
  'nyc': 'America/New_York',
  'miami': 'America/New_York',
  'mexico': 'America/Mexico_City',
  'ciudad de mexico': 'America/Mexico_City',
  'cdmx': 'America/Mexico_City',
  'lima': 'America/Lima',
  'buenos aires': 'America/Argentina/Buenos_Aires',
  'madrid': 'Europe/Madrid',
  'londres': 'Europe/London',
  'london': 'Europe/London',
  'paris': 'Europe/Paris',
  'tokio': 'Asia/Tokyo',
  'tokyo': 'Asia/Tokyo',
  'sidney': 'Australia/Sydney',
  'sydney': 'Australia/Sydney',
  'los angeles': 'America/Los_Angeles',
  'san francisco': 'America/Los_Angeles',
  'bogota': 'America/Bogota',
  'sao paulo': 'America/Sao_Paulo',
  'panama': 'America/Panama',
  'montevideo': 'America/Montevideo',
};

const normalizar = (s) =>
  s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

// Devuelve la zona horaria IANA para un texto ingresado por el usuario, o
// null si no se pudo reconocer. Acepta tanto nombres comunes ("Toronto")
// como un identificador IANA directo ("America/Toronto").
export function resolverZonaHoraria(texto) {
  const limpio = texto.trim();
  if (limpio.includes('/')) {
    try {
      new Intl.DateTimeFormat('es-CL', { timeZone: limpio });
      return limpio;
    } catch {
      return null;
    }
  }
  return MAPA_CIUDADES[normalizar(limpio)] || null;
}

export function getRelojes() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // si el guardado está corrupto, se ignora y se usan los de por defecto
  }
  return DEFAULT_RELOJES;
}

export function saveRelojes(lista) {
  localStorage.setItem(KEY, JSON.stringify(lista));
}
