const KEY = 'descuentos-tc-webs-accesos';
const MIGRACION_KEY = 'descuentos-tc-webs-migracion-v1';
const KEY_BANCOS = 'descuentos-tc-bancos-accesos';
const DRIVE_INJECTADO_KEY = 'descuentos-tc-webs-drive-onedrive-v1';

export const DEFAULT_SITIOS = [];

// Google Drive y OneDrive: se agregan una sola vez (marcado con
// DRIVE_INJECTADO_KEY) justo antes de LinkedIn en la lista actual del
// usuario (o al principio, si no tiene LinkedIn agregado). Después de esa
// primera vez, quedan bajo control total del usuario — si los borra, no
// vuelven a aparecer solos.
function inyectarDriveOnedrive() {
  try {
    if (localStorage.getItem(DRIVE_INJECTADO_KEY)) return;

    const sitiosRaw = localStorage.getItem(KEY);
    const sitiosActuales = sitiosRaw ? JSON.parse(sitiosRaw) : [];

    const yaTiene = (nombre) => sitiosActuales.some((s) => s.nombre.toLowerCase() === nombre.toLowerCase());
    const nuevos = [];
    if (!yaTiene('Google Drive')) nuevos.push({ nombre: 'Google Drive', url: 'https://drive.google.com' });
    if (!yaTiene('OneDrive')) nuevos.push({ nombre: 'OneDrive', url: 'https://onedrive.live.com' });

    if (nuevos.length > 0) {
      const idxLinkedIn = sitiosActuales.findIndex((s) => /linkedin/i.test(s.nombre));
      const combinados = [...sitiosActuales];
      if (idxLinkedIn === -1) {
        combinados.unshift(...nuevos);
      } else {
        combinados.splice(idxLinkedIn, 0, ...nuevos);
      }
      localStorage.setItem(KEY, JSON.stringify(combinados));
    }

    localStorage.setItem(DRIVE_INJECTADO_KEY, '1');
  } catch {
    // si algo falla, no se inyecta nada; el usuario puede agregarlos a mano
  }
}

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
  inyectarDriveOnedrive();
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
