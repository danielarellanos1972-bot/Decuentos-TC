import { useEffect, useState } from 'react';
import { getUbicaciones, saveUbicaciones } from '../utils/weatherLocations.js';
import { getRelojes, saveRelojes, resolverZonaHoraria } from '../utils/worldClock.js';

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

let marketDataPromise = null;
let marketDataCache = null;
let marketDataCacheTime = 0;
const CACHE_MS = 20000; // evita pedir 2 veces lo mismo si Hoy y Mercado cargan casi juntos

function fetchMarketDataShared() {
  const ahora = Date.now();
  if (marketDataCache && ahora - marketDataCacheTime < CACHE_MS) {
    return Promise.resolve(marketDataCache);
  }
  if (!marketDataPromise) {
    marketDataPromise = fetch('/api/market-data')
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) {
          marketDataCache = d;
          marketDataCacheTime = Date.now();
        }
        marketDataPromise = null;
        return d;
      })
      .catch((err) => {
        marketDataPromise = null;
        throw err;
      });
  }
  return marketDataPromise;
}

function useMarketData() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let activo = true;
    fetchMarketDataShared()
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

export function MarketPanel() {
  const { data, error, loading } = useMarketData();

  return (
    <PanelShell title="Mercado">
      {loading && <p style={styles.loadingText}>Cargando indicadores…</p>}
      {error && <p style={styles.errorText}>{error}</p>}
      {data && (
        <>
          {(data.indices || []).map((idx, i) => (
            <Row
              key={i}
              label={idx.label}
              value={idx.valor != null ? fmtCLP(idx.valor) : 'No disponible'}
              sub={idx.variacion != null ? fmtPct(idx.variacion) : null}
            />
          ))}
          <Row label="IPC mensual" value={data.ipcMensual?.valor != null ? fmtPct(data.ipcMensual.valor) : '—'} />
          <Row label="IPC 12 meses" value={data.ipcAnual?.valor != null ? fmtPct(data.ipcAnual.valor) : '—'} />
          <Row label="🟠 Cobre (lb)" value={data.cobre?.valor != null ? `$${fmtCLP(data.cobre.valor)}` : '—'} />
          <Row label="TPM" value={data.tpm?.valor != null ? `${fmtCLP(data.tpm.valor)}%` : '—'} />
          <Row label="Desempleo" value={data.desempleo?.valor != null ? `${fmtCLP(data.desempleo.valor)}%` : '—'} />
        </>
      )}
      <p style={styles.fuente}>Índices: Bolsa de Santiago / mercados internacionales · IPC, cobre, TPM y desempleo: INE / Banco Central de Chile</p>
    </PanelShell>
  );
}

function useWeatherData(ubicaciones) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let activo = true;
    setLoading(true);
    fetch('/api/weather', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ubicaciones }),
    })
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
  }, [ubicaciones]);

  return { data, error, loading };
}

export function WeatherPanel() {
  const [ubicaciones, setUbicaciones] = useState(getUbicaciones());
  const [inputValor, setInputValor] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [errorAgregar, setErrorAgregar] = useState(null);
  const { data, error, loading } = useWeatherData(ubicaciones);

  const agregarUbicacion = async () => {
    const nombre = inputValor.trim();
    if (!nombre) return;
    setBuscando(true);
    setErrorAgregar(null);
    try {
      const resp = await fetch(`/api/geocode?nombre=${encodeURIComponent(nombre)}`);
      const d = await resp.json();
      if (!resp.ok) throw new Error(d.error || 'No se pudo encontrar ese lugar');
      const nueva = { nombre: d.pais ? `${d.nombre}, ${d.pais}` : d.nombre, lat: d.lat, lon: d.lon };
      const actualizado = [...ubicaciones, nueva];
      setUbicaciones(actualizado);
      saveUbicaciones(actualizado);
      setInputValor('');
    } catch (err) {
      setErrorAgregar(err.message || 'Error al buscar el lugar');
    } finally {
      setBuscando(false);
    }
  };

  const quitarUbicacion = (nombre) => {
    const actualizado = ubicaciones.filter((u) => u.nombre !== nombre);
    setUbicaciones(actualizado);
    saveUbicaciones(actualizado);
  };

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
              <button style={styles.removeBtn} onClick={() => quitarUbicacion(u.nombre)} title="Quitar">✕</button>
            </div>
          ))}
        </div>
      )}
      <div style={styles.addRow}>
        <input
          style={styles.addInput}
          placeholder="Agregar ciudad (ej: Temuco)"
          value={inputValor}
          onChange={(e) => setInputValor(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && agregarUbicacion()}
        />
        <button style={styles.addBtn} onClick={agregarUbicacion} disabled={buscando}>
          {buscando ? '…' : '+'}
        </button>
      </div>
      {errorAgregar && <p style={styles.errorText}>{errorAgregar}</p>}
      <p style={styles.fuente}>Fuente: Open-Meteo. Puedes agregar cualquier ciudad de Chile o del mundo.</p>
    </PanelShell>
  );
}

