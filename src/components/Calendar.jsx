import { useEffect, useMemo, useState } from 'react';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

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

  useEffect(() => {
    let activo = true;
    setLoading(true);
    setError(null);
    fetch(`/api/calendar-events?year=${anio}&month=${mesIndex0 + 1}`)
      .then((r) => r.json())
      .then((d) => {
        if (!activo) return;
        if (d.error) setError(d.error);
        else setEventos(d.eventos || []);
      })
      .catch(() => activo && setError('No se pudo conectar con Google Calendar.'))
      .finally(() => activo && setLoading(false));
    return () => {
      activo = false;
    };
  }, [anio, mesIndex0]);

  const eventosPorDia = useMemo(() => {
    const mapa = {};
    (eventos || []).forEach((ev) => {
      if (!ev.inicio) return;
      const clave = ev.inicio.slice(0, 10);
      if (!mapa[clave]) mapa[clave] = [];
      mapa[clave].push(ev);
    });
    return mapa;
  }, [eventos]);

  const celdas = useMemo(() => generarCeldasDelMes(anio, mesIndex0), [anio, mesIndex0]);
  const claveHoy = claveFecha(hoy);

  const cambiarMes = (delta) => {
    let m = mesIndex0 + delta;
    let a = anio;
    if (m < 0) { m = 11; a -= 1; }
    if (m > 11) { m = 0; a += 1; }
    setMesIndex0(m);
    setAnio(a);
  };

  const eventosDelDiaSel = eventosPorDia[diaSeleccionado] || [];

  return (
    <section style={styles.wrap}>
      <h2 style={styles.h2}>Calendario</h2>

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
            const tieneEventos = (eventosPorDia[clave] || []).length > 0;
            const esHoy = clave === claveHoy;
            const esSeleccionado = clave === diaSeleccionado;
            return (
              <button
                key={clave}
                onClick={() => setDiaSeleccionado(clave)}
                style={{
                  ...styles.celdaDia,
                  ...(esHoy ? styles.celdaHoy : {}),
                  ...(esSeleccionado ? styles.celdaSeleccionada : {}),
                }}
              >
                {fecha.getDate()}
                {tieneEventos && <span style={styles.puntoEvento} />}
              </button>
            );
          })}
        </div>

        <div style={styles.detalleDia}>
          <p style={styles.detalleFecha}>
            {new Date(`${diaSeleccionado}T00:00:00`).toLocaleDateString('es-CL', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
          </p>
          {eventosDelDiaSel.length === 0 && !loading && (
            <p style={styles.sinEventos}>Sin actividades para este día.</p>
          )}
          {eventosDelDiaSel.map((ev) => (
            <a
              key={ev.id}
              href={ev.link || undefined}
              target="_blank"
              rel="noreferrer"
              style={styles.eventoItem}
            >
              <span style={styles.eventoHora}>{ev.todoElDia ? 'Todo el día' : (formatearHora(ev.inicio) || '')}</span>
              <span style={styles.eventoTitulo}>{ev.titulo}</span>
              {ev.lugar && <span style={styles.eventoLugar}>{ev.lugar}</span>}
            </a>
          ))}
        </div>

        <p style={styles.fuente}>Conectado a tu Google Calendar principal.</p>
      </div>
    </section>
  );
}

const styles = {
  wrap: { marginTop: '28px' },
  h2: { fontFamily: 'var(--font-display)', fontSize: '2rem', margin: '0 0 8px', color: 'var(--paper-050)' },
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
  celdaHoy: { border: '1px solid var(--gold-500)' },
  celdaSeleccionada: { background: 'var(--gold-500)', color: 'var(--navy-950)', fontWeight: 700 },
  puntoEvento: {
    position: 'absolute', bottom: '4px', width: '4px', height: '4px', borderRadius: '50%',
    background: 'var(--mint-300)',
  },
  detalleDia: {
    borderTop: '1px solid var(--navy-700)', paddingTop: '14px',
    display: 'flex', flexDirection: 'column', gap: '8px',
  },
  detalleFecha: {
    fontSize: '0.9rem', fontWeight: 700, color: 'var(--paper-050)', margin: '0 0 4px', textTransform: 'capitalize',
  },
  sinEventos: { fontSize: '0.82rem', opacity: 0.6, margin: 0 },
  eventoItem: {
    display: 'flex', flexDirection: 'column', gap: '2px', background: 'var(--navy-800)',
    borderRadius: '8px', padding: '8px 10px', textDecoration: 'none', color: 'inherit',
  },
  eventoHora: { fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--mint-300)' },
  eventoTitulo: { fontSize: '0.85rem', fontWeight: 600 },
  eventoLugar: { fontSize: '0.72rem', opacity: 0.6 },
  fuente: { fontSize: '0.65rem', opacity: 0.45, margin: '14px 0 0' },
};
