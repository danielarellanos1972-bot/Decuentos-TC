import { useEffect, useState } from 'react';

const KEY = 'descuentos-tc-tema';

export default function ThemeToggle() {
  const [tema, setTema] = useState(() => {
    try {
      return localStorage.getItem(KEY) || 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    if (tema === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    try {
      localStorage.setItem(KEY, tema);
    } catch {
      // no crítico si falla, simplemente no se recuerda la próxima vez
    }
  }, [tema]);

  return (
    <button
      onClick={() => setTema((t) => (t === 'dark' ? 'light' : 'dark'))}
      title={tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      style={styles.boton}
    >
      {tema === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}

const styles = {
  boton: {
    position: 'fixed',
    top: '16px',
    right: '16px',
    zIndex: 950,
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    background: 'var(--navy-900)',
    border: '1px solid var(--navy-700)',
    fontSize: '1.1rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
  },
};
