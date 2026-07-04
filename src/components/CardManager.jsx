import { useState } from 'react';
import { BANCOS_CHILE, getBankColors } from '../data/bancos.js';

export default function CardManager({ tarjetas, onAdd, onDelete, seleccionada, onSelect }) {
  const [showForm, setShowForm] = useState(false);
  const [banco, setBanco] = useState(BANCOS_CHILE[0]);
  const [nombre, setNombre] = useState('');

  const handleAdd = () => {
    if (!nombre.trim()) return;
    onAdd({ id: `card-${Date.now()}`, banco, nombre: nombre.trim(), tipo: 'Crédito' });
    setNombre('');
    setShowForm(false);
  };

  return (
    <section style={styles.wrap}>
      <div style={styles.headerRow}>
        <h2 style={styles.h2}>Mis tarjetas</h2>
        <button style={styles.addBtn} onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancelar' : '+ Agregar tarjeta'}
        </button>
      </div>

      {showForm && (
        <div style={styles.form}>
          <select style={styles.select} value={banco} onChange={(e) => setBanco(e.target.value)}>
            {BANCOS_CHILE.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <input
            style={styles.input}
            placeholder="Nombre de la tarjeta (ej: Mastercard Black)"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <button style={styles.saveBtn} onClick={handleAdd}>Guardar tarjeta</button>
        </div>
      )}

      <div style={styles.grid}>
        {tarjetas.length === 0 && (
          <p style={styles.empty}>Aún no tienes tarjetas cargadas. Agrega la primera arriba.</p>
        )}
        {tarjetas.map((t) => {
          const isActive = seleccionada?.id === t.id;
          const colores = getBankColors(t.banco, t.nombre);
          const cardStyle = {
            ...styles.card,
            background: `linear-gradient(135deg, ${colores.from}, ${colores.to})`,
            color: colores.text,
            ...(isActive ? styles.cardActive : {}),
          };
          return (
            <div
              key={t.id}
              onClick={() => onSelect(t)}
              style={cardStyle}
            >
              <div style={styles.cardScrim} />
              <div style={styles.cardTop}>
                <span style={{ ...styles.chip, background: `${colores.text}` }} />
                <button
                  style={{ ...styles.deleteBtn, color: colores.text }}
                  onClick={(e) => { e.stopPropagation(); onDelete(t.id); }}
                  aria-label={`Eliminar ${t.nombre}`}
                >
                  ×
                </button>
              </div>
              <p style={{ ...styles.cardBanco, color: colores.text }}>{t.banco}</p>
              <p style={{ ...styles.cardNombre, color: colores.text }}>{t.nombre}</p>
              {colores.accent && (
                <div style={{ ...styles.cardAccent, background: colores.accent }} />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const styles = {
  wrap: { marginBottom: '28px' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' },
  h2: { fontFamily: 'var(--font-display)', fontSize: '1.15rem', margin: 0, color: 'var(--paper-100)' },
  addBtn: {
    background: 'transparent', border: '1px solid var(--gold-500)', color: 'var(--gold-300)',
    borderRadius: '999px', padding: '6px 14px', fontSize: '0.85rem', fontWeight: 600,
  },
  form: {
    display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--navy-800)',
    padding: '14px', borderRadius: '12px', marginBottom: '14px',
  },
  select: {
    background: 'var(--navy-900)', color: 'var(--paper-100)', border: '1px solid var(--navy-700)',
    borderRadius: '8px', padding: '10px', fontSize: '0.95rem',
  },
  input: {
    background: 'var(--navy-900)', color: 'var(--paper-100)', border: '1px solid var(--navy-700)',
    borderRadius: '8px', padding: '10px', fontSize: '0.95rem',
  },
  saveBtn: {
    background: 'var(--gold-500)', color: 'var(--navy-950)', border: 'none',
    borderRadius: '8px', padding: '10px', fontWeight: 700,
  },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px',
  },
  empty: { color: 'var(--paper-100)', opacity: 0.6, fontSize: '0.9rem' },
  card: {
    border: '1px solid rgba(255,255,255,0.15)', borderRadius: '14px', padding: '14px',
    cursor: 'pointer', position: 'relative', transition: 'transform 0.15s, box-shadow 0.15s',
    minHeight: '86px', overflow: 'hidden',
  },
  cardActive: {
    boxShadow: '0 0 0 2px var(--gold-500)',
  },
  cardScrim: {
    position: 'absolute', inset: 0,
    background: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.25) 100%)',
    pointerEvents: 'none',
  },
  cardAccent: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: '4px',
  },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', position: 'relative' },
  chip: {
    width: '22px', height: '16px', borderRadius: '3px', opacity: 0.85,
    display: 'inline-block',
  },
  deleteBtn: {
    background: 'none', border: 'none', opacity: 0.7,
    fontSize: '1.1rem', lineHeight: 1, padding: '0 4px',
  },
  cardBanco: { fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.85, margin: '0 0 2px', position: 'relative' },
  cardNombre: { fontSize: '0.92rem', fontWeight: 700, margin: 0, position: 'relative' },
};
