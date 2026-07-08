import { useEffect, useState } from 'react';
import { getUbicaciones } from '../utils/weatherLocations.js';

function useTickerData() {
  const [market, setMarket] = useState(null);
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    let activo = true;
    fetch('/api/market-data').then((r) => r.json()).then((d) => activo && !d.error && setMarket(d)).catch(() => {});
    fetch('/api/weather', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ubicaciones: getUbicaciones() }),
    })
      .then((r) => r.json())
      .then((d) => activo && !d.error && setWeather(d))
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, []);

  return { market, weather };
}

const fmt = (n) => (n == null ? '—' : n.toLocaleString('es-CL', { maximumFractionDigits: 2 }));
const fmtPct = (n) => (n == null ? '—' : `${n > 0 ? '+' : ''}${n.toLocaleString('es-CL', { maximumFractionDigits: 2 })}%`);

export default function Ticker() {
  const { market, weather } = useTickerData();

  const items = [];

  if (market) {
    items.push(`🇨🇱 UF $${fmt(market.uf?.valor)}`);
    items.push(`🇨🇱 UTM $${fmt(market.utm?.valor)}`);
    items.push(`🇺🇸 USD $${fmt(market.usd?.valor)}`);
    if (market.cad?.valor) items.push(`🇨🇦 CAD $${fmt(market.cad.valor)}`);
    (market.indices || []).forEach((idx) => {
      if (idx.valor != null) items.push(`📈 ${idx.label} ${fmt(idx.valor)} (${fmtPct(idx.variacion)})`);
    });
    if (market.ipcAnual?.valor != null) items.push(`📊 IPC 12m ${fmtPct(market.ipcAnual.valor)}`);
  }

  if (weather?.ubicaciones) {
    weather.ubicaciones.forEach((u) => {
      if (!u.error && u.temp != null) {
        items.push(`${u.icono} ${u.nombre} ${u.temp}°`);
      }
    });
  }

  if (items.length === 0) return null;

  const contenido = [...items, ...items].map((t, i) => (
    <span key={i} style={styles.item}>
      {t}
    </span>
  ));

  return (
    <div className="ticker-wrap">
      <div className="ticker-track">{contenido}</div>
    </div>
  );
}

const styles = {
  item: {
    display: 'inline-block',
    padding: '0 22px',
    fontSize: '0.78rem',
    fontFamily: 'var(--font-mono)',
    color: 'var(--paper-050)',
    whiteSpace: 'nowrap',
  },
};
