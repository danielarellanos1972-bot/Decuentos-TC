const KEY = 'descuentos-tc-bancos-accesos';

export const DEFAULT_BANCOS = [
  { nombre: 'Santander Chile', url: 'https://www.santander.cl' },
  { nombre: 'Banco de Chile', url: 'https://www.bancochile.cl' },
  { nombre: 'Scotiabank Chile', url: 'https://www.scotiabankchile.cl' },
  { nombre: 'Itaú Chile', url: 'https://www.itau.cl' },
  { nombre: 'Banco Central de Chile', url: 'https://www.bcentral.cl' },
];

export function getBancos() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // si el guardado está corrupto, se ignora y se usan los de por defecto
  }
  return DEFAULT_BANCOS;
}

export function saveBancos(lista) {
  localStorage.setItem(KEY, JSON.stringify(lista));
}
