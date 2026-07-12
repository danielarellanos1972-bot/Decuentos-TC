const KEY = 'descuentos-tc-webs-accesos';
const MIGRACION_KEY = 'descuentos-tc-webs-migracion-v1';
const KEY_BANCOS = 'descuentos-tc-bancos-accesos';

export const DEFAULT_SITIOS = [];

// Nombres que antes vivían en "Banco y Finanzas" y que ahora corresponden
// a esta sección. Se migran una sola vez (marcado con MIGRACION_KEY) para
// no duplicar ni volver a moverlos si el usuario los borra después.
const NOMBRES_A_MIGRAR = [/^emol$/i, /^lun$/i, /estrella\s*valpo/i];

function migrarDesdeBancos() {
  try {
    if (localStorage.getItem(MIGRACION_KEY)) return;
    const bancosRaw = localStorage.getItem(KEY_BANCOS);
    if (!bancosRaw) {
      localStorage.setItem(MIGRACION_KEY, '1');
      return;
    }
    const bancos = JSON.parse(bancosRaw);
    const aMigrar = bancos.filter((b) => NOMBRES_A_MIGRAR.some((rx) => rx.test(b.nombre)));

    if (aMigrar.length > 0) {
      const bancosRestantes = bancos.filter((b) => !NOMBRES_A_MIGRAR.some((rx) => rx.test(b.nombre)));
      localStorage.setItem(KEY_BANCOS, JSON.stringify(bancosRestantes));

      const sitiosRaw = localStorage.getItem(KEY);
      const sitiosActuales = sitiosRaw ? JSON.parse(sitiosRaw) : [];
      const combinados = [
        ...sitiosActuales,
        ...aMigrar.filter((m) => !sitiosActuales.some((s) => s.nombre === m.nombre)),
      ];
      localStorage.setItem(KEY, JSON.stringify(combinados));
    }

    localStorage.setItem(MIGRACION_KEY, '1');
  } catch {
    // Si algo falla, no se migra nada; el usuario puede agregarlas a mano.
  }
}

export function getSitios() {
  migrarDesdeBancos();
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // si el guardado está corrupto, se ignora y se usan los de por defecto
  }
  return DEFAULT_SITIOS;
}

export function saveSitios(lista) {
  localStorage.setItem(KEY, JSON.stringify(lista));
}
