import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getUbicaciones, saveUbicaciones } from '../utils/weatherLocations.js';
import { getRelojes, saveRelojes, resolverZonaHoraria, getDatosPais } from '../utils/worldClock.js';

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

function Row({ label, value, sub, onClick }) {
  return (
    <div style={{ ...styles.row, cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <span style={styles.rowLabel}>{label}</span>
      <div style={styles.rowValueWrap}>
        <span style={styles.rowValue}>{value}</span>
        {sub && <span style={styles.rowSub}>{sub}</span>}
      </div>
    </div>
  );
}

const PERIODOS = [
  { dias: 7, etiqueta: '7D' },
  { dias: 30, etiqueta: '30D' },
  { dias: 90, etiqueta: '90D' },
  { dias: 365, etiqueta: '1A' },
  { dias: 1825, etiqueta: '5A' },
];

function LineChart({ puntos }) {
  const ancho = 640;
  const alto = 220;
  const padX = 10;
  const padY = 30;

  if (!puntos || puntos.length < 2) {
    return <p style={styles.loadingText}>No hay suficientes datos para graficar.</p>;
  }

  const valores = puntos.map((p) => p.valor);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const rango = max - min || 1;

  const x = (i) => padX + (i / (puntos.length - 1)) * (ancho - padX * 2);
  const y = (v) => padY + (1 - (v - min) / rango) * (alto - padY * 2);

  const pathD = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.valor).toFixed(1)}`).join(' ');
  const areaD = `${pathD} L ${x(puntos.length - 1).toFixed(1)} ${alto - padY} L ${x(0).toFixed(1)} ${alto - padY} Z`;

  const subio = puntos[puntos.length - 1].valor >= puntos[0].valor;
  const color = subio ? 'var(--mint-300)' : 'var(--coral-500)';

  const idxMax = valores.indexOf(max);
  const idxMin = valores.indexOf(min);
  const anclaje = (idx) => (x(idx) < ancho * 0.18 ? 'start' : x(idx) > ancho * 0.82 ? 'end' : 'middle');
  const fechaCorta = (f) => {
    try {
      return new Date(f).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
    } catch {
      return '';
    }
  };

  return (
    <svg viewBox={`0 0 ${ancho} ${alto}`} style={styles.chartSvg} preserveAspectRatio="none">
      <path d={areaD} fill={color} opacity="0.12" stroke="none" />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {/* Pico (valor más alto del período) */}
      <circle cx={x(idxMax)} cy={y(max)} r="3.5" fill={color} stroke="var(--navy-900)" strokeWidth="1.5" />
      <text x={x(idxMax)} y={Math.max(y(max) - 9, 10)} textAnchor={anclaje(idxMax)} style={styles.chartLabel}>
        {fmtCLP(max)} · {fechaCorta(puntos[idxMax].fecha)}
      </text>

      {/* Valle (valor más bajo del período), si es distinto del pico */}
      {idxMin !== idxMax && (
        <>
          <circle cx={x(idxMin)} cy={y(min)} r="3.5" fill={color} stroke="var(--navy-900)" strokeWidth="1.5" />
          <text x={x(idxMin)} y={Math.min(y(min) + 17, alto - 4)} textAnchor={anclaje(idxMin)} style={styles.chartLabel}>
            {fmtCLP(min)} · {fechaCorta(puntos[idxMin].fecha)}
          </text>
        </>
      )}
    </svg>
  );
}

function IndicatorHistoryModal({ indicador, onClose }) {
  const [periodo, setPeriodo] = useState(365);
  const [puntos, setPuntos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorHist, setErrorHist] = useState(null);

  useEffect(() => {
    if (!indicador) return;
    let activo = true;
    setCargando(true);
    setErrorHist(null);
    const params = new URLSearchParams({ fuente: indicador.fuente, dias: String(periodo) });
    if (indicador.fuente === 'mindicador') params.set('codigo', indicador.codigo);
    if (indicador.fuente === 'yahoo') params.set('ticker', indicador.ticker);

    fetch(`/api/market-history?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (!activo) return;
        if (d.error) setErrorHist(d.error);
        else if ((!d.puntos || d.puntos.length === 0) && d.aviso) setErrorHist(d.aviso);
        else setPuntos(d.puntos || []);
      })
      .catch(() => activo && setErrorHist('No se pudo cargar el histórico.'))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [indicador?.fuente, indicador?.codigo, indicador?.ticker, periodo]);

  if (!indicador) return null;

  const primero = puntos?.[0];
  const ultimo = puntos?.[puntos.length - 1];
  const variacionPeriodo =
    primero && ultimo && primero.valor ? ((ultimo.valor - primero.valor) / primero.valor) * 100 : null;

  return createPortal(
    <div style={styles.modalFondo} onClick={onClose}>
      <div style={{ ...styles.modalCaja, maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
        <button style={styles.modalCerrar} onClick={onClose} aria-label="Cerrar">✕</button>
        <p style={styles.modalLugar}>{indicador.label}</p>

        <div style={styles.periodosFila}>
          {PERIODOS.map((p) => (
            <button
              key={p.dias}
              style={{ ...styles.periodoBtn, ...(periodo === p.dias ? styles.periodoBtnActivo : {}) }}
              onClick={() => setPeriodo(p.dias)}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>

        {cargando && <p style={styles.loadingText}>Cargando histórico…</p>}
        {errorHist && <p style={styles.errorText}>{errorHist}</p>}

        {!cargando && !errorHist && puntos && (
          <>
            {ultimo && (
              <div style={styles.modalTopRow}>
                <span style={styles.modalTemp}>{fmtCLP(ultimo.valor)}</span>
                {variacionPeriodo != null && (
                  <span style={{ ...styles.modalSub, color: variacionPeriodo >= 0 ? 'var(--mint-300)' : 'var(--coral-500)' }}>
                    {fmtPct(variacionPeriodo)} en el período
                  </span>
                )}
              </div>
            )}
            <LineChart puntos={puntos} />
            {primero && ultimo && (
              <div style={styles.chartRangoFechas}>
                <span>{fmtPeriodo(primero.fecha) || primero.fecha}</span>
                <span>{fmtPeriodo(ultimo.fecha) || ultimo.fecha}</span>
              </div>
            )}
          </>
        )}

        <p style={styles.fuente}>
          Fuente: {indicador.fuente === 'mindicador' ? 'mindicador.cl (Banco Central de Chile / INE)' : 'Yahoo Finance'}.
        </p>
      </div>
    </div>,
    document.body
  );
}

export function DateFXPanel() {
  const { data, error, loading } = useMarketData();
  const [historialAbierto, setHistorialAbierto] = useState(null);

  return (
    <PanelShell title="Hoy">
      <p style={styles.dateText}>{hoyFormateado()}</p>
      <div style={styles.divider} />
      {loading && <p style={styles.loadingText}>Cargando indicadores…</p>}
      {error && <p style={styles.errorText}>{error}</p>}
      {data?.avisoBase && <p style={styles.errorText}>{data.avisoBase}</p>}
      {data && (
        <>
          <Row
            label="🇨🇱 UF"
            value={`$${fmtCLP(data.uf?.valor)}`}
            onClick={() => setHistorialAbierto({ label: 'UF', fuente: 'mindicador', codigo: 'uf' })}
          />
          <Row
            label="🇨🇱 UTM"
            value={`$${fmtCLP(data.utm?.valor)}`}
            onClick={() => setHistorialAbierto({ label: 'UTM', fuente: 'mindicador', codigo: 'utm' })}
          />
          <Row
            label="🇺🇸 Dólar (USD)"
            value={`$${fmtCLP(data.usd?.valor)}`}
            onClick={() => setHistorialAbierto({ label: 'Dólar (USD)', fuente: 'mindicador', codigo: 'dolar' })}
          />
          <Row
            label="🇪🇺 Euro"
            value={data.eur?.valor ? `$${fmtCLP(data.eur.valor)}` : 'No disponible'}
            onClick={() => setHistorialAbierto({ label: 'Euro', fuente: 'mindicador', codigo: 'euro' })}
          />
          <Row label="🇨🇦 Dólar Can. (CAD)" value={data.cad?.valor ? `$${fmtCLP(data.cad.valor)}` : 'No disponible'} />
        </>
      )}
      {historialAbierto && (
        <IndicatorHistoryModal indicador={historialAbierto} onClose={() => setHistorialAbierto(null)} />
      )}
      <p style={styles.fuente}>UF/UTM/USD: Banco Central de Chile (vía mindicador.cl) · CAD: cotización de mercado cruzada (referencia comparable a wise.com) · Toca un valor para ver su evolución.</p>
    </PanelShell>
  );
}

// Tickers de Yahoo Finance en el mismo orden que "indices" en la respuesta
// de /api/market-data (ipsa, sp500, europa, ibex, asia, petroleo, oro).
const TICKERS_INDICES = ['^IPSA', '^GSPC', '^STOXX50E', '^IBEX', '^N225', 'CL=F', 'GC=F'];

export function MarketPanel() {
  const { data, error, loading } = useMarketData();
  const [historialAbierto, setHistorialAbierto] = useState(null);

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
              onClick={
                idx.valor != null
                  ? () => setHistorialAbierto({ label: idx.label, fuente: 'yahoo', ticker: TICKERS_INDICES[i] })
                  : undefined
              }
            />
          ))}
          <Row
               label="IPC mensual"
               value={data.ipcMensual?.valor != null ? fmtPct(data.ipcMensual.valor) : '—'}
               sub={[fmtPeriodo(data.ipcMensual?.fecha), data.ipcMensual?.respaldo ? '(manual)' : null].filter(Boolean).join(' ')}
               onClick={() => setHistorialAbierto({ label: 'IPC mensual', fuente: 'mindicador', codigo: 'ipc' })}
             />
             <Row
               label="IPC 12 meses"
               value={data.ipcAnual?.valor != null ? fmtPct(data.ipcAnual.valor) : '—'}
               sub={[fmtPeriodo(data.ipcAnual?.fecha), data.ipcAnual?.respaldo ? '(manual)' : null].filter(Boolean).join(' ')}
               onClick={() => setHistorialAbierto({ label: 'IPC acumulado 12 meses', fuente: 'mindicador', codigo: 'ipc_12m' })}
             />
          <Row
            label="🟠 Cobre (lb)"
            value={data.cobre?.valor != null ? `$${fmtCLP(data.cobre.valor)}` : '—'}
            sub={fmtPeriodo(data.cobre?.fecha)}
            onClick={() => setHistorialAbierto({ label: 'Cobre (lb)', fuente: 'mindicador', codigo: 'libra_cobre' })}
          />
          <Row
            label="TPM"
            value={data.tpm?.valor != null ? `${fmtCLP(data.tpm.valor)}%` : '—'}
            sub={fmtPeriodo(data.tpm?.fecha)}
            onClick={() => setHistorialAbierto({ label: 'TPM', fuente: 'mindicador', codigo: 'tpm' })}
          />
          <Row
            label="Desempleo"
            value={data.desempleo?.valor != null ? `${fmtCLP(data.desempleo.valor)}%` : '—'}
            sub={fmtPeriodo(data.desempleo?.fecha)}
            onClick={() => setHistorialAbierto({ label: 'Desempleo', fuente: 'mindicador', codigo: 'tasa_desempleo' })}
          />
        </>
      )}
      {historialAbierto && (
        <IndicatorHistoryModal indicador={historialAbierto} onClose={() => setHistorialAbierto(null)} />
      )}
      <p style={styles.fuente}>Índices: Bolsa de Santiago / mercados internacionales · IPC, cobre, TPM y desempleo: INE / Banco Central de Chile · Toca un valor para ver su evolución.</p>
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

  return createPortal(
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
                <p style={styles.modalStatLabel}>Nubosidad</p>
                <p style={styles.modalStatValor}>{detalle.nubosidad}%</p>
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
    </div>,
    document.body
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
                  <p style={styles.weatherDesc}>{u.texto}{u.nubosidad != null ? ` (${u.nubosidad}% nubes)` : ''}</p>
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

function useHoraPorSegundo(tz) {
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const partes = dtf.formatToParts(new Date(ahora)).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
    return {
      horas: partes.hour === '24' ? 0 : Number(partes.hour),
      minutos: Number(partes.minute),
      segundos: Number(partes.second),
    };
  } catch {
    return { horas: 0, minutos: 0, segundos: 0 };
  }
}

