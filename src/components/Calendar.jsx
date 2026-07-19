import { useEffect, useMemo, useState } from 'react';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

// Colores/etiquetas por fuente, para distinguir Google de Outlook a simple vista.
const FUENTES = {
  google: { color: 'var(--mint-300)', etiqueta: 'Google' },
  outlook: { color: '#4FA0E0', etiqueta: 'Outlook' },
};

// Lista curada de países frecuentes para el selector de "otro país" (la API
// de feriados soporta más de 100 países por código, pero se muestra un
// listado acotado para que sea fácil de elegir).
const PAISES_DISPONIBLES = [
  { code: 'AR', nombre: 'Argentina' },
  { code: 'PE', nombre: 'Perú' },
  { code: 'CO', nombre: 'Colombia' },
  { code: 'MX', nombre: 'México' },
  { code: 'BR', nombre: 'Brasil' },
  { code: 'UY', nombre: 'Uruguay' },
  { code: 'EC', nombre: 'Ecuador' },
  { code: 'BO', nombre: 'Bolivia' },
  { code: 'PY', nombre: 'Paraguay' },
  { code: 'PA', nombre: 'Panamá' },
  { code: 'US', nombre: 'Estados Unidos' },
  { code: 'CA', nombre: 'Canadá' },
  { code: 'ES', nombre: 'España' },
  { code: 'PT', nombre: 'Portugal' },
  { code: 'DE', nombre: 'Alemania' },
  { code: 'FR', nombre: 'Francia' },
  { code: 'IT', nombre: 'Italia' },
  { code: 'GB', nombre: 'Reino Unido' },
  { code: 'CN', nombre: 'China' },
  { code: 'JP', nombre: 'Japón' },
  { code: 'AU', nombre: 'Australia' },
];

const PAIS_EXTRA_KEY = 'descuentos-tc-calendario-pais-extra';

