import { useEffect, useState } from 'react';

const fmtCLP = (n) =>
  n == null ? '—' : n.toLocaleString('es-CL', { maximumFractionDigits: 2 });

const fmtPct = (n) =>
  n == null ? '—' : `${n > 0 ? '+' : ''}${n.toLocaleString('es-CL', { maximumFractionDigits: 2 })}%`;

const hoyFormateado = () =>
  new Date().toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

function useMarketData() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let activo = true;
    fetch('/api/market-data')
      .then((r) => r.json())
      .then((d) => {
        if (!activo) return;
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => activo && setError('No se pudo conectar.'))
      .finally(() => activo && setLoading(false));
    return () => {
      activo = false;
    };
  }, []);

  return { data, error, loading };
}

function PanelShell({ title, children }) {
  return (
    <div style={styles.panel}>
      <p style={styles.panelTitle}>{title}</p>
      {children}
    </div>
  );
}

function Row({ label, value, sub }) {
  return (
    <div style={styles.row}>
      <span style={styles.rowLabel}>{label}</span>
      <div style={styles.rowValueWrap}>
        <span style={styles.rowValue}>{value}</span>
        {sub && <span style={styles.rowSub}>{sub}</span>}
      </div>
    </div>
  );
}

export function DateFXPanel() {
  const { data, error, loading } = useMarketData();

  return (
    <PanelShell title="Hoy">
      <p style={styles.dateText}>{hoyFormateado()}</p>
      <div style={styles.divider} />
      {loading && <p style={styles.loadingText}>Cargando indicadores…</p>}
      {error && <p style={styles.errorText}>{error}</p>}
      {data && (
        <>
          <Row label="🇨🇱 UF" value={`$${fmtCLP(data.uf?.valor)}`} />
          <Row label="🇨🇱 UTM" value={`$${fmtCLP(data.utm?.valor)}`} />
          <Row label="🇺🇸 Dólar (USD)" value={`$${fmtCLP(data.usd?.valor)}`} />
          <Row label="🇨🇦 Dólar Can. (CAD)" value={data.cad?.valor ? `$${fmtCLP(data.cad.valor)}` : 'No disponible'} />
        </>
      )}
      <p style={styles.fuente}>UF/UTM/USD: Banco Central de Chile (vía mindicador.cl) · CAD: cotización de mercado cruzada (referencia comparable a wise.com)</p>
    </PanelShell>
  );
}

function useWeatherData() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let activo = true;
    fetch('/api/weather')
      .then((r) => r.json())
      .then((d) => {
        if (!activo) return;
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => activo && setError('No se pudo conectar.'))
      .finally(() => activo && setLoading(false));
    return () => {
      activo = false;
    };
  }, []);

  return { data, error, loading };
}

export function WeatherPanel() {
  const { data, error, loading } = useWeatherData();

  return (
    <PanelShell title="Clima">
      {loading && <p style={styles.loadingText}>Cargando clima…</p>}
      {error && <p style={styles.errorText}>{error}</p>}
      {data?.ubicaciones && (
        <div style={styles.weatherList}>
          {data.ubicaciones.map((u, i) => (
            <div key={i} style={styles.weatherRow}>
              <span style={styles.weatherIcon}>{u.error ? '—' : u.icono}</span>
              <div style={styles.weatherInfo}>
                <p style={styles.weatherPlace}>{u.nombre}</p>
                {u.error ? (
                  <p style={styles.weatherDesc}>No disponible</p>
                ) : (
                  <>
                    <p style={styles.weatherDesc}>{u.texto}</p>
                    <p style={styles.weatherMinMax}>Mín. {u.min}° · Máx. {u.max}°</p>
                  </>
                )}
              </div>
              {!u.error && <span style={styles.weatherTemp}>{u.temp}°</span>}
            </div>
          ))}
        </div>
      )}
      <p style={styles.fuente}>Fuente: Open-Meteo</p>
    </PanelShell>
  );
}

export function MarketPanel() {
  const { data, error, loading } = useMarketData();

  return (
    <PanelShell title="Mercado">
      {loading && <p style={styles.loadingText}>Cargando indicadores…</p>}
      {error && <p style={styles.errorText}>{error}</p>}
      {data && (
        <>
          <Row
            label="IPSA"
            value={data.ipsa?.valor ? fmtCLP(data.ipsa.valor) : 'No disponible'}
            sub={data.ipsa?.variacion != null ? fmtPct(data.ipsa.variacion) : null}
          />
          <Row label="IPC mensual" value={data.ipcMensual?.valor != null ? fmtPct(data.ipcMensual.valor) : '—'} />
          <Row label="IPC 12 meses" value={data.ipcAnual?.valor != null ? fmtPct(data.ipcAnual.valor) : '—'} />
        </>
      )}
      <p style={styles.fuente}>IPSA: Bolsa de Santiago · IPC: INE / Banco Central de Chile</p>
    </PanelShell>
  );
}

const styles = {
  panel: {
    background: 'var(--navy-900)',
    border: '1px solid var(--navy-700)',
    borderRadius: '14px',
    padding: '18px 16px',
  },
  panelTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: '1rem',
    color: 'var(--gold-300)',
    margin: '0 0 10px',
    textTransform: 'capitalize',
  },
  dateText: {
    fontSize: '0.85rem',
    color: 'var(--paper-050)',
    margin: '0 0 12px',
    textTransform: 'capitalize',
    lineHeight: 1.4,
  },
  divider: {
    height: '1px',
    background: 'var(--navy-700)',
    margin: '0 0 12px',
  },
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: '4px',
    padding: '7px 0',
    borderBottom: '1px solid var(--navy-800)',
  },
  rowLabel: {
    fontSize: '0.78rem',
    opacity: 0.7,
    whiteSpace: 'nowrap',
  },
  rowValueWrap: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '6px',
  },
  rowValue: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.85rem',
    color: 'var(--paper-050)',
    fontWeight: 600,
  },
  rowSub: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.7rem',
    color: 'var(--mint-300)',
  },
  loadingText: {
    fontSize: '0.78rem',
    opacity: 0.6,
    margin: 0,
  },
  errorText: {
    fontSize: '0.78rem',
    color: 'var(--coral-500)',
    margin: 0,
  },
  fuente: {
    fontSize: '0.65rem',
    opacity: 0.45,
    margin: '12px 0 0',
    lineHeight: 1.4,
  },
  weatherList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  weatherRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 0',
    borderBottom: '1px solid var(--navy-800)',
  },
  weatherIcon: {
    fontSize: '1.8rem',
    lineHeight: 1,
    flexShrink: 0,
  },
  weatherInfo: {
    flex: 1,
    minWidth: 0,
  },
  weatherPlace: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--paper-050)',
    margin: '0 0 2px',
  },
  weatherDesc: {
    fontSize: '0.72rem',
    opacity: 0.7,
    margin: '0 0 2px',
  },
  weatherMinMax: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.68rem',
    opacity: 0.55,
    margin: 0,
  },
  weatherTemp: {
    fontFamily: 'var(--font-mono)',
    fontSize: '1.15rem',
    fontWeight: 700,
    color: 'var(--gold-300)',
    flexShrink: 0,
  },
};
