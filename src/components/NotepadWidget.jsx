import { useEffect, useRef, useState } from 'react';
import { cargarLocal, cargarRemoto, guardarSincronizado } from '../utils/sync.js';

const KEY = 'descuentos-tc-notas-rapidas';
const CLAVE_SYNC = 'notas';

export default function NotepadWidget() {
  const [texto, setTexto] = useState(() => cargarLocal(KEY, ''));
  const [guardado, setGuardado] = useState(true);
  const timeoutRef = useRef(null);

  // Al entrar, revisa si hay algo más nuevo guardado desde otro
  // dispositivo (PC/celular) y lo usa si existe.
  useEffect(() => {
    let activo = true;
    cargarRemoto(CLAVE_SYNC).then((valorRemoto) => {
      if (activo && valorRemoto != null) setTexto(valorRemoto);
    });
    return () => {
      activo = false;
      clearTimeout(timeoutRef.current);
    };
  }, []);

  const manejarCambio = (e) => {
    const valor = e.target.value;
    setTexto(valor);
    setGuardado(false);

    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      guardarSincronizado(KEY, CLAVE_SYNC, valor);
      setGuardado(true);
    }, 500);
  };

  const limpiar = () => {
    setTexto('');
    setGuardado(false);
    clearTimeout(timeoutRef.current);
    guardarSincronizado(KEY, CLAVE_SYNC, '');
    setGuardado(true);
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
