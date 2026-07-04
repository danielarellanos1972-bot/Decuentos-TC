export default function OffersList({ ofertas, loading, error, mensaje }) {
  if (loading) {
    return (
      <div style={styles.stateBox}>
        <div style={styles.spinner} />
        <p style={styles.stateText}>Buscando promociones vigentes en la web…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.stateBox}>
        <p style={{ ...styles.stateText, color: 'var(--coral-500)' }}>{error}</p>
      </div>
    );
  }

  if (!ofertas || ofertas.length === 0) {
    return (
      <div style={styles.stateBox}>
        <p style={styles.stateText}>
          {mensaje || 'Selecciona una tarjeta y una categoría, luego presiona "Buscar ofertas".'}
        </p>
      </div>
    );
  }

  return (
    <div style={styles.list}>
      {ofertas.map((o, i) => (
        <article key={i} style={styles.card}>
          <div style={styles.topRow}>
            <h3 style={styles.comercio}>{o.comercio}</h3>
            <span style={styles.descuento}>{o.descuento}</span>
          </div>
          {o.condiciones && o.condiciones !== 'No especificado' && (
            <p style={styles.condiciones}>{o.condiciones}</p>
          )}
          <div style={styles.bottomRow}>
            {o.vigencia && o.vigencia !== 'No especificado' && (
              <span style={styles.vigencia}>Vigencia: {o.vigencia}</span>
            )}
            {o.fuenteUrl && (
              <a href={o.fuenteUrl} target="_blank" rel="noreferrer" style={styles.fuente}>
                Ver fuente ↗
              </a>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

const styles = {
  stateBox: { textAlign: 'center', padding: '48px 16px', opacity: 0.75 },
  spinner: {
    width: '28px', height: '28px', border: '3px solid var(--navy-700)', borderTopColor: 'var(--gold-500)',
    borderRadius: '50%', margin: '0 auto 14px', animation: 'spin 0.8s linear infinite',
  },
  stateText: { fontSize: '0.95rem', color: 'var(--paper-100)' },
  list: { display: 'flex', flexDirection: 'column', gap: '12px' },
  card: {
    background: 'var(--navy-800)', border: '1px solid var(--navy-700)', borderRadius: '14px',
    padding: '16px', borderLeft: '4px solid var(--mint-500)',
  },
  topRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '6px' },
  comercio: { fontFamily: 'var(--font-display)', fontSize: '1.05rem', margin: 0, color: 'var(--paper-100)' },
  descuento: {
    background: 'var(--gold-500)', color: 'var(--navy-950)', fontWeight: 700, fontSize: '0.8rem',
    borderRadius: '999px', padding: '4px 10px', whiteSpace: 'nowrap',
  },
  condiciones: { fontSize: '0.88rem', opacity: 0.85, margin: '0 0 10px', lineHeight: 1.45 },
  bottomRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' },
  vigencia: { fontSize: '0.78rem', opacity: 0.6 },
  fuente: { fontSize: '0.78rem', color: 'var(--mint-300)', textDecoration: 'none' },
};
