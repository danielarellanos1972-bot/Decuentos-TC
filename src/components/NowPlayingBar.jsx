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
  const [enviando, setEnviando] = useState(false);
  const [errorControl, setErrorControl] = useState(null);

  const consultar = () => {
    fetch('/api/spotify')
      .then((r) => r.json())
      .then((d) => setDatos(d))
      .catch(() => {});
  };

  useEffect(() => {
    if (movil) return; // no se consulta nada en el celular

    let activo = true;
    const consultarSiActivo = () => {
      fetch('/api/spotify')
        .then((r) => r.json())
        .then((d) => activo && setDatos(d))
        .catch(() => {});
    };

    consultarSiActivo();
    const id = setInterval(consultarSiActivo, 8000);
    return () => {
      activo = false;
      clearInterval(id);
    };
  }, [movil]);

  const controlar = async (accion) => {
    setEnviando(true);
    setErrorControl(null);
    try {
      const resp = await fetch('/api/spotify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion }),
      });
      const d = await resp.json();
      if (!d.ok) {
        setErrorControl(d.error || 'No se pudo enviar el comando.');
      } else if (accion === 'play' || accion === 'pause') {
        // Actualización optimista mientras llega el próximo sondeo
        setDatos((prev) => (prev ? { ...prev, reproduciendo: accion === 'play' } : prev));
      }
      // Da un pequeño margen para que Spotify procese el cambio antes de refrescar
      setTimeout(consultar, 700);
    } catch {
      setErrorControl('No se pudo conectar con Spotify.');
    } finally {
      setEnviando(false);
    }
  };

  if (movil) return null;
  if (!datos || (!datos.reproduciendo && !datos.cancion)) return null;
  if (!datos.cancion) return null;

  const progresoPct = datos.duracionMs ? Math.min(100, (datos.progresoMs / datos.duracionMs) * 100) : 0;

  return (
    <div style={styles.barra}>
      <div style={styles.contenido}>
        <a href={datos.urlSpotify || 'https://open.spotify.com'} target="_blank" rel="noreferrer" style={styles.linkInfo}>
          {datos.portada && <img src={datos.portada} alt="" style={styles.portada} />}
          <div style={styles.textoWrap}>
            <p style={styles.cancion}>{datos.cancion}</p>
            <p style={styles.artista}>{datos.artistas}{datos.album ? ` · ${datos.album}` : ''}</p>
            <div style={styles.progresoFondo}>
              <div style={{ ...styles.progresoBarra, width: `${progresoPct}%` }} />
            </div>
          </div>
        </a>

        <div style={styles.controles}>
          <button style={styles.botonControl} onClick={() => controlar('previous')} disabled={enviando} title="Anterior">
            ⏮
          </button>
          <button
            style={{ ...styles.botonControl, ...styles.botonPrincipal }}
            onClick={() => controlar(datos.reproduciendo ? 'pause' : 'play')}
            disabled={enviando}
            title={datos.reproduciendo ? 'Pausar' : 'Reproducir'}
          >
            {datos.reproduciendo ? '⏸' : '▶'}
          </button>
          <button style={styles.botonControl} onClick={() => controlar('next')} disabled={enviando} title="Siguiente">
            ⏭
          </button>
        </div>

        <span style={styles.tiempo}>
          {formatearTiempo(datos.progresoMs)} / {formatearTiempo(datos.duracionMs)}
        </span>
      </div>
      {errorControl && <p style={styles.errorControl}>{errorControl}</p>}
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
    gap: '14px',
    padding: '8px 18px',
  },
  linkInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    textDecoration: 'none',
    color: 'inherit',
    flex: 1,
    minWidth: 0,
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
  controles: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flexShrink: 0,
  },
  botonControl: {
    background: 'transparent',
    border: 'none',
    color: 'var(--paper-050)',
    fontSize: '1rem',
    cursor: 'pointer',
    padding: '6px 8px',
    borderRadius: '6px',
    lineHeight: 1,
  },
  botonPrincipal: {
    background: 'var(--navy-800)',
    fontSize: '1.05rem',
  },
  tiempo: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.68rem',
    opacity: 0.55,
    flexShrink: 0,
  },
  errorControl: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '0 18px 8px',
    fontSize: '0.68rem',
    color: 'var(--coral-500)',
  },
};
