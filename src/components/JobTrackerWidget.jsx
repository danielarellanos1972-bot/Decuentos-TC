import { useEffect, useState } from 'react';
import { cargarLocal, cargarRemoto, guardarSincronizado } from '../utils/sync.js';

const KEY = 'descuentos-tc-postulaciones';

const ESTADOS = [
  { id: 'postulado', label: 'Postulado', color: 'var(--mint-300)' },
  { id: 'entrevista1', label: '1ª Entrevista', color: 'var(--gold-300)' },
  { id: 'entrevista2', label: '2ª Entrevista', color: 'var(--gold-500)' },
  { id: 'referencias', label: 'Referencias', color: 'var(--gold-500)' },
  { id: 'oferta', label: 'Oferta', color: 'var(--cal-green, var(--mint-300))' },
  { id: 'espera', label: 'En espera', color: 'var(--paper-100)' },
  { id: 'rechazado', label: 'Rechazado', color: 'var(--cal-red, var(--coral-500))' },
];

function getEstado(id) {
  return ESTADOS.find((e) => e.id === id) || ESTADOS[0];
}

const CLAVE_SYNC = 'postulaciones';

function diasHasta(fechaStr) {
  if (!fechaStr) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(`${fechaStr}T00:00:00`);
  return Math.round((fecha - hoy) / (1000 * 60 * 60 * 24));
}

function etiquetaFecha(fechaStr) {
  const dias = diasHasta(fechaStr);
  if (dias === null) return null;
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Mañana';
  if (dias < 0) return `Hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? 's' : ''}`;
  return `En ${dias} días`;
}

