import { CATEGORIAS } from '../data/bancos.js';

export default function CategoryFilter({ seleccionada, onSelect }) {
  return (
    <div style={styles.wrap}>
      {CATEGORIAS.map((cat) => {
        const active = seleccionada?.id === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat)}
            style={{ ...styles.chip, ...(active ? styles.chipActive : {}) }}
          >
            <span aria-hidden="true">{cat.emoji}</span> {cat.label}
          </button>
        );
      })}
    </div>
  );
}

const styles = {
  wrap: { display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '18px' },
  chip: {
    flexShrink: 0, background: 'var(--navy-800)', border: '1px solid var(--navy-700)',
    color: 'var(--paper-100)', borderRadius: '999px', padding: '8px 14px', fontSize: '0.85rem',
    whiteSpace: 'nowrap',
  },
  chipActive: {
    background: 'var(--mint-500)', borderColor: 'var(--mint-500)', color: 'var(--navy-950)', fontWeight: 700,
  },
};
