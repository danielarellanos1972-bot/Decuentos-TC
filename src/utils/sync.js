// Sincroniza un dato entre dispositivos: guarda instantáneo en localStorage
// (para que la pantalla no quede en blanco mientras carga) y al mismo
// tiempo en la base de datos compartida (Vercel KV), para que lo mismo
// aparezca en cualquier otro dispositivo donde entres.

export function cargarLocal(key, porDefecto) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : porDefecto;
  } catch {
    return porDefecto;
  }
}

function guardarLocal(key, valor) {
  try {
    localStorage.setItem(key, JSON.stringify(valor));
  } catch {
    // no crítico si falla — sigue funcionando en esta sesión igual
  }
}

// Pide el dato guardado en el servidor. Si el servidor tiene algo, ese es
// el que manda (más reciente que lo que haya localmente); si no responde o
// no hay nada guardado ahí todavía, se sigue usando lo que ya había local.
export async function cargarRemoto(claveSync) {
  try {
    const resp = await fetch(`/api/geocode?type=sync&key=${encodeURIComponent(claveSync)}`);
    const data = await resp.json();
    return data.valor ?? null;
  } catch {
    return null;
  }
}

// Guarda tanto local como en el servidor. No espera a que el servidor
// responda para no trabar la pantalla — si falla el guardado remoto, el
// dato igual queda a salvo en este dispositivo.
export function guardarSincronizado(keyLocal, claveSync, valor) {
  guardarLocal(keyLocal, valor);
  fetch(`/api/geocode?type=sync&key=${encodeURIComponent(claveSync)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ valor }),
  }).catch(() => {
    // si falla la sincronización, no es crítico — el dato ya quedó guardado local
  });
}
