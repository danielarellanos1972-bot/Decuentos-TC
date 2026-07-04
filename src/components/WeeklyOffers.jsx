import { useState } from 'react';
import { REGIONES_CHILE, REGION_DEFAULT, COMUNAS_RM } from '../data/regionesChile.js';
import { getFuenteOficial } from '../data/fuentesOficiales.js';
import { getBankColors } from '../data/bancos.js';

const ORDEN_DIAS = ['Todos los días', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export default function WeeklyOffers({ tarjetas }) {
  const [region, setRegion] = useState(REGION_DEFAULT);
  const [comuna, setComuna] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [cache, setCache] = useState({});

  const esRM = region === REGION_DEFAULT;

  const buscarSemanal = async (tarjeta) => {
    setCache((prev) => ({
      ...prev,
      [tarjeta.id]: { loading: true, error: null, mensaje: null, ofertasPorDia: [], region, comuna },
    }));

    try {
      const fuente = getFuenteOficial(tarjeta.banco, tarjeta.nombre);
      const resp = await fetch('/api/weekly-offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          banco: tarjeta.banco,
          tarjeta: tarjeta.nombre,
          dominioOficial: fuente?.dominio || null,
          region,
          comuna: comuna || null,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Error buscando ofertas semanales');

      setCache((prev) => ({
        ...prev,
        [tarjeta.id]: {
          loading: false, error: null,
          mensaje: (data.ofertasPorDia || []).length === 0
            ? (data.mensaje || 'No se encontraron ofertas semanales para esta combinación.')
            : null,
          ofertasPorDia: data.ofertasPorDia || [],
          region, comuna,
        },
      }));
    } catch (err) {
      setCache((prev) => ({
        ...prev,
        [tarjeta.id]: {
          loading: false, error: err.message || 'No se pudo conectar con el buscador.',
          mensaje: null, ofertasPorDia: [], region, comuna,
        },
      }));
    }
  };

  const toggleCard = (tarjeta) => {
    const yaAbierta = expandedId === tarjeta.id;
    setExpandedId(yaAbierta ? null : tarjeta.id);

    if (!yaAbierta) {
      const cacheada = cache[tarjeta.id];
      const cacheValida = cacheada && cacheada.region === region && cacheada.comuna === comuna && !cacheada.error;
      if (!cacheValida) {
        buscarSemanal(tarjeta);
      }
    }
  };

  const handleRegionChange = (nuevaRegion) => {
    setRegion(nuevaRegion);
    setComuna('');
    setExpandedId(null);
  };

  const handleComunaChange = (nuevaComuna) => {
    setComuna(nuevaComuna);
    setExpandedId(null);
  };

  return (
    <section style={styles.wrap}>
      <h2 style={styles.h2}>Ofertas diarias en Restaurantes</h2>
      <p style={styles.sub}>Descuentos de Lunes a Domingo por tarjeta, según tu zona.</p>

      <div style={styles.filtros}>
        <select style={styles.select} value={region} onChange={(e) => handleRegionChange(e.target.value)}>
          {REGIONES_CHILE.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        {esRM ? (
          <select style={styles.select} value={comuna} onChange={(e) => handleComunaChange(e.target.value)}>
            <option value="">Todas las comunas</option>
            {COMUNAS_RM.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        ) : (
          <input
            style={styles.select}
            placeholder="Comuna (opcional)"
            value={comuna}
            onChange={(e) => handleComunaChange(e.target.value)}
          />
        )}
      </div>

      {tarjetas.length === 0 && (
        <p style={styles.empty}>Agrega una tarjeta arriba para ver sus ofertas semanales.</p>
      )}

      <div style={styles.list}>
        {tarjetas.map((t) => {
          const isOpen = expandedId === t.id;
          const colores = getBankColors(t.banco, t.nombre);
          const estado = cache[t.id];

          return (
            <div key={t.id} style={styles.cardWrap}>
              <button
                style={{
                  ...styles.cardHeader,
                  background: `linear-gradient(135deg, ${colores.from}, ${colores.to})`,
                  color: colores.text,
                }}
                onClick={() => toggleCard(t)}
              >
                <span style={styles.cardHeaderText}>{t.banco} — {t.nombre}</span>
                <span style={styles.chevron}>{isOpen ? '▲' : '▼'}</span>
              </button>

              {isOpen && (
                <div style={styles.cardBody}>
                  {estado?.loading && (
                    <div style={styles.stateBox}>
                      <div style={styles.spinner} />
                      <p style={styles.stateText}>Buscando ofertas de la semana…</p>
                    </div>
                  )}

                  {estado?.error && (
                    <p style={{ ...styles.stateText, color: 'var(--coral-500)' }}>{estado.error}</p>
                  )}

                  {!estado?.loading && !estado?.error && estado?.mensaje && (
                    <p style={styles.stateText}>{estado.mensaje}</p>
                  )}

                  {!estado?.loading && !estado?.error && (estado?.ofertasPorDia?.length > 0) && (
                    <DiasAgrupados ofertas={estado.ofertasPorDia} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DiasAgrupados({ ofertas }) {
  const porDia = {};
  ofertas.forEach((o) => {
    if (!porDia[o.dia]) porDia[o.dia] = [];
    porDia[o.dia].push(o);
  });

  const diasConDatos = ORDEN_DIAS.filter((d) => porDia[d]?.length > 0);

  return (
    <div style={styles.diasWrap}>
      {diasConDatos.map((dia) => (
        <div key={dia} style={styles.diaBloque}>
          <p style={styles.diaLabel}>{dia}</p>
          {porDia[dia].map((o, i) => (
            <div key={i} style={styles.ofertaRow}>
              <div style={styles.ofertaTop}>
                <span style={styles.ofertaComercio}>{o.comercio}</span>
                <span style={styles.ofertaDescuento}>{o.descuento}</span>
              </div>
              <div style={styles.ofertaMeta}>
                {o.tope && o.tope !== 'No especificado' && <span>Tope: {o.tope}</span>}
                {o.comuna && o.comuna !== 'No especificado' && <span>{o.comuna}</span>}
              </div>
              {o.fuenteUrl && (
                <a href={o.fuenteUrl} target="_blank" rel="noreferrer" style={styles.ofertaFuente}>
                  Ver fuente ↗
                </a>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const styles = {
  wrap: { marginBottom: '28px' },
  h2: { fontFamily: 'var(--font-display)', fontSize: '1.15rem', margin: '0 0 4px', color: 'var(--paper-100)' },
  sub: { fontSize: '0.85rem', opacity: 0.65, margin: '0 0 14px' },
  filtros: { display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' },
  select: {
    flex: '1 1 140px', background: 'var(--navy-800)', color: 'var(--paper-100)',
    border: '1px solid var(--navy-700)', borderRadius: '8px', padding: '10px', fontSize: '0.88rem',
  },
  empty: { color: 'var(--paper-100)', opacity: 0.6, fontSize: '0.9rem' },
  list: { display: 'flex', flexDirection: 'column', gap: '10px' },
  cardWrap: { borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--navy-700)' },
  cardHeader: {
    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px', border: 'none', cursor: 'pointer', fontSize: '0.92rem', fontWeight: 700,
    textAlign: 'left',
  },
  cardHeaderText: { flex: 1 },
  chevron: { fontSize: '0.75rem', opacity: 0.85, marginLeft: '10px' },
  cardBody: { background: 'var(--navy-800)', padding: '14px' },
  stateBox: { textAlign: 'center', padding: '20px 12px', opacity: 0.75 },
  spinner: {
    width: '22px', height: '22px', border: '3px solid var(--navy-700)', borderTopColor: 'var(--gold-500)',
    borderRadius: '50%', margin: '0 auto 10px', animation: 'spin 0.8s linear infinite',
  },
  stateText: { fontSize: '0.88rem', color: 'var(--paper-100)', margin: 0 },
  diasWrap: { display: 'flex', flexDirection: 'column', gap: '14px' },
  diaBloque: {},
  diaLabel: {
    fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em',
    color: 'var(--gold-300)', fontWeight: 700, margin: '0 0 8px',
  },
  ofertaRow: {
    background: 'var(--navy-900)', borderRadius: '10px', padding: '10px 12px', marginBottom: '8px',
    borderLeft: '3px solid var(--mint-500)',
  },
  ofertaTop: { display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '4px' },
  ofertaComercio: { fontSize: '0.9rem', fontWeight: 600, color: 'var(--paper-100)' },
  ofertaDescuento: {
    background: 'var(--gold-500)', color: 'var(--navy-950)', fontWeight: 700, fontSize: '0.75rem',
    borderRadius: '999px', padding: '3px 9px', whiteSpace: 'nowrap', height: 'fit-content',
  },
  ofertaMeta: { display: 'flex', gap: '10px', fontSize: '0.76rem', opacity: 0.65, color: 'var(--paper-100)', marginBottom: '4px' },
  ofertaFuente: { fontSize: '0.76rem', color: 'var(--mint-300)', textDecoration: 'none' },
};
