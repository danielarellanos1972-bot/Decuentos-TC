import { useEffect, useState } from 'react';

function esMovil() {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

function formatearTiempo(ms) {
  const totalSeg = Math.floor((ms || 0) / 1000);
  const min = Math.floor(totalSeg / 60);
  const seg = totalSeg % 60;
  return `${min}:${String(seg).padStart(2, '0')}`;
}

export default function NowPlayingBar() {
  const [datos, setDatos] = useState(null);
  const [movil] = useState(esMovil());

  useEffect(() => {
    if (movil) return; // no se consulta nada en el celular

    let activo = true;
    const consultar = () => {
      fetch('/api/spotify-now-playing')
        .then((r) => r.json())
        .then((d) => activo && setDatos(d))
        .catch(() => {});
    };

    consultar();
    const id = setInterval(consultar, 8000);
    return () => {
      activo = false;
      clearInterval(id);
    };
  }, [movil]);

  if (movil) return null;
  if (!datos || !datos.reproduciendo || !datos.cancion) return null;

  const progresoPct = datos.duracionMs ? Math.min(100, (datos.progresoMs / datos.duracionMs) * 100) : 0;

  return (
    <div style={styles.barra}>
      <a
        href={datos.urlSpotify || 'https://open.spotify.com'}
        target="_blank"
        rel="noreferrer"
        style={styles.contenido}
      >
        {datos.portada && <img src={datos.portada} alt="" style={styles.portada} />}
        <div style={styles.textoWrap}>
          <p style={styles.cancion}>{datos.cancion}</p>
          <p style={styles.artista}>{datos.artistas}{datos.album ? ` · ${datos.album}` : ''}</p>
          <div style={styles.progresoFondo}>
            <div style={{ ...styles.progresoBarra, width: `${progresoPct}%` }} />
          </div>
        </div>
        <span style={styles.tiempo}>
          {formatearTiempo(datos.progresoMs)} / {formatearTiempo(datos.duracionMs)}
        </span>
        <span style={styles.iconoSpotify}>🎵</span>
      </a>
    </div>
  );
}

const styles = {
  barra: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 900,
    background: 'var(--navy-950)',
    borderTop: '1px solid var(--navy-700)',
    boxShadow: '0 -8px 24px rgba(0,0,0,0.35)',
  },
  contenido: {
    maxWidth: '900px',
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 18px',
    textDecoration: 'none',
    color: 'inherit',
  },
  portada: {
    width: '40px',
    height: '40px',
    borderRadius: '6px',
    objectFit: 'cover',
    flexShrink: 0,
  },
  textoWrap: {
    flex: 1,
    minWidth: 0,
  },
  cancion: {
    fontSize: '0.82rem',
    fontWeight: 700,
    color: 'var(--paper-050)',
    margin: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  artista: {
    fontSize: '0.7rem',
    opacity: 0.65,
    margin: '1px 0 4px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  progresoFondo: {
    height: '3px',
    background: 'var(--navy-700)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  progresoBarra: {
    height: '100%',
    background: 'var(--mint-300)',
  },
  tiempo: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.68rem',
    opacity: 0.55,
    flexShrink: 0,
  },
  iconoSpotify: {
    fontSize: '1.1rem',
    flexShrink: 0,
  },
};
