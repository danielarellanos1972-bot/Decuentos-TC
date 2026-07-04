import { useEffect, useState } from 'react';
import { REGIONES_CHILE, REGION_DEFAULT, COMUNAS_RM } from '../data/regionesChile.js';
import { getFuenteOficial } from '../data/fuentesOficiales.js';
import { getBankColors } from '../data/bancos.js';

const ORDEN_DIAS = ['Todos los días', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const CONFIRMADAS_KEY = 'descuentos-tc-confirmadas';
const DESCARTADAS_KEY = 'descuentos-tc-descartadas';

function cargarJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export default function WeeklyOffers({ tarjetas }) {
  const [region, setRegion] = useState(REGION_DEFAULT);
  const [comuna, setComuna] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  // Ofertas que el usuario confirmó como reales — persisten en el celular.
  // Forma: { [tarjetaId]: [{ dia, comercio, descuento, tope, comuna, fuenteUrl }] }
  const [confirmadas, setConfirmadas] = useState(() => cargarJSON(CONFIRMADAS_KEY, {}));
  // Nombres de comercio que el usuario ya rechazó por tarjeta — para no volver a
  // mostrarlos si la búsqueda los trae de nuevo. Forma: { [tarjetaId]: ["nombre1", ...] }
  const [descartadas, setDescartadas] = useState(() => cargarJSON(DESCARTADAS_KEY, {}));

  // Resultados recién buscados, pendientes de que el usuario los confirme o descarte.
  // No se guardan — viven solo mientras la app está abierta.
  const [pendientes, setPendientes] = useState({}); // { [tarjetaId]: { loading, error, items } }

  const [formularioAbiertoId, setFormularioAbiertoId] = useState(null);
  const [formulario, setFormulario] = useState({ dia: 'Todos los días', comercio: '', descuento: '', tope: '', comuna: '' });

  useEffect(() => {
    localStorage.setItem(CONFIRMADAS_KEY, JSON.stringify(confirmadas));
  }, [confirmadas]);

  useEffect(() => {
    localStorage.setItem(DESCARTADAS_KEY, JSON.stringify(descartadas));
  }, [descartadas]);

  const esRM = region === REGION_DEFAULT;

  const buscarNuevas = async (tarjeta) => {
    setPendientes((prev) => ({ ...prev, [tarjeta.id]: { loading: true, error: null, items: [] } }));

    try {
      const fuente = getFuenteOficial(tarjeta.banco, tarjeta.nombre);
      const enlacesRestaurantes = (fuente?.enlaces || []).filter((e) => e.categorias?.includes('restaurantes'));
      const urlsOficiales = (enlacesRestaurantes.length > 0 ? enlacesRestaurantes : (fuente?.enlaces || [])).map((e) => e.url);

      const resp = await fetch('/api/weekly-offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          banco: tarjeta.banco,
          tarjeta: tarjeta.nombre,
          dominioOficial: fuente?.dominio || null,
          urlsOficiales,
          region,
          comuna: comuna || null,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Error buscando ofertas semanales');

      // Filtramos: nada que ya esté confirmado o descartado para esta tarjeta.
      const yaConfirmadas = confirmadas[tarjeta.id] || [];
      const yaDescartadas = (descartadas[tarjeta.id] || []).map((n) => n.toLowerCase());

      const nuevos = (data.ofertasPorDia || []).filter((o) => {
        const nombre = o.comercio.trim().toLowerCase();
        if (yaDescartadas.includes(nombre)) return false;
        const yaEsta = yaConfirmadas.some((c) => c.comercio.trim().toLowerCase() === nombre && c.dia === o.dia);
        return !yaEsta;
      });

      setPendientes((prev) => ({
        ...prev,
        [tarjeta.id]: { loading: false, error: null, items: nuevos, mensaje: nuevos.length === 0 ? 'No se encontraron ofertas nuevas para revisar.' : null },
      }));
    } catch (err) {
      setPendientes((prev) => ({
        ...prev,
        [tarjeta.id]: { loading: false, error: err.message || 'No se pudo conectar con el buscador.', items: [] },
      }));
    }
  };

  const confirmarOferta = (tarjetaId, oferta) => {
    setConfirmadas((prev) => ({
      ...prev,
      [tarjetaId]: [...(prev[tarjetaId] || []), oferta],
    }));
    setPendientes((prev) => ({
      ...prev,
      [tarjetaId]: { ...prev[tarjetaId], items: prev[tarjetaId].items.filter((o) => o !== oferta) },
    }));
  };

  const descartarOferta = (tarjetaId, oferta) => {
    setDescartadas((prev) => ({
      ...prev,
      [tarjetaId]: [...(prev[tarjetaId] || []), oferta.comercio.trim().toLowerCase()],
    }));
    setPendientes((prev) => ({
      ...prev,
      [tarjetaId]: { ...prev[tarjetaId], items: prev[tarjetaId].items.filter((o) => o !== oferta) },
    }));
  };

  const eliminarConfirmada = (tarjetaId, index) => {
    setConfirmadas((prev) => ({
      ...prev,
      [tarjetaId]: prev[tarjetaId].filter((_, i) => i !== index),
    }));
  };

  const agregarManual = (tarjeta) => {
    if (!formulario.comercio.trim() || !formulario.descuento.trim()) return;
    setConfirmadas((prev) => ({
      ...prev,
      [tarjeta.id]: [...(prev[tarjeta.id] || []), { ...formulario, fuenteUrl: null }],
    }));
    setFormulario({ dia: 'Todos los días', comercio: '', descuento: '', tope: '', comuna: '' });
    setFormularioAbiertoId(null);
  };

  const toggleCard = (tarjeta) => {
    setExpandedId((prev) => (prev === tarjeta.id ? null : tarjeta.id));
    setFormularioAbiertoId(null);
  };

  const handleRegionChange = (nuevaRegion) => {
    setRegion(nuevaRegion);
    setComuna('');
  };

  return (
    <section style={styles.wrap}>
      <h2 style={styles.h2}>Ofertas Diarias en Restaurantes</h2>
      <p style={styles.sub}>Busca, confirma y guarda tus descuentos de Lunes a Domingo por tarjeta.</p>

      <div style={styles.filtros}>
        <select style={styles.select} value={region} onChange={(e) => handleRegionChange(e.target.value)}>
          {REGIONES_CHILE.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        {esRM ? (
          <select style={styles.select} value={comuna} onChange={(e) => setComuna(e.target.value)}>
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
            onChange={(e) => setComuna(e.target.value)}
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
          const confirmadasTarjeta = confirmadas[t.id] || [];
          const pendiente = pendientes[t.id];

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
                <span style={{ ...styles.chip, background: colores.text }} />
                <span style={styles.cardHeaderText}>
                  {t.banco} — {t.nombre}
                  {confirmadasTarjeta.length > 0 && <span style={styles.badge}> {confirmadasTarjeta.length}</span>}
                </span>
                <span style={styles.chevron}>{isOpen ? '▲' : '▼'}</span>
              </button>
              {colores.accent && (
                <div style={{ ...styles.headerAccent, background: colores.accent }} />
              )}

              {isOpen && (
                <div style={styles.cardBody}>
                  {/* Ofertas confirmadas guardadas */}
                  {confirmadasTarjeta.length === 0 ? (
                    <p style={styles.stateText}>Aún no tienes ofertas confirmadas para esta tarjeta.</p>
                  ) : (
                    <DiasAgrupados
                      ofertas={confirmadasTarjeta}
                      renderAcciones={(oferta, i) => (
                        <button style={styles.miniBtnDanger} onClick={() => eliminarConfirmada(t.id, i)}>
                          Quitar
                        </button>
                      )}
                    />
                  )}

                  {/* Formulario manual */}
                  <div style={styles.accionesRow}>
                    <button
                      style={styles.secondaryBtn}
                      onClick={() => setFormularioAbiertoId(formularioAbiertoId === t.id ? null : t.id)}
                    >
                      {formularioAbiertoId === t.id ? 'Cancelar' : '+ Agregar oferta manual'}
                    </button>
                    <button style={styles.secondaryBtn} onClick={() => buscarNuevas(t)}>
                      🔍 Buscar nuevas ofertas
                    </button>
                  </div>

                  {formularioAbiertoId === t.id && (
                    <div style={styles.formulario}>
                      <select
                        style={styles.formInput}
                        value={formulario.dia}
                        onChange={(e) => setFormulario((f) => ({ ...f, dia: e.target.value }))}
                      >
                        {ORDEN_DIAS.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <input
                        style={styles.formInput}
                        placeholder="Nombre del restaurante"
                        value={formulario.comercio}
                        onChange={(e) => setFormulario((f) => ({ ...f, comercio: e.target.value }))}
                      />
                      <input
                        style={styles.formInput}
                        placeholder="Descuento (ej: 30%)"
                        value={formulario.descuento}
                        onChange={(e) => setFormulario((f) => ({ ...f, descuento: e.target.value }))}
                      />
                      <input
                        style={styles.formInput}
                        placeholder="Tope (opcional, ej: $30.000)"
                        value={formulario.tope}
                        onChange={(e) => setFormulario((f) => ({ ...f, tope: e.target.value }))}
                      />
                      <input
                        style={styles.formInput}
                        placeholder="Comuna (opcional)"
                        value={formulario.comuna}
                        onChange={(e) => setFormulario((f) => ({ ...f, comuna: e.target.value }))}
                      />
                      <button style={styles.saveBtn} onClick={() => agregarManual(t)}>Guardar oferta</button>
                    </div>
                  )}

                  {/* Resultados pendientes de revisión */}
                  {pendiente?.loading && (
                    <div style={styles.stateBox}>
                      <div style={styles.spinner} />
                      <p style={styles.stateText}>Buscando ofertas nuevas…</p>
                    </div>
                  )}

                  {pendiente?.error && (
                    <p style={{ ...styles.stateText, color: 'var(--coral-500)' }}>{pendiente.error}</p>
                  )}

                  {!pendiente?.loading && pendiente?.mensaje && (
                    <p style={styles.stateText}>{pendiente.mensaje}</p>
                  )}

                  {!pendiente?.loading && pendiente?.items?.length > 0 && (
                    <div style={styles.pendientesWrap}>
                      <p style={styles.pendientesTitulo}>Pendientes de revisar — confirma solo lo que reconozcas como real:</p>
                      {pendiente.items.map((o, i) => (
                        <div key={i} style={styles.pendienteRow}>
                          <div style={styles.ofertaTop}>
                            <span style={styles.ofertaComercio}>{o.comercio}</span>
                            <span style={styles.ofertaDescuento}>{o.descuento}</span>
                          </div>
                          <div style={styles.ofertaMeta}>
                            <span>{o.dia}</span>
                            {o.tope && o.tope !== 'No especificado' && <span>Tope: {o.tope}</span>}
                            {o.comuna && o.comuna !== 'No especificado' && <span>{o.comuna}</span>}
                          </div>
                          {o.fuenteUrl && (
                            <a href={o.fuenteUrl} target="_blank" rel="noreferrer" style={styles.ofertaFuente}>Ver fuente ↗</a>
                          )}
                          <div style={styles.pendienteAcciones}>
                            <button style={styles.miniBtnOk} onClick={() => confirmarOferta(t.id, o)}>✓ Confirmar</button>
                            <button style={styles.miniBtnDanger} onClick={() => descartarOferta(t.id, o)}>✗ Descartar</button>
                          </div>
                        </div>
                      ))}
                    </div>
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

function DiasAgrupados({ ofertas, renderAcciones }) {
  const porDia = {};
  ofertas.forEach((o, i) => {
    if (!porDia[o.dia]) porDia[o.dia] = [];
    porDia[o.dia].push({ ...o, _index: i });
  });

  const diasConDatos = ORDEN_DIAS.filter((d) => porDia[d]?.length > 0);

  return (
    <div style={styles.diasWrap}>
      {diasConDatos.map((dia) => (
        <div key={dia} style={styles.diaBloque}>
          <p style={styles.diaLabel}>{dia}</p>
          {porDia[dia].map((o) => (
            <div key={o._index} style={styles.ofertaRow}>
              <div style={styles.ofertaTop}>
                <span style={styles.ofertaComercio}>{o.comercio}</span>
                <span style={styles.ofertaDescuento}>{o.descuento}</span>
              </div>
              <div style={styles.ofertaMeta}>
                {o.tope && o.tope !== 'No especificado' && <span>Tope: {o.tope}</span>}
                {o.comuna && o.comuna !== 'No especificado' && <span>{o.comuna}</span>}
              </div>
              {o.fuenteUrl && (
                <a href={o.fuenteUrl} target="_blank" rel="noreferrer" style={styles.ofertaFuente}>Ver fuente ↗</a>
              )}
              {renderAcciones && <div style={styles.confirmadaAcciones}>{renderAcciones(o, o._index)}</div>}
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
  chip: {
    width: '20px', height: '14px', borderRadius: '3px', opacity: 0.85,
    display: 'inline-block', marginRight: '10px', flexShrink: 0,
  },
  headerAccent: { height: '4px' },
  badge: { opacity: 0.8, fontWeight: 400, fontSize: '0.8rem' },
  chevron: { fontSize: '0.75rem', opacity: 0.85, marginLeft: '10px' },
  cardBody: { background: 'var(--navy-800)', padding: '14px' },
  accionesRow: { display: 'flex', gap: '8px', margin: '12px 0', flexWrap: 'wrap' },
  secondaryBtn: {
    background: 'transparent', border: '1px solid var(--navy-700)', color: 'var(--mint-300)',
    borderRadius: '8px', padding: '8px 12px', fontSize: '0.8rem', flex: '1 1 auto',
  },
  formulario: {
    display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--navy-900)',
    padding: '12px', borderRadius: '10px', marginBottom: '14px',
  },
  formInput: {
    background: 'var(--navy-800)', color: 'var(--paper-100)', border: '1px solid var(--navy-700)',
    borderRadius: '8px', padding: '9px', fontSize: '0.85rem',
  },
  saveBtn: {
    background: 'var(--gold-500)', color: 'var(--navy-950)', border: 'none',
    borderRadius: '8px', padding: '9px', fontWeight: 700, fontSize: '0.85rem',
  },
  stateBox: { textAlign: 'center', padding: '20px 12px', opacity: 0.75 },
  spinner: {
    width: '22px', height: '22px', border: '3px solid var(--navy-700)', borderTopColor: 'var(--gold-500)',
    borderRadius: '50%', margin: '0 auto 10px', animation: 'spin 0.8s linear infinite',
  },
  stateText: { fontSize: '0.88rem', color: 'var(--paper-100)', margin: '0 0 8px', opacity: 0.85 },
  pendientesWrap: { marginTop: '10px' },
  pendientesTitulo: { fontSize: '0.78rem', color: 'var(--gold-300)', marginBottom: '10px' },
  pendienteRow: {
    background: 'var(--navy-900)', borderRadius: '10px', padding: '10px 12px', marginBottom: '8px',
    borderLeft: '3px solid var(--gold-500)',
  },
  pendienteAcciones: { display: 'flex', gap: '8px', marginTop: '8px' },
  diasWrap: { display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '4px' },
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
  confirmadaAcciones: { marginTop: '8px' },
  miniBtnOk: {
    background: 'var(--mint-500)', color: 'var(--navy-950)', border: 'none',
    borderRadius: '6px', padding: '6px 10px', fontSize: '0.76rem', fontWeight: 700, flex: 1,
  },
  miniBtnDanger: {
    background: 'transparent', color: 'var(--coral-500)', border: '1px solid var(--coral-500)',
    borderRadius: '6px', padding: '6px 10px', fontSize: '0.76rem', fontWeight: 600, flex: 1,
  },
};
