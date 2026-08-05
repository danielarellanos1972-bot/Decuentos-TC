import { useEffect, useRef, useState } from 'react';

const KEY = 'descuentos-tc-notas-rapidas';

export default function NotepadWidget() {
  const [texto, setTexto] = useState(() => {
    try {
      return localStorage.getItem(KEY) || '';
    } catch {
      return '';
    }
  });
  const [guardado, setGuardado] = useState(true);
  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  const manejarCambio = (e) => {
    const valor = e.target.value;
    setTexto(valor);
    setGuardado(false);

    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(KEY, valor);
        setGuardado(true);
      } catch {
        // si falla el guardado, no es crítico — el texto sigue visible en pantalla
      }
    }, 500);
  };

  const limpiar = () => {
    setTexto('');
    setGuardado(false);
    clearTimeout(timeoutRef.current);
    try {
      localStorage.removeItem(KEY);
      setGuardado(true);
    } catch {
      // no crítico
    }
  };

  return (
    <div style={styles.panel}>
      <div style={styles.headerRow}>
        <p style={styles.panelTitle}>Notas Rápidas</p>
        <span style={styles.estado}>{guardado ? 'Guardado' : 'Guardando…'}</span>
      </div>
      <textarea
        style={styles.textarea}
        placeholder="Escribe algo rápido, se guarda solo…"
        value={texto}
        onChange={manejarCambio}
      />
      {texto && (
        <button style={styles.limpiarBtn} onClick={limpiar}>Limpiar</button>
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
  estado: { fontSize: '0.62rem', opacity: 0.45 },
  textarea: {
    width: '100%', minHeight: '110px', resize: 'vertical', background: 'var(--navy-800)',
    border: '1px solid var(--navy-700)', borderRadius: '8px', padding: '10px',
    color: 'var(--paper-050)', fontSize: '0.8rem', fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box', lineHeight: 1.5,
  },
  limpiarBtn: {
    marginTop: '8px', background: 'transparent', border: 'none', color: 'var(--coral-500)',
    fontSize: '0.68rem', cursor: 'pointer', padding: 0,
  },
};