function AnalogClock({ tz }) {
  const { horas, minutos, segundos } = useHoraPorSegundo(tz);
  const anguloSeg = segundos * 6;
  const anguloMin = minutos * 6 + segundos * 0.1;
  const anguloHora = (horas % 12) * 30 + minutos * 0.5;

  const centro = 100;
  const puntoManecilla = (angulo, largo) => {
    const rad = ((angulo - 90) * Math.PI) / 180;
    return { x: centro + largo * Math.cos(rad), y: centro + largo * Math.sin(rad) };
  };
  const pHora = puntoManecilla(anguloHora, 44);
  const pMin = puntoManecilla(anguloMin, 65);
  const pSeg = puntoManecilla(anguloSeg, 72);

  return (
    <svg viewBox="0 0 200 200" style={styles.relojSvg}>
      <circle cx={centro} cy={centro} r="90" fill="var(--navy-800)" stroke="var(--navy-700)" strokeWidth="2" />
      {Array.from({ length: 12 }, (_, i) => {
        const angulo = i * 30;
        const externo = puntoManecilla(angulo, 82);
        const interno = puntoManecilla(angulo, i % 3 === 0 ? 70 : 76);
        return (
          <line
            key={i}
            x1={externo.x} y1={externo.y} x2={interno.x} y2={interno.y}
            stroke="var(--paper-100)" strokeWidth={i % 3 === 0 ? 2.5 : 1.2}
          />
        );
      })}
      {[12, 3, 6, 9].map((num) => {
        const angulo = num === 12 ? 0 : num * 30;
        const p = puntoManecilla(angulo, 58);
        return (
          <text key={num} x={p.x} y={p.y + 5} textAnchor="middle" style={styles.relojNumero}>
            {num}
          </text>
        );
      })}
      <line x1={centro} y1={centro} x2={pHora.x} y2={pHora.y} stroke="var(--paper-050)" strokeWidth="4" strokeLinecap="round" />
      <line x1={centro} y1={centro} x2={pMin.x} y2={pMin.y} stroke="var(--paper-050)" strokeWidth="2.8" strokeLinecap="round" />
      <line x1={centro} y1={centro} x2={pSeg.x} y2={pSeg.y} stroke="var(--coral-500)" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx={centro} cy={centro} r="4" fill="var(--gold-300)" />
    </svg>
  );
}