export function GmailPlaceholder() {
  return (
    <PanelShell title="Correos">
      <p style={styles.loadingText}>Conexión con Gmail pendiente de configurar (requiere autorización de Google).</p>
    </PanelShell>
  );
}

function formatearHora(tz) {
  try {
    return new Intl.DateTimeFormat('es-CL', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());
  } catch {
    return '—';
  }
}

function formatearFecha(tz) {
  try {
    return new Intl.DateTimeFormat('es-CL', {
      timeZone: tz,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(new Date());
  } catch {
    return '';
  }
}

export function WorldClockPanel() {
  const [relojes, setRelojes] = useState(getRelojes());
  const [ahora, setAhora] = useState(Date.now());
  const [inputValor, setInputValor] = useState('');
  const [errorAgregar, setErrorAgregar] = useState(null);

  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const agregarReloj = () => {
    const nombre = inputValor.trim();
    if (!nombre) return;
    const tz = resolverZonaHoraria(nombre);
    if (!tz) {
      setErrorAgregar(`No se reconoce "${nombre}". Prueba con el nombre de la ciudad principal, o escribe directamente la zona horaria (ej: America/Bogota).`);
      return;
    }
    setErrorAgregar(null);
    const actualizado = [...relojes, { nombre, tz }];
    setRelojes(actualizado);
    saveRelojes(actualizado);
    setInputValor('');
  };

  const quitarReloj = (nombre) => {
    const actualizado = relojes.filter((r) => r.nombre !== nombre);
    setRelojes(actualizado);
    saveRelojes(actualizado);
  };

  return (
    <PanelShell title="Hora Mundial">
      <div style={styles.weatherList}>
        {relojes.map((r, i) => (
          <div key={i} style={styles.weatherRow}>
            <div style={styles.weatherInfo}>
              <p style={styles.weatherPlace}>{r.nombre}</p>
              <p style={styles.weatherDesc}>{formatearFecha(r.tz)}</p>
            </div>
            <span style={styles.clockTemp}>{formatearHora(r.tz)}</span>
            <button style={styles.removeBtn} onClick={() => quitarReloj(r.nombre)} title="Quitar">✕</button>
          </div>
        ))}
      </div>
      <div style={styles.addRow}>
        <input
          style={styles.addInput}
          placeholder="Agregar ciudad (ej: Bogotá)"
          value={inputValor}
          onChange={(e) => setInputValor(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && agregarReloj()}
        />
        <button style={styles.addBtn} onClick={agregarReloj}>+</button>
      </div>
      {errorAgregar && <p style={styles.errorText}>{errorAgregar}</p>}
      <p style={styles.fuente}>Aysén y Magallanes usan la misma hora que Chile continental (no tienen huso propio). Se actualiza sola cada 30 segundos.</p>
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
    gap: '8px',
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
  clockTemp: {
    fontFamily: 'var(--font-mono)',
    fontSize: '1.05rem',
    fontWeight: 700,
    color: 'var(--mint-300)',
    flexShrink: 0,
  },
  removeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--paper-100)',
    opacity: 0.4,
    fontSize: '0.75rem',
    cursor: 'pointer',
    flexShrink: 0,
    padding: '2px 4px',
  },
  addRow: {
    display: 'flex',
    gap: '6px',
    marginTop: '12px',
  },
  addInput: {
    flex: 1,
    background: 'var(--navy-800)',
    border: '1px solid var(--navy-700)',
    borderRadius: '8px',
    padding: '7px 10px',
    color: 'var(--paper-050)',
    fontSize: '0.75rem',
    outline: 'none',
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
};
