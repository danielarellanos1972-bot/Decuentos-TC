import { useEffect, useState } from 'react';
import CardManager from './components/CardManager.jsx';
import CategoryFilter from './components/CategoryFilter.jsx';
import OffersList from './components/OffersList.jsx';
import WeeklyOffers from './components/WeeklyOffers.jsx';
import { DateFXPanel, MarketPanel, WeatherPanel, WorldClockPanel } from './components/InfoPanels.jsx';
import Ticker from './components/Ticker.jsx';
import BankLinks from './components/BankLinks.jsx';
import WebLinks from './components/WebLinks.jsx';
import Calendar from './components/Calendar.jsx';
import EmailPanel from './components/EmailPanel.jsx';
import Calculator from './components/Calculator.jsx';
import NowPlayingBar from './components/NowPlayingBar.jsx';
import { TARJETAS_PRECARGADAS, CATEGORIAS } from './data/bancos.js';
import { getFuenteOficial, getEnlacesPortal } from './data/fuentesOficiales.js';

const STORAGE_KEY = 'descuentos-tc-tarjetas';

export default function App() {
  const [tarjetas, setTarjetas] = useState([]);
  const [tarjetaSel, setTarjetaSel] = useState(null);
  const [categoriaSel, setCategoriaSel] = useState(CATEGORIAS[0]);
  const [ofertas, setOfertas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      setTarjetas(parsed);
      if (parsed.length > 0) setTarjetaSel(parsed[0]);
    } else {
      setTarjetas(TARJETAS_PRECARGADAS);
      setTarjetaSel(TARJETAS_PRECARGADAS[0]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tarjetas));
  }, [tarjetas]);

  const handleAddCard = (nueva) => {
    setTarjetas((prev) => [...prev, nueva]);
    setTarjetaSel(nueva);
  };

  const handleDeleteCard = (id) => {
    setTarjetas((prev) => prev.filter((t) => t.id !== id));
    if (tarjetaSel?.id === id) setTarjetaSel(null);
  };

  const buscarOfertas = async () => {
    if (!tarjetaSel) {
      setError('Selecciona una tarjeta primero.');
      return;
    }
    setLoading(true);
    setError(null);
    setMensaje(null);
    setOfertas([]);
    try {
      const fuente = getFuenteOficial(tarjetaSel.banco, tarjetaSel.nombre);
      const resp = await fetch('/api/search-offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          banco: tarjetaSel.banco,
          tarjeta: tarjetaSel.nombre,
          categoria: categoriaSel.id,
          categoriaLabel: categoriaSel.label,
          dominioOficial: fuente?.dominio || null,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Error buscando ofertas');
      setOfertas(data.ofertas || []);
      if ((data.ofertas || []).length === 0) {
        setMensaje(data.mensaje || 'No se encontraron promociones vigentes para esta combinación. Prueba otra categoría.');
      }
    } catch (err) {
      setError(err.message || 'No se pudo conectar con el buscador. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Ticker />
      <div className="layout-shell">
        <aside className="side-panel side-panel-stack">
          <DateFXPanel />
          <MarketPanel />
        </aside>
        <div style={styles.page}>
          <header style={styles.header}>
            <p style={styles.eyebrow}>Utilidades y Servicios</p>
            <h1 style={styles.h1}>Beneficios TC</h1>
            <p style={styles.sub}>Descuentos vigentes en restaurantes y comercios, por banco y tarjeta.</p>
          </header>

          <main style={styles.main}>
            <CardManager
              tarjetas={tarjetas}
              onAdd={handleAddCard}
              onDelete={handleDeleteCard}
              seleccionada={tarjetaSel}
              onSelect={setTarjetaSel}
            />

            <h2 style={styles.h2}>Categoría</h2>
            <CategoryFilter seleccionada={categoriaSel} onSelect={setCategoriaSel} />

            <button
              style={styles.searchBtn}
              onClick={buscarOfertas}
              disabled={loading || !tarjetaSel}
            >
              {loading ? 'Buscando…' : `Buscar Oferta ${categoriaSel.emoji}`}
            </button>

            <div style={styles.resultsHeader}>
              {tarjetaSel && (
                <p style={styles.resultsContext}>
                  {tarjetaSel.banco} — {tarjetaSel.nombre}
                </p>
              )}
              {tarjetaSel && (() => {
                const fuente = getFuenteOficial(tarjetaSel.banco, tarjetaSel.nombre);
                const enlaces = getEnlacesPortal(fuente, categoriaSel.id);
                if (enlaces.length === 0) return null;
                return (
                  <div style={styles.portalLinks}>
                    {enlaces.map((e, i) => (
                      <a key={i} href={e.url} target="_blank" rel="noreferrer" style={styles.portalLink}>
                        {e.nombre} ↗
                      </a>
                    ))}
                  </div>
                );
              })()}
            </div>

            <OffersList ofertas={ofertas} loading={loading} error={error} mensaje={mensaje} />

            <WeeklyOffers tarjetas={tarjetas} />

            <Calculator />

            <BankLinks />

            <WebLinks />

            <Calendar />

            <EmailPanel />
          </main>

          <footer style={styles.footer}>
            <p>Los resultados provienen de búsqueda web en tiempo real y pueden variar. Verifica siempre en la app o sitio oficial de tu banco antes de usar el beneficio.</p>
          </footer>
        </div>
        <aside className="side-panel side-panel-stack">
          <WeatherPanel />
          <WorldClockPanel />
        </aside>
      </div>
    </>
  );
}

const styles = {
  page: {
    minHeight: '100vh', maxWidth: '480px', width: '100%', margin: '0 auto',
    padding: '24px 18px 40px', overflowX: 'hidden', boxSizing: 'border-box',
  },
  header: { marginBottom: '26px' },
  eyebrow: {
    fontSize: '1.5rem', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.06em',
    color: 'var(--gold-300)', margin: '0 0 10px', fontWeight: 700, fontFamily: 'var(--font-display)',
  },
  h1: { fontFamily: 'var(--font-display)', fontSize: '2rem', margin: '0 0 8px', color: 'var(--paper-050)' },
  sub: { fontSize: '0.92rem', opacity: 0.7, margin: 0, lineHeight: 1.5 },
  main: {},
  h2: { fontFamily: 'var(--font-display)', fontSize: '1.15rem', margin: '0 0 12px' },
  searchBtn: {
    width: '100%', background: 'var(--gold-500)', color: 'var(--navy-950)', border: 'none',
    borderRadius: '12px', padding: '15px', fontSize: '1rem', fontWeight: 700, marginBottom: '22px',
  },
  resultsHeader: { marginBottom: '10px' },
  resultsContext: { fontSize: '0.8rem', opacity: 0.6, margin: '0 0 6px' },
  portalLinks: { display: 'flex', flexDirection: 'column', gap: '4px' },
  portalLink: { fontSize: '0.8rem', color: 'var(--mint-300)', textDecoration: 'none' },
  footer: {
    marginTop: '36px', borderTop: '1px solid var(--navy-800)', paddingTop: '16px',
    fontSize: '0.72rem', opacity: 0.5, lineHeight: 1.5,
  },
};