export default function JobTrackerWidget() {
  const [postulaciones, setPostulaciones] = useState(() => cargarLocal(KEY, []));

  useEffect(() => {
    let activo = true;
    cargarRemoto(CLAVE_SYNC).then((valorRemoto) => {
      if (activo && Array.isArray(valorRemoto)) setPostulaciones(valorRemoto);
    });
    return () => {
      activo = false;
    };
  }, []);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [empresa, setEmpresa] = useState('');
  const [cargo, setCargo] = useState('');
  const [estado, setEstado] = useState('postulado');
  const [fecha, setFecha] = useState('');
  const [notas, setNotas] = useState('');

  const limpiarForm = () => {
    setEmpresa('');
    setCargo('');
    setEstado('postulado');
    setFecha('');
    setNotas('');
    setMostrarForm(false);
  };

  const agregar = () => {
    if (!empresa.trim() || !cargo.trim()) return;
    const nueva = {
      id: Date.now(),
      empresa: empresa.trim(),
      cargo: cargo.trim(),
      estado,
      fecha: fecha || null,
      notas: notas.trim(),
    };
    const actualizado = [...postulaciones, nueva];
    setPostulaciones(actualizado);
    guardarSincronizado(KEY, CLAVE_SYNC, actualizado);
    limpiarForm();
  };

  const cambiarEstado = (id, nuevoEstado) => {
    const actualizado = postulaciones.map((p) => (p.id === id ? { ...p, estado: nuevoEstado } : p));
    setPostulaciones(actualizado);
    guardarSincronizado(KEY, CLAVE_SYNC, actualizado);
  };

  const cambiarFecha = (id, nuevaFecha) => {
    const actualizado = postulaciones.map((p) => (p.id === id ? { ...p, fecha: nuevaFecha || null } : p));
    setPostulaciones(actualizado);
    guardarSincronizado(KEY, CLAVE_SYNC, actualizado);
  };

  const quitar = (id) => {
    const actualizado = postulaciones.filter((p) => p.id !== id);
    setPostulaciones(actualizado);
    guardarSincronizado(KEY, CLAVE_SYNC, actualizado);
  };

  // Las que tienen fecha próxima van primero (la más cercana arriba); las
  // sin fecha quedan al final, en el orden en que se agregaron.
  const ordenadas = [...postulaciones].sort((a, b) => {
    if (a.fecha && b.fecha) return a.fecha < b.fecha ? -1 : 1;
    if (a.fecha) return -1;
    if (b.fecha) return 1;
    return a.id - b.id;
  });

  return (
    <section style={styles.section}>
      <div style={styles.headerRow}>
        <h2 style={styles.h2}>Seguimiento de Postulaciones</h2>
        <button style={styles.addBtn} onClick={() => setMostrarForm((v) => !v)}>
          {mostrarForm ? 'Cancelar' : '+ Agregar'}
        </button>
      </div>

      {mostrarForm && (
        <div style={styles.form}>
          <div style={styles.formRow}>
            <input
              style={styles.input}
              placeholder="Empresa"
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
            />
            <input
              style={styles.input}
              placeholder="Cargo"
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
            />
          </div>
          <div style={styles.formRow}>
            <select style={styles.input} value={estado} onChange={(e) => setEstado(e.target.value)}>
              {ESTADOS.map((e) => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </select>
            <input
              type="date"
              style={styles.input}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <input
            style={{ ...styles.input, width: '100%', boxSizing: 'border-box' }}
            placeholder="Notas (opcional)"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />
          <button style={styles.guardarBtn} onClick={agregar}>Guardar postulación</button>
        </div>
      )}

      {ordenadas.length === 0 ? (
        <p style={styles.vacio}>Sin postulaciones registradas todavía.</p>
      ) : (
        <div style={styles.lista}>
          {ordenadas.map((p) => {
            const dias = diasHasta(p.fecha);
            const esProximo = dias !== null && dias >= 0 && dias <= 3;
            const infoEstado = getEstado(p.estado);
            return (
              <div
                key={p.id}
                className="card-face-hover"
                style={{ ...styles.card, borderLeft: `4px solid ${esProximo ? 'var(--coral-500)' : infoEstado.color}` }}
              >
                <button style={styles.quitarBtn} onClick={() => quitar(p.id)} title="Quitar">✕</button>
                <p style={styles.empresa}>{p.empresa}</p>
                <p style={styles.cargo}>{p.cargo}</p>
                <div style={styles.filaControles}>
                  <select
                    style={{ ...styles.estadoSelect, color: infoEstado.color }}
                    value={p.estado}
                    onChange={(e) => cambiarEstado(p.id, e.target.value)}
                  >
                    {ESTADOS.map((e) => (
                      <option key={e.id} value={e.id}>{e.label}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    style={styles.fechaInput}
                    value={p.fecha || ''}
                    onChange={(e) => cambiarFecha(p.id, e.target.value)}
                  />
                </div>
                {p.fecha && (
                  <p style={{ ...styles.etiquetaFecha, color: esProximo ? 'var(--coral-500)' : 'inherit' }}>
                    📅 {etiquetaFecha(p.fecha)}
                  </p>
                )}
                {p.notas && <p style={styles.notas}>{p.notas}</p>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

const styles = {
  section: { marginTop: '28px' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  h2: { fontFamily: 'var(--font-display)', fontSize: '2rem', margin: 0, color: 'var(--paper-050)' },
  addBtn: {
    background: 'var(--gold-500)', color: 'var(--navy-950)', border: 'none', borderRadius: '8px',
    padding: '8px 14px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
  },
  form: {
    background: 'var(--navy-900)', border: '1px solid var(--navy-700)', borderRadius: '12px',
    padding: '14px', marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '8px',
  },
  formRow: { display: 'flex', gap: '8px' },
  input: {
    flex: 1, background: 'var(--navy-800)', border: '1px solid var(--navy-700)', borderRadius: '8px',
    padding: '8px 10px', color: 'var(--paper-050)', fontSize: '0.82rem', outline: 'none', fontFamily: 'inherit',
  },
  guardarBtn: {
    background: 'var(--mint-500)', color: 'var(--navy-950)', border: 'none', borderRadius: '8px',
    padding: '9px 14px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', marginTop: '4px',
  },
  vacio: { fontSize: '0.85rem', opacity: 0.55 },
  lista: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px',
  },
  card: {
    position: 'relative', background: 'var(--navy-900)', border: '1px solid var(--navy-700)',
    borderRadius: '10px', padding: '14px 14px 12px',
  },
  quitarBtn: {
    position: 'absolute', top: '10px', right: '10px', background: 'transparent', border: 'none',
    color: 'var(--paper-100)', opacity: 0.4, fontSize: '0.68rem', cursor: 'pointer',
  },
  empresa: { fontSize: '1rem', fontWeight: 700, color: 'var(--paper-050)', margin: '0 22px 1px 0' },
  cargo: { fontSize: '0.78rem', opacity: 0.7, margin: '0 0 10px' },
  filaControles: { display: 'flex', gap: '6px', marginBottom: '6px' },
  estadoSelect: {
    flex: 1, background: 'var(--navy-800)', border: '1px solid var(--navy-700)', borderRadius: '6px',
    padding: '5px 6px', fontSize: '0.72rem', fontWeight: 700, outline: 'none',
  },
  fechaInput: {
    background: 'var(--navy-800)', border: '1px solid var(--navy-700)', borderRadius: '6px',
    padding: '5px 6px', fontSize: '0.72rem', color: 'var(--paper-050)', outline: 'none',
  },
  etiquetaFecha: { fontSize: '0.75rem', fontWeight: 600, margin: '4px 0 0' },
  notas: { fontSize: '0.72rem', opacity: 0.6, margin: '6px 0 0', fontStyle: 'italic' },
};
