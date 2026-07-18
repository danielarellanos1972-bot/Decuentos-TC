import { useEffect, useState } from 'react';

// Logos reales (mismo servicio de favicons que ya usamos para bancos y
// webs), en vez de un punto de color genérico.
const FUENTES = {
  gmail: {
    logo: 'https://www.google.com/s2/favicons?sz=64&domain=mail.google.com',
    color: 'var(--mint-300)',
    etiqueta: 'Gmail',
    urlWeb: 'https://mail.google.com/mail/u/0/#inbox',
  },
  outlook: {
    logo: 'https://www.google.com/s2/favicons?sz=64&domain=outlook.com',
    color: '#4FA0E0',
    etiqueta: 'Outlook',
    urlWeb: 'https://outlook.live.com/mail/0/inbox',
  },
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

// Teams y Google Meet: links estáticos y honestos (sin JavaScript de por
// medio) — "msteams://" es el protocolo oficial documentado por Microsoft
// para abrir la app de escritorio directo. Google Meet no tiene un
// protocolo propio confiable, así que va directo a la web.
const OTRAS_APPS = [
  {
    key: 'teams',
    logo: 'https://www.google.com/s2/favicons?sz=64&domain=teams.microsoft.com',
    etiqueta: 'Teams',
    href: 'msteams://',
  },
  {
    key: 'meet',
    logo: 'https://www.google.com/s2/favicons?sz=64&domain=meet.google.com',
    etiqueta: 'Google Meet',
    href: 'https://meet.google.com',
  },
];

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

  const renderCeldaCorreo = (key, info) => {
    const fuente = FUENTES[key];
    const tieneError = info?.error;
    const cantidad = info?.unread;

    return (
      <a
        href={obtenerUrlDestino(fuente)}
        target="_blank"
        rel="noreferrer"
        className="card-face-hover"
        style={styles.celda}
      >
        <img src={fuente.logo} alt="" style={styles.logo} />
        <p style={styles.celdaLabel}>{fuente.etiqueta}</p>
        {loading ? (
          <span style={styles.cargando}>Cargando…</span>
        ) : tieneError ? (
          <span style={styles.noDisponible}>No disponible</span>
        ) : (
          <>
            <span style={{ ...styles.cantidad, color: cantidad > 0 ? fuente.color : 'var(--paper-100)' }}>
              {cantidad}
            </span>
            <span style={styles.subLabel}>Correos sin leer</span>
          </>
        )}
      </a>
    );
  };

  const renderCeldaApp = (app) => (
    <a key={app.key} href={app.href} target="_blank" rel="noreferrer" className="card-face-hover" style={styles.celda}>
      <img src={app.logo} alt="" style={styles.logo} />
      <p style={styles.celdaLabel}>{app.etiqueta}</p>
      <span style={styles.subLabel}>Abrir aplicación</span>
    </a>
  );

  return (
    <section style={styles.wrap}>
      <h2 style={styles.h2}>Correo y otros</h2>
      <div style={styles.grid}>
        {renderCeldaCorreo('gmail', data?.gmail)}
        {renderCeldaCorreo('outlook', data?.outlook)}
        {OTRAS_APPS.map(renderCeldaApp)}
      </div>
      <p style={styles.fuenteNota}>Correo: app de Outlook en Mac, Mail en iPhone. Teams y Meet abren directo la app o la web.</p>
    </section>
  );
}

const styles = {
  wrap: { marginTop: '28px' },
  h2: { fontFamily: 'var(--font-display)', fontSize: '2rem', margin: '0 0 8px', color: 'var(--paper-050)' },
  grid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px',
  },
  celda: {
    background: 'var(--navy-900)', border: '1px solid var(--navy-700)', borderRadius: '14px',
    padding: '16px 14px', textDecoration: 'none', color: 'inherit',
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px',
  },
  logo: {
    width: '26px', height: '26px', borderRadius: '6px',
    background: '#fff', objectFit: 'contain', padding: '3px', marginBottom: '6px',
  },
  celdaLabel: { fontSize: '0.9rem', fontWeight: 600, color: 'var(--paper-050)', margin: 0 },
  subLabel: { fontSize: '0.65rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.04em' },
  cantidad: { fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.3 },
  cargando: { fontSize: '0.78rem', opacity: 0.5, marginTop: '4px' },
  noDisponible: { fontSize: '0.72rem', color: 'var(--coral-500)', marginTop: '4px' },
  fuenteNota: { fontSize: '0.65rem', opacity: 0.45, margin: '10px 0 6px' },
};
