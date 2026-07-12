import { useEffect, useState } from 'react';
import { getUbicaciones, saveUbicaciones } from '../utils/weatherLocations.js';
import { getRelojes, saveRelojes, resolverZonaHoraria } from '../utils/worldClock.js';

const fmtCLP = (n) =>
  n == null ? '—' : n.toLocaleString('es-CL', { maximumFractionDigits: 2 });

const fmtPct = (n) =>
  n == null ? '—' : `${n > 0 ? '+' : ''}${n.toLocaleString('es-CL', { maximumFractionDigits: 2 })}%`;

const fmtPeriodo = (fechaISO) => {
  if (!fechaISO) return null;
  const d = new Date(fechaISO);
  if (Number.isNaN(d.getTime())) return null;
  const texto = d.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

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
      {data?.avisoBase && <p style={styles.errorText}>{data.avisoBase}</p>}
      {data && (
        <>
          <Row label="🇨🇱 UF" value={`$${fmtCLP(data.uf?.valor)}`} />
          <Row label="🇨🇱 UTM" value={`$${fmtCLP(data.utm?.valor)}`} />
          <Row label="🇺🇸 Dólar (USD)" value={`$${fmtCLP(data.usd?.valor)}`} />
          <Row label="🇪🇺 Euro" value={data.eur?.valor ? `$${fmtCLP(data.eur.valor)}` : 'No disponible'} />
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
      {data?.avisoBase && <p style={styles.errorText}>Cobre/TPM/desempleo no disponibles (mindicador.cl no respondió).</p>}
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
          <Row
               label="IPC mensual"
               value={data.ipcMensual?.valor != null ? fmtPct(data.ipcMensual.valor) : '—'}
               sub={[fmtPeriodo(data.ipcMensual?.fecha), data.ipcMensual?.respaldo ? '(manual)' : null].filter(Boolean).join(' ')}
             />
             <Row
               label="IPC 12 meses"
               value={data.ipcAnual?.valor != null ? fmtPct(data.ipcAnual.valor) : '—'}
               sub={[fmtPeriodo(data.ipcAnual?.fecha), data.ipcAnual?.respaldo ? '(manual)' : null].filter(Boolean).join(' ')}
             />
          <Row
            label="🟠 Cobre (lb)"
            value={data.cobre?.valor != null ? `$${fmtCLP(data.cobre.valor)}` : '—'}
            sub={fmtPeriodo(data.cobre?.fecha)}
          />
          <Row
            label="TPM"
            value={data.tpm?.valor != null ? `${fmtCLP(data.tpm.valor)}%` : '—'}
            sub={fmtPeriodo(data.tpm?.fecha)}
          />
          <Row
            label="Desempleo"
            value={data.desempleo?.valor != null ? `${fmtCLP(data.desempleo.valor)}%` : '—'}
            sub={fmtPeriodo(data.desempleo?.fecha)}
          />
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

function formatearHoraCorta(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '';
  }
}

function WeatherDetailModal({ ubicacion, onClose }) {
  const [detalle, setDetalle] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorDetalle, setErrorDetalle] = useState(null);

  useEffect(() => {
    if (!ubicacion) return;
    let activo = true;
    setCargando(true);
    setErrorDetalle(null);
    setDetalle(null);
    fetch(`/api/weather-detail?lat=${ubicacion.lat}&lon=${ubicacion.lon}&nombre=${encodeURIComponent(ubicacion.nombre)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!activo) return;
        if (d.error) setErrorDetalle(d.error);
        else setDetalle(d);
      })
      .catch(() => activo && setErrorDetalle('No se pudo cargar el detalle.'))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [ubicacion?.nombre, ubicacion?.lat, ubicacion?.lon]);

  if (!ubicacion) return null;

  return (
    <div style={styles.modalFondo} onClick={onClose}>
      <div style={styles.modalCaja} onClick={(e) => e.stopPropagation()}>
        <button style={styles.modalCerrar} onClick={onClose} aria-label="Cerrar">✕</button>

        {cargando && <p style={styles.loadingText}>Cargando detalle de {ubicacion.nombre}…</p>}
        {errorDetalle && <p style={styles.errorText}>{errorDetalle}</p>}

        {detalle && (
          <>
            <p style={styles.modalLugar}>{detalle.nombre}</p>
            <div style={styles.modalTopRow}>
              <span style={styles.modalIcono}>{detalle.icono}</span>
              <span style={styles.modalTemp}>{detalle.temp}°</span>
              <div>
                <p style={styles.modalDesc}>{detalle.texto}</p>
                <p style={styles.modalSub}>Sensación térmica {detalle.sensacion}°</p>
              </div>
            </div>

            <div style={styles.modalStatsGrid}>
              <div style={styles.modalStat}>
                <p style={styles.modalStatLabel}>Mín / Máx</p>
                <p style={styles.modalStatValor}>{detalle.min}° / {detalle.max}°</p>
              </div>
              <div style={styles.modalStat}>
                <p style={styles.modalStatLabel}>Humedad</p>
                <p style={styles.modalStatValor}>{detalle.humedad}%</p>
              </div>
              <div style={styles.modalStat}>
                <p style={styles.modalStatLabel}>Viento</p>
                <p style={styles.modalStatValor}>{detalle.viento} km/h {detalle.vientoDireccion}</p>
              </div>
              <div style={styles.modalStat}>
                <p style={styles.modalStatLabel}>Prob. de lluvia</p>
                <p style={styles.modalStatValor}>{detalle.probLluviaMax}%</p>
              </div>
              <div style={styles.modalStat}>
                <p style={styles.modalStatLabel}>Índice UV máx.</p>
                <p style={styles.modalStatValor}>{detalle.uvMax}</p>
              </div>
              <div style={styles.modalStat}>
                <p style={styles.modalStatLabel}>Presión</p>
                <p style={styles.modalStatValor}>{detalle.presion} hPa</p>
              </div>
              <div style={styles.modalStat}>
                <p style={styles.modalStatLabel}>Amanecer</p>
                <p style={styles.modalStatValor}>{formatearHoraCorta(detalle.amanecer)}</p>
              </div>
              <div style={styles.modalStat}>
                <p style={styles.modalStatLabel}>Atardecer</p>
                <p style={styles.modalStatValor}>{formatearHoraCorta(detalle.atardecer)}</p>
              </div>
            </div>

            {detalle.proximasHoras?.length > 0 && (
              <>
                <p style={styles.modalHorasTitulo}>Próximas horas</p>
                <div style={styles.modalHorasFila}>
                  {detalle.proximasHoras.map((h, i) => (
                    <div key={i} style={styles.modalHoraItem}>
                      <p style={styles.modalHoraTexto}>{formatearHoraCorta(h.hora)}</p>
                      <p style={styles.modalHoraIcono}>{h.icono}</p>
                      <p style={styles.modalHoraTemp}>{h.temp}°</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            <p style={styles.fuente}>Fuente: Open-Meteo.</p>
          </>
        )}
      </div>
    </div>
  );
}

export function WeatherPanel() {
  const [ubicaciones, setUbicaciones] = useState(getUbicaciones());
  const [inputValor, setInputValor] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [errorAgregar, setErrorAgregar] = useState(null);
  const [detalleAbierto, setDetalleAbierto] = useState(null);
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
            <div
              key={i}
              style={{ ...styles.weatherRow, cursor: u.error ? 'default' : 'pointer' }}
              onClick={() => !u.error && ubicaciones[i] && setDetalleAbierto(ubicaciones[i])}
            >
              <button
                style={styles.removeBtnCorner}
                onClick={(e) => { e.stopPropagation(); quitarUbicacion(u.nombre); }}
                title="Quitar"
              >
                ✕
              </button>
              {u.error ? (
                <>
                  <span style={styles.weatherIcon}>—</span>
                  <p style={styles.weatherPlace}>{u.nombre}</p>
                  <p style={styles.weatherDesc}>No disponible</p>
                </>
              ) : (
                <>
                  <div style={styles.weatherTopLine}>
                    <span style={styles.weatherIcon}>{u.icono}</span>
                    <span style={styles.weatherTemp}>{u.temp}°</span>
                  </div>
                  <p style={styles.weatherPlace}>{u.nombre}</p>
                  <p style={styles.weatherDesc}>{u.texto}</p>
                  <p style={styles.weatherMinMax}>Mín {u.min}° · Máx {u.max}°</p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      {detalleAbierto && (
        <WeatherDetailModal ubicacion={detalleAbierto} onClose={() => setDetalleAbierto(null)} />
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
            <button style={styles.removeBtnCorner} onClick={() => quitarReloj(r.nombre)} title="Quitar">✕</button>
            <span style={styles.clockTemp}>{formatearHora(r.tz)}</span>
            <p style={styles.weatherPlace}>{r.nombre}</p>
            <p style={styles.weatherDesc}>{formatearFecha(r.tz)}</p>
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
      <p style={styles.fuente}>Aysén-Magallanes usa la misma hora que Chile continental (no tiene huso propio). Se actualiza sola cada 30 segundos.</p>
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
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '6px',
  },
  weatherRow: {
    position: 'relative',
    background: 'var(--navy-800)',
    borderRadius: '9px',
    padding: '8px 6px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
  },
  weatherTopLine: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '2px',
  },
  weatherIcon: {
    fontSize: '1.05rem',
    lineHeight: 1,
  },
  weatherPlace: {
    fontSize: '0.62rem',
    fontWeight: 600,
    color: 'var(--paper-050)',
    margin: '2px 0 1px',
    lineHeight: 1.2,
  },
  weatherDesc: {
    fontSize: '0.56rem',
    opacity: 0.7,
    margin: '0 0 1px',
    lineHeight: 1.2,
  },
  weatherMinMax: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.52rem',
    opacity: 0.55,
    margin: 0,
  },
  weatherTemp: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.8rem',
    fontWeight: 700,
    color: 'var(--gold-300)',
  },
  clockTemp: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.85rem',
    fontWeight: 700,
    color: 'var(--mint-300)',
    margin: '2px 0 1px',
  },
  removeBtnCorner: {
    position: 'absolute',
    top: '3px',
    right: '3px',
    background: 'transparent',
    border: 'none',
    color: 'var(--paper-100)',
    opacity: 0.35,
    fontSize: '0.6rem',
    cursor: 'pointer',
    padding: '2px',
    lineHeight: 1,
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
  modalFondo: {
    position: 'fixed', inset: 0, background: 'rgba(5,10,15,0.72)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: '20px',
  },
  modalCaja: {
    position: 'relative', background: 'var(--navy-900)', border: '1px solid var(--navy-700)',
    borderRadius: '18px', padding: '26px', width: '100%', maxWidth: '440px',
    maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  modalCerrar: {
    position: 'absolute', top: '14px', right: '14px', background: 'var(--navy-800)',
    border: '1px solid var(--navy-700)', color: 'var(--paper-100)', borderRadius: '50%',
    width: '28px', height: '28px', fontSize: '0.85rem', cursor: 'pointer',
  },
  modalLugar: {
    fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: 'var(--paper-050)',
    margin: '0 0 12px', paddingRight: '30px',
  },
  modalTopRow: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' },
  modalIcono: { fontSize: '3rem', lineHeight: 1 },
  modalTemp: { fontFamily: 'var(--font-mono)', fontSize: '2.6rem', fontWeight: 700, color: 'var(--gold-300)' },
  modalDesc: { fontSize: '0.95rem', color: 'var(--paper-050)', margin: '0 0 2px', fontWeight: 600 },
  modalSub: { fontSize: '0.78rem', opacity: 0.65, margin: 0 },
  modalStatsGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px',
  },
  modalStat: {
    background: 'var(--navy-800)', borderRadius: '10px', padding: '10px 12px',
  },
  modalStatLabel: { fontSize: '0.66rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 2px' },
  modalStatValor: { fontSize: '0.92rem', fontWeight: 700, color: 'var(--paper-050)', margin: 0 },
  modalHorasTitulo: { fontSize: '0.8rem', fontWeight: 700, color: 'var(--paper-050)', margin: '0 0 10px' },
  modalHorasFila: { display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '6px' },
  modalHoraItem: {
    flexShrink: 0, background: 'var(--navy-800)', borderRadius: '10px',
    padding: '10px 8px', textAlign: 'center', minWidth: '54px',
  },
  modalHoraTexto: { fontSize: '0.62rem', opacity: 0.6, margin: '0 0 4px' },
  modalHoraIcono: { fontSize: '1.2rem', margin: '0 0 4px' },
  modalHoraTemp: { fontSize: '0.8rem', fontWeight: 700, color: 'var(--paper-050)', margin: 0 },
};
