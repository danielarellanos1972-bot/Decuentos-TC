import { useEffect, useState } from 'react';

function useRates() {
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let activo = true;
    fetch('/api/market-data')
      .then((r) => r.json())
      .then((d) => {
        if (!activo) return;
        if (d.error) setError(d.error);
        else setRates(d);
      })
      .catch(() => activo && setError('No se pudo conectar.'))
      .finally(() => activo && setLoading(false));
    return () => {
      activo = false;
    };
  }, []);

  return { rates, loading, error };
}

const MONEDAS = [
  { key: 'clp', label: 'Peso Chileno (CLP)', flag: '🇨🇱' },
  { key: 'uf', label: 'UF', flag: '🇨🇱' },
  { key: 'utm', label: 'UTM', flag: '🇨🇱' },
  { key: 'usd', label: 'Dólar (USD)', flag: '🇺🇸' },
  { key: 'eur', label: 'Euro (EUR)', flag: '🇪🇺' },
  { key: 'cad', label: 'Dólar Can. (CAD)', flag: '🇨🇦' },
];

function getValorEnClp(rates, key) {
  if (key === 'clp') return 1;
  return rates?.[key]?.valor ?? null;
}

const fmt = (n) => (n == null ? '—' : n.toLocaleString('es-CL', { maximumFractionDigits: 2 }));

export default function Calculator() {
  const { rates, loading, error } = useRates();
  const [monto, setMonto] = useState('1');
  const [desde, setDesde] = useState('clp');

  const montoNum = parseFloat(String(monto).replace(',', '.')) || 0;
  const valorDesdeEnClp = getValorEnClp(rates, desde);
  const montoEnClp = valorDesdeEnClp != null ? montoNum * valorDesdeEnClp : null;

  return (
    <section style={styles.section}>
      <h2 style={styles.h2}>Calculadora de Monedas</h2>
      {loading && <p style={styles.loadingText}>Cargando valores…</p>}
      {error && <p style={styles.errorText}>{error}</p>}
      {rates && (
        <>
          <div style={styles.inputRow}>
            <input
              style={styles.amountInput}
              type="text"
              inputMode="decimal"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
            <select style={styles.select} value={desde} onChange={(e) => setDesde(e.target.value)}>
              {MONEDAS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.flag} {m.label}
                </option>
              ))}
            </select>
          </div>
          <div style={styles.resultsGrid}>
            {MONEDAS.filter((m) => m.key !== desde).map((m) => {
              const valorEnClp = getValorEnClp(rates, m.key);
              const resultado = montoEnClp != null && valorEnClp ? montoEnClp / valorEnClp : null;
              return (
                <div key={m.key} style={styles.resultCard}>
                  <p style={styles.resultLabel}>
                    <span style={{ fontSize: '1.4em' }}>{m.flag}</span> {m.label}
                  </p>
                  <p style={styles.resultValue}>{fmt(resultado)}</p>
                </div>
              );
            })}
          </div>
        </>
      )}
      <p style={styles.fuente}>Valores en tiempo real desde el panel "Hoy". CAD y EUR son referenciales.</p>
    </section>
  );
}

const styles = {
  section: { marginTop: '32px' },
  h2: { fontFamily: 'var(--font-display)', fontSize: '2rem', margin: '0 0 8px', color: 'var(--paper-050)' },
  loadingText: { fontSize: '0.85rem', opacity: 0.6, margin: 0 },
  errorText: { fontSize: '0.85rem', color: 'var(--coral-500)', margin: 0 },
  inputRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
  },
  amountInput: {
    flex: 1,
    background: 'var(--navy-900)',
    border: '1px solid var(--navy-700)',
    borderRadius: '10px',
    padding: '11px 12px',
    color: 'var(--paper-050)',
    fontSize: '1rem',
    fontFamily: 'var(--font-mono)',
    outline: 'none',
    minWidth: 0,
  },
  select: {
    background: 'var(--navy-900)',
    border: '1px solid var(--navy-700)',
    borderRadius: '10px',
    padding: '11px 8px',
    color: 'var(--paper-050)',
    fontSize: '0.85rem',
    outline: 'none',
    maxWidth: '46%',
  },
  resultsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
  },
  resultCard: {
    background: 'var(--navy-900)',
    border: '1px solid var(--navy-700)',
    borderRadius: '10px',
    padding: '10px 12px',
  },
  resultLabel: {
    fontSize: '0.68rem',
    opacity: 0.65,
    margin: '0 0 3px',
  },
  resultValue: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.95rem',
    fontWeight: 700,
    color: 'var(--gold-300)',
    margin: 0,
  },
  fuente: {
    fontSize: '0.65rem',
    opacity: 0.45,
    margin: '10px 0 0',
  },
};
