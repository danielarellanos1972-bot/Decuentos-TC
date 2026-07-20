import { useState } from 'react';
import { getSitios, saveSitios } from '../utils/webLinks.js';

function faviconUrl(url) {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
  } catch {
    return null;
  }
}

// Spotify sí tiene un esquema de apertura oficial y bien documentado
// (spotify:), a diferencia de los bancos chilenos. Se usa como un link
// normal y honesto: si el sistema operativo tiene la app registrada para
// ese esquema, la abre directo; si no, simplemente no pasa nada (sin
// redireccionamientos por JavaScript de respaldo, que es justo el patrón
// que Google Safe Browsing puede confundir con phishing).
function esSpotify(sitio) {
  return /spotify/i.test(sitio.nombre) || /spotify\.com/i.test(sitio.url);
}

// Mismo criterio que Spotify: WhatsApp Desktop registra el esquema oficial
// "whatsapp://" al instalarse (Windows y Mac). Si la app está instalada, el
// sistema operativo la abre directo; si no, el navegador simplemente no
// hace nada — igual de honesto que el caso de Spotify, sin JavaScript de
// respaldo que redirija a la web.
function esWhatsApp(sitio) {
  return /whatsapp/i.test(sitio.nombre) || /whatsapp\.com/i.test(sitio.url);
}

function obtenerHref(sitio) {
  if (esSpotify(sitio)) return 'spotify:preferences';
  if (esWhatsApp(sitio)) return 'whatsapp://send';
  return sitio.url;
}

export default function WebLinks() {
  const [sitios, setSitios] = useState(getSitios());
  const [nombre, setNombre] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState(null);

  const agregar = () => {
    const n = nombre.trim();
    let u = url.trim();
    if (!n || !u) {
      setError('Completa el nombre y el sitio web.');
      return;
    }
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    try {
      new URL(u);
    } catch {
      setError('El sitio web no es válido.');
      return;
    }
    setError(null);
    const actualizado = [...sitios, { nombre: n, url: u }];
    setSitios(actualizado);
    saveSitios(actualizado);
    setNombre('');
    setUrl('');
  };

  const quitar = (nombreQuitar) => {
    const actualizado = sitios.filter((s) => s.nombre !== nombreQuitar);
    setSitios(actualizado);
    saveSitios(actualizado);
  };

  return (
    <section style={styles.section}>
      <h2 style={styles.h2}>Webs de Interés</h2>
      <div style={styles.grid}>
        {sitios.map((s, i) => (
          <div key={i} style={styles.card} className="card-face-hover">
            <button style={styles.removeBtn} onClick={() => quitar(s.nombre)} title="Quitar">✕</button>
            <a href={obtenerHref(s)} target="_blank" rel="noreferrer" style={styles.link}>
              <img src={faviconUrl(s.url)} alt="" style={styles.logo} />
              <span style={styles.name}>{s.nombre}</span>
            </a>
          </div>
        ))}
      </div>
      <div style={styles.addRow}>
        <input
          style={styles.input}
          placeholder="Nombre (ej: Emol)"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && agregar()}
        />
        <input
          style={styles.input}
          placeholder="Sitio web (ej: emol.com)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && agregar()}
        />
        <button style={styles.addBtn} onClick={agregar}>+</button>
      </div>
      {error && <p style={styles.error}>{error}</p>}
    </section>
  );
}

const styles = {
  section: { marginTop: '32px' },
  h2: { fontFamily: 'var(--font-display)', fontSize: '2rem', margin: '0 0 8px', color: 'var(--paper-050)' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
  },
  card: {
    position: 'relative',
    background: 'var(--navy-900)',
    border: '1px solid var(--navy-700)',
    borderRadius: '12px',
    padding: '12px 8px',
  },
  link: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    textDecoration: 'none',
  },
  logo: {
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    background: '#fff',
    objectFit: 'contain',
    padding: '2px',
  },
  name: {
    fontSize: '0.72rem',
    color: 'var(--paper-050)',
    textAlign: 'center',
    fontWeight: 600,
  },
  removeBtn: {
    position: 'absolute',
    top: '4px',
    right: '4px',
    background: 'transparent',
    border: 'none',
    color: 'var(--paper-100)',
    opacity: 0.35,
    fontSize: '0.65rem',
    cursor: 'pointer',
    padding: '2px',
  },
  addRow: {
    display: 'flex',
    gap: '6px',
    marginTop: '12px',
  },
  input: {
    flex: 1,
    background: 'var(--navy-800)',
    border: '1px solid var(--navy-700)',
    borderRadius: '8px',
    padding: '7px 10px',
    color: 'var(--paper-050)',
    fontSize: '0.78rem',
    outline: 'none',
    minWidth: 0,
  },
  addBtn: {
    background: 'var(--gold-500)',
    color: 'var(--navy-950)',
    border: 'none',
    borderRadius: '8px',
    padding: '0 14px',
    fontWeight: 700,
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  error: {
    fontSize: '0.72rem',
    color: 'var(--coral-500)',
    marginTop: '6px',
  },
};
