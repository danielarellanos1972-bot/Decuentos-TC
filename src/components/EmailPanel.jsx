import { useEffect, useState } from 'react';

// Mismos colores de marca usados en el Calendario, para que Google/Outlook
// se reconozcan de un vistazo en toda la app.
const FUENTES = {
  gmail: { color: 'var(--mint-300)', etiqueta: 'Correo Google', urlWeb: 'https://mail.google.com/mail/u/0/#inbox' },
  outlook: { color: '#4FA0E0', etiqueta: 'Correo Outlook', urlWeb: 'https://outlook.live.com/mail/0/inbox' },
};

// En Mac abre la app nativa de Outlook (donde Nano tiene ambas cuentas
// agregadas); en iPhone abre la app Mail nativa de Apple. En cualquier otro
// dispositivo (Windows, Android, etc.) se usa el link web normal como
// respaldo.
function obtenerUrlDestino(fuente) {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const esIOS = /iPhone|iPad|iPod/.test(ua);
  const esMac = /Macintosh/.test(ua) && !esIOS;

  if (esIOS) return 'message://';
  if (esMac) return 'ms-outlook://';
  return fuente.urlWeb;
}

export default function EmailPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let activo = true;
    fetch('/api/unread-mail')
      .then((r) => r.json())
      .then((d) => activo && setData(d))
      .catch(() => activo && setData({ gmail: { error: 'No disponible' }, outlook: { error: 'No disponible' } }))
      .finally(() => activo && setLoading(false));
    return () => { activo = false; };
  }, []);

  const renderFila = (key, info) => {
    const fuente = FUENTES[key];
    const tieneError = info?.error;
    const cantidad = info?.unread;

    return (
      <a href={obtenerUrlDestino(fuente)} target="_blank" rel="noreferrer" style={styles.fila}>
        <div style={styles.filaIzq}>
          <span style={{ ...styles.punto, background: fuente.color }} />
          <span style={styles.filaLabel}>{fuente.etiqueta}</span>
        </div>
        <div style={styles.filaDer}>
          {loading ? (
            <span style={styles.cargando}>Cargando…</span>
          ) : tieneError ? (
            <span style={styles.noDisponible}>No disponible</span>
          ) : (
            <>
              <span style={styles.subLabel}>Correos sin leer</span>
              <span style={{ ...styles.cantidad, color: cantidad > 0 ? fuente.color : 'var(--paper-100)' }}>
                {cantidad}
              </span>
            </>
          )}
        </div>
      </a>
    );
  };

  return (
    <section style={styles.wrap}>
      <h2 style={styles.h2}>Correos</h2>
      <div style={styles.card}>
        {renderFila('gmail', data?.gmail)}
        <div style={styles.divider} />
        {renderFila('outlook', data?.outlook)}
        <p style={styles.fuenteNota}>Toca una fila para abrir tu correo (app de Outlook en Mac, Mail en iPhone).</p>
      </div>
    </section>
  );
}

const styles = {
  wrap: { marginTop: '28px' },
  h2: { fontFamily: 'var(--font-display)', fontSize: '2rem', margin: '0 0 8px', color: 'var(--paper-050)' },
  card: {
    background: 'var(--navy-900)', border: '1px solid var(--navy-700)',
    borderRadius: '14px', padding: '6px 16px',
  },
  fila: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 0', textDecoration: 'none', color: 'inherit',
  },
  filaIzq: { display: 'flex', alignItems: 'center', gap: '10px' },
  punto: { width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0 },
  filaLabel: { fontSize: '0.95rem', fontWeight: 600, color: 'var(--paper-050)' },
  filaDer: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' },
  subLabel: { fontSize: '0.68rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.04em' },
  cantidad: { fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 700, lineHeight: 1 },
  cargando: { fontSize: '0.82rem', opacity: 0.5 },
  noDisponible: { fontSize: '0.78rem', color: 'var(--coral-500)' },
  divider: { height: '1px', background: 'var(--navy-700)' },
  fuenteNota: { fontSize: '0.65rem', opacity: 0.45, margin: '10px 0 6px' },
};
