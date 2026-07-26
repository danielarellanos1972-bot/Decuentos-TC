import { useState } from 'react';

export default function NewsReportPanel() {
  const [generando, setGenerando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);

  function generar() {
    setGenerando(true);
    setError(null);
    setResultado(null);
    fetch('/api/resumen-diario?reporte=noticias&accion=ver')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setResultado(d);
      })
      .catch(() => setError('No se pudo generar el reporte.'))
      .finally(() => setGenerando(false));
  }

  return (
    <section style={styles.section}>
      <h2 style={styles.h2}>Reporte de Noticias LinkedIn</h2>
      <p style={styles.sub}>
        Busca noticias sectoriales de las últimas 24-72h y redacta posts LinkedIn C-Level para cada una.
      </p>
      <button style={styles.boton} onClick={generar} disabled={generando}>
        {generando ? 'Buscando noticias y redactando…' : '📰 Generar reporte de hoy'}
      </button>
      <p style={styles.subCampo}>
        También se envía automáticamente a tu Gmail todos los días a las 8:00, con un link para abrirlo.
      </p>

      {error && <p style={styles.error}>{error}</p>}

      {resultado && (
        <div style={styles.resultadoCaja}>
          <p style={styles.resultadoTexto}>
            Listo — {resultado.cantidad} noticias seleccionadas para {resultado.fechaTitulo}.
          </p>
          <a href={resultado.url} target="_blank" rel="noreferrer" style={styles.botonAbrir}>
            Abrir reporte ↗
          </a>
          {resultado.diagnosticoRedaccion && (
            <p style={styles.diagnostico}>🔧 {resultado.diagnosticoRedaccion}</p>
          )}
        </div>
      )}
    </section>
  );
}

const styles = {
  section: {
    background: 'var(--navy-900)', border: '1px solid var(--navy-700)', borderRadius: '16px',
    padding: '20px', marginTop: '20px',
  },
  h2: { fontFamily: 'var(--font-display)', fontSize: '2rem', margin: '0 0 8px', color: 'var(--paper-050)' },
  sub: { fontSize: '0.85rem', color: 'var(--paper-100)', margin: '0 0 14px' },
  boton: {
    background: 'var(--gold-500)', color: '#fff', border: 'none', borderRadius: '10px',
    padding: '12px 18px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', width: '100%',
  },
  subCampo: { fontSize: '0.72rem', color: 'var(--paper-100)', margin: '8px 0 0' },
  error: { color: 'var(--cal-red)', fontSize: '0.85rem', marginTop: '10px' },
  resultadoCaja: {
    marginTop: '14px', background: 'var(--navy-800)', border: '1px solid var(--navy-700)',
    borderRadius: '10px', padding: '14px',
  },
  resultadoTexto: { fontSize: '0.85rem', color: 'var(--paper-050)', margin: '0 0 10px' },
  botonAbrir: {
    display: 'inline-block', background: 'var(--gold-500)', color: '#fff', textDecoration: 'none',
    fontSize: '0.85rem', fontWeight: 700, padding: '8px 16px', borderRadius: '999px',
  },
  diagnostico: { fontSize: '0.68rem', color: 'var(--paper-100)', marginTop: '10px', fontFamily: 'var(--font-mono)' },
};
