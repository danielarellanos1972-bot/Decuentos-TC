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

// IDs reales de App Store y mejor intento de esquema de apertura directa
// para los bancos que Nano usa (Scotiabank, Banco de Chile, Santander,
// Itaú). Los bancos chilenos no publican oficialmente estos códigos de
// apertura directa, así que "scheme" es una apuesta educada: si acierta,
// abre la app al toque; si no existe, iOS simplemente no hace nada y el
// código sigue de largo al plan B (la tienda) sin romper nada.
const APPS_BANCARIAS = [
  { match: /scotia/i, iosId: 1309863707, scheme: 'scotiabankmovil://' },
  { match: /banco\s*de\s*chile|bancochile|edwards/i, iosId: 1516872542, scheme: 'bancochile://' },
  { match: /santander/i, iosId: 604982236, scheme: 'santander://' },
  { match: /ita[uú]/i, iosId: 636150714, scheme: 'itau://' },
];

// Entidades que no tienen app para clientes (ej. el Banco Central regula,
// no es un banco comercial) — siempre van directo a su sitio web, sin
// intentar buscar una app que no existe.
const SIN_APP = [/banco\s*central/i];

function obtenerUrlTienda(nombreBanco, esIOS) {
  const conocida = APPS_BANCARIAS.find((a) => a.match.test(nombreBanco));
  if (esIOS) {
    return conocida
      ? `https://apps.apple.com/cl/app/id${conocida.iosId}`
      : `https://apps.apple.com/cl/search?term=${encodeURIComponent(nombreBanco)}`;
  }
  return `https://play.google.com/store/search?q=${encodeURIComponent(nombreBanco)}&c=apps`;
}

// En el celular intenta abrir la app directo (si tenemos una apuesta de
// esquema para ese banco); si no se abre nada en ~1.2s (o de plano no
// tenemos esquema para ese banco), cae a la ficha de la tienda como plan B.
// En PC/Mac, o para entidades sin app (SIN_APP), va directo al sitio web.
function manejarClicBanco(nombreBanco, urlWeb) {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const esIOS = /iPhone|iPad|iPod/.test(ua);
  const esAndroid = /Android/.test(ua);

  if (SIN_APP.some((rx) => rx.test(nombreBanco))) {
    window.open(urlWeb, '_blank', 'noopener');
    return;
  }

  if (!esIOS && !esAndroid) {
    window.open(urlWeb, '_blank', 'noopener');
    return;
  }

  const conocida = APPS_BANCARIAS.find((a) => a.match.test(nombreBanco));
  const urlTienda = obtenerUrlTienda(nombreBanco, esIOS);

  if (esIOS && conocida?.scheme) {
    const timer = setTimeout(() => {
      if (document.visibilityState === 'visible') {
        window.location.href = urlTienda;
      }
    }, 1200);
    window.addEventListener('pagehide', () => clearTimeout(timer), { once: true });
    window.location.href = conocida.scheme;
    return;
  }

  window.location.href = urlTienda;
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
            
              href={b.url}
              onClick={(e) => { e.preventDefault(); manejarClicBanco(b.nombre, b.url); }}
              style={styles.link}
            >
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
