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
            <a href={b.url} target="_blank" rel="noreferrer" style={styles.link}>
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
  h2: { fontFamily: 'var(--font-display)', fontSize: '1.15rem', margin: '0 0 12px' },
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
