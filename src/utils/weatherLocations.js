const KEY = 'descuentos-tc-ubicaciones-clima';

export const DEFAULT_UBICACIONES = [
  { nombre: 'Colina', lat: -33.2003, lon: -70.6746 },
  { nombre: 'Santiago (RM)', lat: -33.4489, lon: -70.6693 },
  { nombre: 'Panguipulli', lat: -39.6404, lon: -72.3355 },
  { nombre: 'Valparaíso', lat: -33.0472, lon: -71.6127 },
  { nombre: 'Quilpué', lat: -33.0458, lon: -71.4419 },
];

export function getUbicaciones() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // si el guardado está corrupto, se ignora y se usan las de por defecto
  }
  return DEFAULT_UBICACIONES;
}

export function saveUbicaciones(lista) {
  localStorage.setItem(KEY, JSON.stringify(lista));
}
