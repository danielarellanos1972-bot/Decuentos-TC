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
          {mensaje || 'Selecciona una tarjeta y una categoría, luego presiona "Buscar Oferta".'}
        </p>
      </div>
    );
  }

  return (
    <div style={styles.list}>
      {ofertas.map((o, i) => (
        <article key={i} style={styles.card}>
          <div style={styles.accentBar} />

          <div style={styles.topRow}>
            <h3 style={styles.comercio}>{o.comercio}</h3>
            <span style={styles.descuento}>{o.descuento}</span>
          </div>

          {o.condiciones && o.condiciones !== 'No especificado' && (
            <p style={styles.condiciones}>{o.condiciones}</p>
          )}

          <div style={styles.perforacion} />

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
  list: { display: 'flex', flexDirection: 'column', gap: '14px' },
  card: {
    background: 'linear-gradient(160deg, var(--navy-800), var(--navy-900))',
    border: '1px solid var(--navy-700)', borderRadius: '16px',
    padding: '18px 18px 16px 24px', position: 'relative', overflow: 'hidden',
    boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
  },
  accentBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: '5px', background: 'var(--mint-500)',
  },
  topRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' },
  comercio: {
    fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, margin: 0,
    color: 'var(--paper-050)', lineHeight: 1.25,
  },
  descuento: {
    background: 'var(--gold-500)', color: 'var(--navy-950)', fontWeight: 800, fontSize: '0.95rem',
    borderRadius: '10px', padding: '7px 13px', whiteSpace: 'nowrap',
    transform: 'rotate(-3deg)', boxShadow: '0 2px 8px rgba(0,0,0,0.35)', flexShrink: 0,
  },
  condiciones: { fontSize: '0.88rem', opacity: 0.85, margin: '0 0 4px', lineHeight: 1.5, color: 'var(--paper-100)' },
  perforacion: {
    borderTop: '1px dashed var(--navy-700)', margin: '10px 0',
  },
  bottomRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' },
  vigencia: { fontSize: '0.78rem', opacity: 0.6, color: 'var(--paper-100)' },
  fuente: { fontSize: '0.78rem', color: 'var(--mint-300)', textDecoration: 'none', fontWeight: 600 },
};