function claveFecha(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Genera las celdas del mes (con huecos vacíos al inicio para que la semana
// empiece en lunes, como es habitual en Chile).
function generarCeldasDelMes(anio, mesIndex0) {
  const primerDia = new Date(anio, mesIndex0, 1);
  const offset = (primerDia.getDay() + 6) % 7; // getDay(): 0=domingo..6=sábado
  const diasEnMes = new Date(anio, mesIndex0 + 1, 0).getDate();

  const celdas = [];
  for (let i = 0; i < offset; i++) celdas.push(null);
  for (let dia = 1; dia <= diasEnMes; dia++) celdas.push(new Date(anio, mesIndex0, dia));
  return celdas;
}

function formatearHora(iso) {
  if (!iso || iso.length <= 10) return null; // solo fecha (evento de todo el día)
  return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function Calendar() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mesIndex0, setMesIndex0] = useState(hoy.getMonth());
  const [diaSeleccionado, setDiaSeleccionado] = useState(claveFecha(hoy));
  const [eventos, setEventos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [feriadosCL, setFeriadosCL] = useState([]);
  const [feriadosExtra, setFeriadosExtra] = useState([]);
  const [efemerides, setEfemerides] = useState([]);
  const [paisExtra, setPaisExtra] = useState(() => {
    try {
      return localStorage.getItem(PAIS_EXTRA_KEY) || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    let activo = true;
    setLoading(true);
    setError(null);

    Promise.allSettled([
      fetch(`/api/calendar-events?year=${anio}&month=${mesIndex0 + 1}`).then((r) => r.json()),
      fetch(`/api/outlook-events?year=${anio}&month=${mesIndex0 + 1}`).then((r) => r.json()),
    ]).then(([googleRes, outlookRes]) => {
      if (!activo) return;

      const avisos = [];
      let combinados = [];

      if (googleRes.status === 'fulfilled' && !googleRes.value.error) {
        combinados = combinados.concat(
          (googleRes.value.eventos || []).map((ev) => ({ ...ev, fuente: ev.fuente || 'google' }))
        );
      } else {
        avisos.push('Google Calendar no disponible.');
      }

      if (outlookRes.status === 'fulfilled' && !outlookRes.value.error) {
        combinados = combinados.concat(
          (outlookRes.value.eventos || []).map((ev) => ({ ...ev, fuente: ev.fuente || 'outlook' }))
        );
      } else {
        avisos.push('Outlook no disponible.');
      }

      setEventos(combinados);
      // Si ambas fuentes fallan, es un error real; si solo falla una, es un
      // aviso menor (la otra fuente igual se muestra con normalidad).
      setError(avisos.length > 0 ? avisos.join(' ') : null);
    }).finally(() => activo && setLoading(false));

    return () => {
      activo = false;
    };
  }, [anio, mesIndex0]);

  // Los feriados de Chile se cargan siempre, una vez por año (no dependen
  // del mes que se esté viendo).
  useEffect(() => {
    let activo = true;
    fetch(`/api/calendar-events?type=holidays&year=${anio}&country=CL`)
      .then((r) => r.json())
      .then((d) => activo && setFeriadosCL(d.feriados || []))
      .catch(() => activo && setFeriadosCL([]));
    return () => {
      activo = false;
    };
  }, [anio]);

  // Efeméride del día: se pide una sola vez, para la fecha real de hoy (no
  // depende de qué mes esté navegando el usuario en el calendario).
  useEffect(() => {
    let activo = true;
    fetch(`/api/calendar-events?type=efemerides&month=${hoy.getMonth() + 1}&day=${hoy.getDate()}`)
      .then((r) => r.json())
      .then((d) => activo && setEfemerides(d.efemerides || []))
      .catch(() => activo && setEfemerides([]));
    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El país adicional es opcional; sus feriados se suman a los de Chile,
  // nunca los reemplazan.
  useEffect(() => {
    if (!paisExtra) {
      setFeriadosExtra([]);
      return;
    }
    let activo = true;
    fetch(`/api/calendar-events?type=holidays&year=${anio}&country=${paisExtra}`)
      .then((r) => r.json())
      .then((d) => activo && setFeriadosExtra(d.feriados || []))
      .catch(() => activo && setFeriadosExtra([]));
    return () => {
      activo = false;
    };
  }, [anio, paisExtra]);

  const cambiarPaisExtra = (code) => {
    setPaisExtra(code);
    try {
      if (code) localStorage.setItem(PAIS_EXTRA_KEY, code);
      else localStorage.removeItem(PAIS_EXTRA_KEY);
    } catch {
      // si localStorage falla, no es crítico — simplemente no persiste
    }
  };

  const eventosPorDia = useMemo(() => {
    const mapa = {};
    (eventos || []).forEach((ev) => {
      if (!ev.inicio) return;
      const clave = ev.inicio.slice(0, 10);
      if (!mapa[clave]) mapa[clave] = [];
      mapa[clave].push(ev);
    });
    // Dentro de cada día, ordena los eventos por hora de inicio.
    Object.values(mapa).forEach((lista) => lista.sort((a, b) => (a.inicio > b.inicio ? 1 : -1)));
    return mapa;
  }, [eventos]);

  const feriadosPorDia = useMemo(() => {
    const mapa = {};
    [...feriadosCL, ...feriadosExtra].forEach((f) => {
      if (!mapa[f.fecha]) mapa[f.fecha] = [];
      mapa[f.fecha].push(f);
    });
    return mapa;
  }, [feriadosCL, feriadosExtra]);

  // Cumpleaños: se detectan entre los eventos ya cargados de Google/Outlook
  // (no es una fuente aparte), buscando la palabra "cumpleaños" en el
  // título — así funciona con cualquier cumpleaños que agregues, sin tener
  // que configurar nada aparte.
  const cumpleanosPorDia = useMemo(() => {
    const mapa = {};
    (eventos || []).forEach((ev) => {
      if (!ev.inicio || !/cumplea/i.test(ev.titulo || '')) return;
      const clave = ev.inicio.slice(0, 10);
      if (!mapa[clave]) mapa[clave] = [];
      mapa[clave].push(ev);
    });
    return mapa;
  }, [eventos]);

  const celdas = useMemo(() => generarCeldasDelMes(anio, mesIndex0), [anio, mesIndex0]);
  const claveHoy = claveFecha(hoy);

  // Contenido de la cinta: cumpleaños de hoy (si el mes que se está viendo
  // es el actual, ya que los eventos solo se cargan del mes en pantalla) +
  // la efeméride del día. Si no hay nada que mostrar, la cinta no aparece.
  const itemsCinta = useMemo(() => {
    const items = [];
    (feriadosPorDia[claveHoy] || []).forEach((f) => items.push(`🎉 Hoy es feriado: ${f.nombre}${f.pais !== 'CL' ? ` (${f.pais})` : ''}`));
    (cumpleanosPorDia[claveHoy] || []).forEach((ev) => items.push(`🎂 ${ev.titulo}`));
    efemerides.forEach((ef) => items.push(`📅 Un día como hoy, ${ef.anio}: ${ef.texto}`));
    return items;
  }, [feriadosPorDia, cumpleanosPorDia, claveHoy, efemerides]);

  const cambiarMes = (delta) => {
    let m = mesIndex0 + delta;
    let a = anio;
    if (m < 0) { m = 11; a -= 1; }
    if (m > 11) { m = 0; a += 1; }
    setMesIndex0(m);
    setAnio(a);
  };

  const eventosDelDiaSel = eventosPorDia[diaSeleccionado] || [];
  const feriadosDelDiaSel = feriadosPorDia[diaSeleccionado] || [];

  return (
    <section style={styles.wrap}>
      <h2 style={styles.h2}>Calendario</h2>

      {itemsCinta.length > 0 && (
        <div style={styles.cintaWrap} className="calendario-cinta">
          <div style={styles.cintaTrack} className="calendario-cinta-track">
            <span style={styles.cintaItem}>{itemsCinta.join('     •     ')}</span>
          </div>
        </div>
      )}

      <div style={styles.card}>
        <div style={styles.headerRow}>
          <button style={styles.navBtn} onClick={() => cambiarMes(-1)} aria-label="Mes anterior">‹</button>
          <p style={styles.mesTitulo}>{MESES[mesIndex0]} {anio}</p>
          <button style={styles.navBtn} onClick={() => cambiarMes(1)} aria-label="Mes siguiente">›</button>
        </div>

        {loading && <p style={styles.loadingText}>Cargando eventos…</p>}
        {error && <p style={styles.errorText}>{error}</p>}

        <div style={styles.gridDias}>
          {DIAS_SEMANA.map((d, i) => (
            <div key={i} style={styles.diaSemana}>{d}</div>
          ))}
          {celdas.map((fecha, i) => {
            if (!fecha) return <div key={`vacio-${i}`} />;
            const clave = claveFecha(fecha);
            const fuentesDelDia = [...new Set((eventosPorDia[clave] || []).map((ev) => ev.fuente))];
            const esFeriado = !!feriadosPorDia[clave];
            const esCumpleanos = !!cumpleanosPorDia[clave];
            const esHoy = clave === claveHoy;
            const esSeleccionado = clave === diaSeleccionado;
            const titulosParaTooltip = [
              ...(esFeriado ? feriadosPorDia[clave].map((f) => f.nombre) : []),
              ...(esCumpleanos ? cumpleanosPorDia[clave].map((ev) => ev.titulo) : []),
            ];
            return (
              <button
                key={clave}
                onClick={() => setDiaSeleccionado(clave)}
                title={titulosParaTooltip.length > 0 ? titulosParaTooltip.join(' / ') : undefined}
                style={{
                  ...styles.celdaDia,
                  ...(esCumpleanos ? styles.celdaCumpleanos : {}),
                  ...(esFeriado ? styles.celdaFeriado : {}),
                  ...(esHoy ? styles.celdaHoy : {}),
                  ...(esSeleccionado ? styles.celdaSeleccionada : {}),
                }}
              >
                {fecha.getDate()}
                {fuentesDelDia.length > 0 && (
                  <span style={styles.puntosWrap}>
                    {fuentesDelDia.map((f) => (
                      <span key={f} style={{ ...styles.puntoEvento, background: FUENTES[f]?.color || 'var(--mint-300)' }} />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div style={styles.paisExtraRow}>
          <span style={styles.paisExtraLabel}>+ Feriados de otro país:</span>
          <select
            style={styles.paisExtraSelect}
            value={paisExtra}
            onChange={(e) => cambiarPaisExtra(e.target.value)}
          >
            <option value="">Ninguno</option>
            {PAISES_DISPONIBLES.map((p) => (
              <option key={p.code} value={p.code}>{p.nombre}</option>
            ))}
          </select>
        </div>

        <div style={styles.detalleDia}>
          <p style={styles.detalleFecha}>
            {new Date(`${diaSeleccionado}T00:00:00`).toLocaleDateString('es-CL', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
          </p>

          {feriadosDelDiaSel.map((f, i) => (
            <div key={i} style={styles.feriadoBanner}>
              🎉 {f.nombre} {f.pais !== 'CL' ? `(${f.pais})` : ''}
            </div>
          ))}

          {eventosDelDiaSel.length === 0 && feriadosDelDiaSel.length === 0 && !loading && (
            <p style={styles.sinEventos}>Sin actividades para este día.</p>
          )}
          {eventosDelDiaSel.map((ev) => {
            const fuenteInfo = FUENTES[ev.fuente] || FUENTES.google;
            return (
              <a
                key={ev.id}
                href={ev.link || undefined}
                target="_blank"
                rel="noreferrer"
                style={{ ...styles.eventoItem, borderLeft: `3px solid ${fuenteInfo.color}` }}
              >
                <div style={styles.eventoTopRow}>
                  <span style={styles.eventoHora}>{ev.todoElDia ? 'Todo el día' : (formatearHora(ev.inicio) || '')}</span>
                  <span style={{ ...styles.eventoFuente, color: fuenteInfo.color }}>{fuenteInfo.etiqueta}</span>
                </div>
                <span style={styles.eventoTitulo}>{ev.titulo}</span>
                {ev.lugar && <span style={styles.eventoLugar}>{ev.lugar}</span>}
              </a>
            );
          })}
        </div>

        <p style={styles.fuenteNota}>Conectado a tu Google Calendar y tu Outlook · Feriados en rojo · Cumpleaños en verde (detectados por el título del evento).</p>
      </div>
    </section>
  );
}

const styles = {
  wrap: { marginTop: '28px' },
  h2: { fontFamily: 'var(--font-display)', fontSize: '2rem', margin: '0 0 8px', color: 'var(--paper-050)' },
  cintaWrap: {
    position: 'relative', overflow: 'hidden', height: '30px', background: 'var(--navy-900)',
    border: '1px solid var(--navy-700)', borderRadius: '8px', marginBottom: '14px',
  },
  cintaTrack: {
    position: 'absolute', top: 0, display: 'flex', alignItems: 'center', height: '100%',
    whiteSpace: 'nowrap', animationDuration: '300s',
  },
  cintaItem: { fontSize: '0.78rem', color: 'var(--gold-300)', padding: '0 28px' },
  card: {
    background: 'var(--navy-900)', border: '1px solid var(--navy-700)',
    borderRadius: '14px', padding: '18px 16px',
  },
  headerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' },
  navBtn: {
    background: 'var(--navy-800)', border: '1px solid var(--navy-700)', color: 'var(--paper-100)',
    borderRadius: '8px', width: '32px', height: '32px', fontSize: '1.1rem', lineHeight: 1,
  },
  mesTitulo: {
    fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--gold-300)',
    margin: 0, textTransform: 'capitalize',
  },
  loadingText: { fontSize: '0.78rem', opacity: 0.6, margin: '0 0 10px' },
  errorText: { fontSize: '0.78rem', color: 'var(--coral-500)', margin: '0 0 10px' },
  gridDias: {
    display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '14px',
  },
  diaSemana: {
    textAlign: 'center', fontSize: '0.68rem', opacity: 0.55, fontWeight: 600, padding: '4px 0',
  },
  celdaDia: {
    position: 'relative', aspectRatio: '1', background: 'var(--navy-800)', border: '1px solid transparent',
    borderRadius: '8px', color: 'var(--paper-100)', fontSize: '0.82rem', display: 'flex',
    alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
  },
  celdaCumpleanos: { border: '1px solid var(--mint-300)', color: 'var(--mint-300)', fontWeight: 700 },
  celdaFeriado: { border: '1px solid var(--coral-500)', color: 'var(--coral-500)', fontWeight: 700 },
  celdaHoy: { border: '1px solid var(--gold-500)' },
  celdaSeleccionada: { background: 'var(--gold-500)', color: 'var(--navy-950)', fontWeight: 700 },
  puntosWrap: {
    position: 'absolute', bottom: '4px', left: '50%', transform: 'translateX(-50%)',
    display: 'flex', gap: '2px',
  },
  puntoEvento: { width: '4px', height: '4px', borderRadius: '50%' },
  paisExtraRow: {
    display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px',
    borderTop: '1px solid var(--navy-700)', paddingTop: '12px',
  },
  paisExtraLabel: { fontSize: '0.72rem', opacity: 0.65, whiteSpace: 'nowrap' },
  paisExtraSelect: {
    flex: 1, background: 'var(--navy-800)', border: '1px solid var(--navy-700)', color: 'var(--paper-050)',
    borderRadius: '6px', padding: '4px 6px', fontSize: '0.75rem', outline: 'none',
  },
  detalleDia: {
    borderTop: '1px solid var(--navy-700)', paddingTop: '14px',
    display: 'flex', flexDirection: 'column', gap: '8px',
  },
  detalleFecha: {
    fontSize: '0.9rem', fontWeight: 700, color: 'var(--paper-050)', margin: '0 0 4px', textTransform: 'capitalize',
  },
  feriadoBanner: {
    background: 'rgba(232,96,76,0.15)', border: '1px solid var(--coral-500)', borderRadius: '8px',
    padding: '8px 10px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--coral-500)',
  },
  sinEventos: { fontSize: '0.82rem', opacity: 0.6, margin: 0 },
  eventoItem: {
    display: 'flex', flexDirection: 'column', gap: '2px', background: 'var(--navy-800)',
    borderRadius: '8px', padding: '8px 10px', textDecoration: 'none', color: 'inherit',
  },
  eventoTopRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  eventoHora: { fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--mint-300)' },
  eventoFuente: { fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' },
  eventoTitulo: { fontSize: '0.85rem', fontWeight: 600 },
  eventoLugar: { fontSize: '0.72rem', opacity: 0.6 },
  fuenteNota: { fontSize: '0.65rem', opacity: 0.45, margin: '14px 0 0' },
};
