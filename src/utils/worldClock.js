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

// Datos de referencia por zona horaria, para el popup con el reloj análogo.
// Población en cifras aproximadas y recientes (no se actualizan en vivo,
// cambian muy lento). Si se agrega una ciudad nueva cuya zona horaria no
// está en esta tabla, el popup simplemente no muestra esta sección.
export const DATOS_PAIS = {
  'America/Santiago': { bandera: '🇨🇱', pais: 'Chile', capital: 'Santiago', poblacion: 19600000, moneda: 'Peso chileno (CLP)' },
  'Pacific/Easter': { bandera: '🇨🇱', pais: 'Chile (Isla de Pascua / Rapa Nui)', capital: 'Hanga Roa', poblacion: 7750, moneda: 'Peso chileno (CLP)' },
  'America/Toronto': { bandera: '🇨🇦', pais: 'Canadá', capital: 'Ottawa', poblacion: 40800000, moneda: 'Dólar canadiense (CAD)' },
  'America/New_York': { bandera: '🇺🇸', pais: 'Estados Unidos', capital: 'Washington D.C.', poblacion: 335000000, moneda: 'Dólar estadounidense (USD)' },
  'America/Los_Angeles': { bandera: '🇺🇸', pais: 'Estados Unidos', capital: 'Washington D.C.', poblacion: 335000000, moneda: 'Dólar estadounidense (USD)' },
  'America/Mexico_City': { bandera: '🇲🇽', pais: 'México', capital: 'Ciudad de México', poblacion: 130000000, moneda: 'Peso mexicano (MXN)' },
  'America/Lima': { bandera: '🇵🇪', pais: 'Perú', capital: 'Lima', poblacion: 34300000, moneda: 'Sol peruano (PEN)' },
  'America/Argentina/Buenos_Aires': { bandera: '🇦🇷', pais: 'Argentina', capital: 'Buenos Aires', poblacion: 46000000, moneda: 'Peso argentino (ARS)' },
  'Europe/Madrid': { bandera: '🇪🇸', pais: 'España', capital: 'Madrid', poblacion: 48600000, moneda: 'Euro (EUR)' },
  'Europe/London': { bandera: '🇬🇧', pais: 'Reino Unido', capital: 'Londres', poblacion: 68300000, moneda: 'Libra esterlina (GBP)' },
  'Europe/Paris': { bandera: '🇫🇷', pais: 'Francia', capital: 'París', poblacion: 68400000, moneda: 'Euro (EUR)' },
  'Asia/Tokyo': { bandera: '🇯🇵', pais: 'Japón', capital: 'Tokio', poblacion: 123800000, moneda: 'Yen japonés (JPY)' },
  'Australia/Sydney': { bandera: '🇦🇺', pais: 'Australia', capital: 'Canberra', poblacion: 26600000, moneda: 'Dólar australiano (AUD)' },
  'America/Bogota': { bandera: '🇨🇴', pais: 'Colombia', capital: 'Bogotá', poblacion: 52000000, moneda: 'Peso colombiano (COP)' },
  'America/Sao_Paulo': { bandera: '🇧🇷', pais: 'Brasil', capital: 'Brasília', poblacion: 216400000, moneda: 'Real brasileño (BRL)' },
  'America/Panama': { bandera: '🇵🇦', pais: 'Panamá', capital: 'Ciudad de Panamá', poblacion: 4400000, moneda: 'Balboa / Dólar (PAB/USD)' },
  'America/Montevideo': { bandera: '🇺🇾', pais: 'Uruguay', capital: 'Montevideo', poblacion: 3440000, moneda: 'Peso uruguayo (UYU)' },
};

export function getDatosPais(tz) {
  return DATOS_PAIS[tz] || null;
}

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
