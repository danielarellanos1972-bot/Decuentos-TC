import { useState } from 'react';

export default function BuscadorOneDrive() {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState(null);

  function buscar(e) {
    e.preventDefault();
    const termino = q.trim();
    if (!termino) return;
    setBuscando(true);
    setError(null);
    setResultados(null);
    fetch(`/api/unread-mail?tipo=onedrive&q=${encodeURIComponent(termino)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setResultados(d.resultados);
      })
      .catch(() => setError('No se pudo buscar en OneDrive.'))
      .finally(() => setBuscando(false));
  }

  function formatearFecha(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return '';
    }
  }

  return (
    <section style={styles.section}>
      <h2 style={styles.h2}>Buscar en OneDrive</h2>
      <p style={styles.sub}>Por nombre de archivo (con o sin extensión) o por palabras dentro del documento.</p>

      <form style={styles.formFila} onSubmit={buscar}>
        <input
          style={styles.input}
          type="text"
          placeholder="ej: presupuesto 2026, informe.docx, contrato..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button style={styles.botonBuscar} type="submit" disabled={buscando}>
          {buscando ? 'Buscando…' : '🔍 Buscar'}
        </button>
      </form>

      {error && <p style={styles.error}>{error}</p>}

      {resultados && (
        <div style={styles.resultadosWrap}>
          <p style={styles.contador}>
            {resultados.length === 0 ? 'Sin resultados.' : `${resultados.length} resultado${resultados.length === 1 ? '' : 's'}`}
          </p>
          {resultados.map((r, i) => (
            <a key={i} href={r.webUrl} target="_blank" rel="noreferrer" style={styles.fila}>
              <span style={{ ...styles.icono, background: r.tipoColor }}>{r.tipoIcono}</span>
              <span style={styles.filaTexto}>
                <span style={styles.nombre}>{r.nombre}</span>
                <span style={styles.meta}>
                  <span style={{ ...styles.etiqueta, color: r.tipoColor }}>{r.tipoEtiqueta}</span>
                  {r.carpeta && <span> · {r.carpeta}</span>}
                  {r.tamano && <span> · {r.tamano}</span>}
                  {r.modificado && <span> · {formatearFecha(r.modificado)}</span>}
                </span>
              </span>
              <span style={styles.abrir}>Abrir ↗</span>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

const styles = {
  section: { marginTop: '32px' },
  h2: { fontFamily: 'var(--font-display)', fontSize: '2rem', margin: '0 0 4px', color: 'var(--paper-050)' },
  sub: { fontSize: '0.85rem', color: 'var(--paper-100)', margin: '0 0 14px' },
  formFila: { display: 'flex', gap: '8px' },
  input: {
    flex: 1, background: 'var(--navy-900)', border: '1px solid var(--navy-700)', color: 'var(--paper-050)',
    borderRadius: '10px', padding: '11px 14px', fontSize: '0.9rem', outline: 'none',
    fontFamily: 'var(--font-body)',
  },
  botonBuscar: {
    background: 'var(--gold-500)', border: 'none', color: 'var(--navy-950)', borderRadius: '10px',
    padding: '11px 18px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  error: { fontSize: '0.8rem', color: 'var(--cal-red)', marginTop: '10px' },
  resultadosWrap: { marginTop: '16px' },
  contador: { fontSize: '0.75rem', color: 'var(--paper-100)', margin: '0 0 10px' },
  fila: {
    display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none',
    background: 'var(--navy-900)', border: '1px solid var(--navy-700)', borderRadius: '10px',
    padding: '12px 14px', marginBottom: '8px',
  },
  icono: {
    flexShrink: 0, width: '34px', height: '34px', borderRadius: '8px', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem',
  },
  filaTexto: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 },
  nombre: {
    fontSize: '0.9rem', fontWeight: 600, color: 'var(--paper-050)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  meta: { fontSize: '0.72rem', color: 'var(--paper-100)' },
  etiqueta: { fontWeight: 700 },
  abrir: { flexShrink: 0, fontSize: '0.75rem', color: 'var(--gold-500)', fontWeight: 600, whiteSpace: 'nowrap' },
};
