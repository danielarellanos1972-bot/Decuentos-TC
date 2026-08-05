import { useState } from 'react';

const KEY = 'descuentos-tc-tareas';

function cargarTareas() {
  try {
    const saved = localStorage.getItem(KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function guardarTareas(lista) {
  try {
    localStorage.setItem(KEY, JSON.stringify(lista));
  } catch {
    // no crítico si falla el guardado
  }
}

export default function TodoListWidget() {
  const [tareas, setTareas] = useState(cargarTareas);
  const [texto, setTexto] = useState('');

  const agregar = () => {
    const valor = texto.trim();
    if (!valor) return;
    const nueva = { id: Date.now(), texto: valor, hecha: false };
    const actualizado = [...tareas, nueva];
    setTareas(actualizado);
    guardarTareas(actualizado);
    setTexto('');
  };

  const alternar = (id) => {
    const actualizado = tareas.map((t) => (t.id === id ? { ...t, hecha: !t.hecha } : t));
    setTareas(actualizado);
    guardarTareas(actualizado);
  };

  const quitar = (id) => {
    const actualizado = tareas.filter((t) => t.id !== id);
    setTareas(actualizado);
    guardarTareas(actualizado);
  };

  const pendientes = tareas.filter((t) => !t.hecha).length;

  return (
    <div style={styles.panel}>
      <div style={styles.headerRow}>
        <p style={styles.panelTitle}>Tareas</p>
        {tareas.length > 0 && (
          <span style={styles.contador}>{pendientes} pendiente{pendientes !== 1 ? 's' : ''}</span>
        )}
      </div>

      <div style={styles.addRow}>
        <input
          style={styles.addInput}
          placeholder="Agregar tarea…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && agregar()}
        />
        <button style={styles.addBtn} onClick={agregar}>+</button>
      </div>

      {tareas.length === 0 ? (
        <p style={styles.vacio}>Sin tareas por ahora.</p>
      ) : (
        <div style={styles.lista}>
          {tareas.map((t) => (
            <div key={t.id} style={styles.item}>
              <label style={styles.itemLabel}>
                <input
                  type="checkbox"
                  checked={t.hecha}
                  onChange={() => alternar(t.id)}
                  style={styles.checkbox}
                />
                <span style={{ ...styles.itemTexto, ...(t.hecha ? styles.itemTachado : {}) }}>
                  {t.texto}
                </span>
              </label>
              <button style={styles.quitarBtn} onClick={() => quitar(t.id)} title="Quitar">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  panel: {
    background: 'var(--navy-900)',
    border: '1px solid var(--navy-700)',
    borderRadius: '14px',
    padding: '18px 16px',
  },
  headerRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px',
  },
  panelTitle: {
    fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--gold-300)', margin: 0,
  },
  contador: { fontSize: '0.62rem', opacity: 0.55 },
  addRow: { display: 'flex', gap: '6px', marginBottom: '10px' },
  addInput: {
    flex: 1, background: 'var(--navy-800)', border: '1px solid var(--navy-700)', borderRadius: '8px',
    padding: '7px 10px', color: 'var(--paper-050)', fontSize: '0.78rem', outline: 'none',
  },
  addBtn: {
    background: 'var(--gold-500)', color: 'var(--navy-950)', border: 'none', borderRadius: '8px',
    padding: '0 14px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
  },
  vacio: { fontSize: '0.78rem', opacity: 0.5, margin: 0 },
  lista: { display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '220px', overflowY: 'auto' },
  item: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px',
    background: 'var(--navy-800)', borderRadius: '8px', padding: '7px 9px',
  },
  itemLabel: { display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0, cursor: 'pointer' },
  checkbox: { flexShrink: 0, width: '15px', height: '15px', accentColor: 'var(--gold-500)', cursor: 'pointer' },
  itemTexto: {
    fontSize: '0.78rem', color: 'var(--paper-050)', overflow: 'hidden', textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemTachado: { opacity: 0.45, textDecoration: 'line-through' },
  quitarBtn: {
    background: 'transparent', border: 'none', color: 'var(--paper-100)', opacity: 0.4,
    fontSize: '0.65rem', cursor: 'pointer', flexShrink: 0, padding: '2px',
  },
};