function WorldClockDetailModal({ reloj, onClose }) {
  if (!reloj) return null;
  const datos = getDatosPais(reloj.tz);
  let fechaLocal = '';
  try {
    fechaLocal = new Intl.DateTimeFormat('es-CL', {
      timeZone: reloj.tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }).format(new Date());
  } catch {
    fechaLocal = '';
  }

  return createPortal(
    <div style={styles.modalFondo} onClick={onClose}>
      <div style={{ ...styles.modalCaja, maxWidth: '380px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
        <button style={styles.modalCerrar} onClick={onClose} aria-label="Cerrar">✕</button>
        <p style={styles.modalLugar}>{reloj.nombre}</p>
        <AnalogClock tz={reloj.tz} />
        {fechaLocal && <p style={styles.relojFecha}>{fechaLocal}</p>}

        {datos ? (
          <div style={styles.modalStatsGrid}>
            <div style={styles.modalStat}>
              <p style={styles.modalStatLabel}>País</p>
              <p style={styles.modalStatValor}>{datos.bandera} {datos.pais}</p>
            </div>
            <div style={styles.modalStat}>
              <p style={styles.modalStatLabel}>Capital</p>
              <p style={styles.modalStatValor}>{datos.capital}</p>
            </div>
            <div style={styles.modalStat}>
              <p style={styles.modalStatLabel}>Población aprox.</p>
              <p style={styles.modalStatValor}>{datos.poblacion.toLocaleString('es-CL')}</p>
            </div>
            <div style={styles.modalStat}>
              <p style={styles.modalStatLabel}>Moneda</p>
              <p style={styles.modalStatValor}>{datos.moneda}</p>
            </div>
          </div>
        ) : (
          <p style={styles.loadingText}>Sin datos de referencia para esta zona horaria.</p>
        )}

        <p style={styles.fuente}>Población: estimación reciente, cifra aproximada.</p>
      </div>
    </div>,
    document.body
  );
}

export function WorldClockPanel() {
  const [relojes, setRelojes] = useState(getRelojes());
  const [ahora, setAhora] = useState(Date.now());
  const [inputValor, setInputValor] = useState('');
  const [errorAgregar, setErrorAgregar] = useState(null);
  const [detalleReloj, setDetalleReloj] = useState(null);

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
          <div key={i} style={{ ...styles.weatherRow, cursor: 'pointer' }} onClick={() => setDetalleReloj(r)}>
            <button
              style={styles.removeBtnCorner}
              onClick={(e) => { e.stopPropagation(); quitarReloj(r.nombre); }}
              title="Quitar"
            >
              ✕
            </button>
            <span style={styles.clockTemp}>{formatearHora(r.tz)}</span>
            <p style={styles.weatherPlace}>{r.nombre}</p>
            <p style={styles.weatherDesc}>{formatearFecha(r.tz)}</p>
          </div>
        ))}
      </div>
      {detalleReloj && (
        <WorldClockDetailModal reloj={detalleReloj} onClose={() => setDetalleReloj(null)} />
      )}
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
  periodosFila: { display: 'flex', gap: '6px', marginBottom: '18px' },
  periodoBtn: {
    background: 'var(--navy-800)', border: '1px solid var(--navy-700)', color: 'var(--paper-100)',
    borderRadius: '8px', padding: '5px 12px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
  },
  periodoBtnActivo: {
    background: 'var(--gold-500)', borderColor: 'var(--gold-500)', color: 'var(--navy-950)',
  },
  chartSvg: { width: '100%', height: '180px', display: 'block', marginBottom: '8px' },
  chartLabel: {
    fontSize: '9.5px', fontFamily: 'var(--font-mono)', fontWeight: 700, fill: 'var(--paper-050)',
  },
  chartRangoFechas: {
    display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', opacity: 0.55, marginBottom: '14px',
  },
  relojSvg: { width: '190px', height: '190px', display: 'block', margin: '4px auto 10px' },
  relojNumero: {
    fontSize: '13px', fontFamily: 'var(--font-display)', fill: 'var(--paper-050)', fontWeight: 600,
  },
  relojFecha: {
    fontSize: '0.82rem', color: 'var(--paper-050)', opacity: 0.75, textTransform: 'capitalize', margin: '0 0 18px',
  },
};
