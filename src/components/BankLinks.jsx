import { useState } from 'react';
import { getBancos, saveBancos } from '../utils/bankLinks.js';

function faviconUrl(url) {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
  } catch {
    return null;
  }
}

// IDs reales de App Store para los bancos que Nano usa (Scotiabank, Banco de
// Chile, Santander, Itaú). Para cualquier otro banco que se agregue, se cae
// a una búsqueda dentro de la tienda — funciona igual, solo un toque extra.
const APPS_BANCARIAS = [
  { match: /scotia/i, iosId: 1309863707 },
  { match: /banco\s*de\s*chile|bancochile|edwards/i, iosId: 1516872542 },
  { match: /santander/i, iosId: 604982236 },
  { match: /ita[uú]/i, iosId: 636150714 },
];

// En el celular, en vez de abrir el sitio web del banco, se manda directo a
// la ficha de la app en la tienda correspondiente: si ya está instalada, el
// botón dice "Abrir"; si no, dice "Obtener/Instalar". En PC/Mac se mantiene
// el comportamiento original (abrir el sitio web).
function obtenerUrlDestino(nombreBanco, urlWeb) {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const esIOS = /iPhone|iPad|iPod/.test(ua);
  const esAndroid = /Android/.test(ua);

  if (!esIOS && !esAndroid) return urlWeb;

  if (esIOS) {
    const conocida = APPS_BANCARIAS.find((a) => a.match.test(nombreBanco));
    return conocida
      ? `https://apps.apple.com/cl/app/id${conocida.iosId}`
      : `https://apps.apple.com/cl/search?term=${encodeURIComponent(nombreBanco)}`;
  }

  // Android: la búsqueda en Play Store funciona para cualquier banco sin
  // necesitar el nombre exacto del paquete.
  return `https://play.google.com/store/search?q=${encodeURIComponent(nombreBanco)}&c=apps`;
}

export default function BankLinks() {
  const [bancos, setBancos] = useState(getBancos());
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
    const actualizado = [...bancos, { nombre: n, url: u }];
    setBancos(actualizado);
    saveBancos(actualizado);
    setNombre('');
    setUrl('');
  };

  const quitar = (nombreQuitar) => {
    const actualizado = bancos.filter((b) => b.nombre !== nombreQuitar);
    setBancos(actualizado);
    saveBancos(actualizado);
  };

  return (
    <section style={styles.section}>
      <h2 style={styles.h2}>Bancos</h2>
      <div style={styles.grid}>
        {bancos.map((b, i) => (
          <div key={i} style={styles.card}>
            <button style={styles.removeBtn} onClick={() => quitar(b.nombre)} title="Quitar">✕</button>
            <a href={obtenerUrlDestino(b.nombre, b.url)} target="_blank" rel="noreferrer" style={styles.link}>
              <img src={faviconUrl(b.url)} alt="" style={styles.logo} />
              <span style={styles.name}>{b.nombre}</span>
            </a>
          </div>
        ))}
      </div>
      <div style={styles.addRow}>
        <input
          style={styles.input}
          placeholder="Nombre (ej: BCI)"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && agregar()}
        />
        <input
          style={styles.input}
          placeholder="Sitio web (ej: bci.cl)"
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
