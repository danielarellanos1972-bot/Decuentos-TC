import { useState } from 'react';
import { BANCOS_CHILE } from '../data/bancos.js';

// Datos fijos que se muestran en el frente de cada tarjeta (nunca datos reales).
const HOLDER_NAME = 'DANIEL ARELLANO SAAVEDRA';
const MASKED_NUMBER = 'XXXX  XXXX  XXXX  XXXX';

// Determina qué "piel" visual usar según banco + nombre de la tarjeta,
// para que cada una se parezca a su plástico real.
function getCardSkin(banco, nombre = '') {
  const n = nombre.toLowerCase();
  switch (banco) {
    case 'Scotiabank':
      return /singular/.test(n) ? 'scotiabank-singular' : 'scotiabank-navy';
    case 'Banco de Chile / Edwards':
      return /infinite/.test(n) ? 'chile-infinite' : 'chile-default';
    case 'Santander':
      return /amex|limited|world\s?member/.test(n) ? 'santander-limited' : 'santander-red';
    case 'Itaú':
      return /black/.test(n) ? 'itau-black' : 'itau-default';
    case 'BancoEstado': return 'bancoestado';
    case 'BCI': return 'bci';
    case 'Falabella (CMR)':
    case 'Banco Falabella': return 'falabella';
    case 'Ripley': return 'ripley';
    case 'Banco Security': return 'security';
    case 'Banco Consorcio': return 'consorcio';
    case 'Coopeuch': return 'coopeuch';
    case 'Tenpo': return 'tenpo';
    case 'Mach (Banco BICE)': return 'mach';
    default: return 'generic';
  }
}

const SKINS = {
  'scotiabank-singular': {
    background: 'linear-gradient(135deg, #dcdcdc 0%, #b3b3b3 35%, #6e6e6e 75%, #4a4a4a 100%)',
    pattern: 'brushed',
    text: '#FFFFFF',
    chip: 'linear-gradient(135deg,#eeeeee,#a8a8a8)',
    network: 'VISA',
    productLabel: 'Infinite',
    script: { title: 'Singular', subtitle: 'by Scotiabank' },
  },
  'scotiabank-navy': {
    background: 'linear-gradient(140deg, #123A5E 0%, #0B1F4D 55%, #050D26 100%)',
    pattern: 'dots-ring',
    text: '#D7E3F0',
    chip: 'linear-gradient(135deg,#eeeeee,#a8a8a8)',
    network: 'VISA',
    logo: 'Scotiabank',
  },
  'chile-infinite': {
    background: 'linear-gradient(145deg, #1c1c1c 0%, #0a0a0a 70%, #000000 100%)',
    pattern: 'diagonal-gold',
    text: '#D4AF37',
    chip: 'linear-gradient(135deg,#f0d798,#c9a227)',
    network: 'VISA',
    productLabel: 'Infinite',
    logo: 'Banco de Chile',
    logoFont: 'serif',
  },
  'chile-default': {
    background: 'linear-gradient(140deg, #0060A9 0%, #004A93 55%, #00284F 100%)',
    text: '#FFFFFF',
    chip: 'linear-gradient(135deg,#eeeeee,#a8a8a8)',
    network: 'VISA',
    logo: 'Banco de Chile',
  },
  'santander-limited': {
    background: 'radial-gradient(circle at 30% 20%, #2b2b2b 0%, #101010 55%, #000000 100%)',
    pattern: 'pebble',
    text: '#D4AF37',
    chip: 'linear-gradient(135deg,#f0d798,#c9a227)',
    network: 'AMEX',
    badge: 'LATAM PASS',
    logo: 'Santander',
    script: { title: 'World Member', subtitle: 'Limited' },
    border: '1px solid #8a6d1f',
  },
  'santander-red': {
    background: 'linear-gradient(140deg, #EC0000 0%, #B30000 60%, #8C0000 100%)',
    text: '#FFFFFF',
    chip: 'linear-gradient(135deg,#eeeeee,#a8a8a8)',
    network: 'VISA',
    logo: 'Santander',
  },
  'itau-black': {
    background: 'linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 60%, #000000 100%)',
    pattern: 'ribbed',
    text: '#FFFFFF',
    chip: 'linear-gradient(135deg,#eeeeee,#a8a8a8)',
    accent: '#FF7900',
    brandMark: 'itau',
  },
  'itau-default': {
    background: 'linear-gradient(140deg, #FF7900 0%, #E0590E 40%, #0033A0 100%)',
    text: '#FFFFFF',
    brandMark: 'itau',
  },
  bancoestado: { background: 'linear-gradient(140deg,#FF7A00,#B34F00)', text: '#FFFFFF', network: 'VISA', logo: 'BancoEstado' },
  bci: { background: 'linear-gradient(140deg,#F5821F,#A6560F)', text: '#FFFFFF', network: 'VISA', logo: 'BCI' },
  falabella: { background: 'linear-gradient(140deg,#78BE21,#3F6B10)', text: '#FFFFFF', network: 'MASTERCARD', logo: 'Falabella' },
  ripley: { background: 'linear-gradient(140deg,#E4007C,#8C004D)', text: '#FFFFFF', network: 'MASTERCARD', logo: 'Ripley' },
  security: { background: 'linear-gradient(140deg,#0B3B5C,#041C2C)', text: '#E8C583', network: 'VISA', logo: 'Security' },
  consorcio: { background: 'linear-gradient(140deg,#00594C,#00302A)', text: '#E8C583', network: 'VISA', logo: 'Consorcio' },
  coopeuch: { background: 'linear-gradient(140deg,#0057A0,#00365F)', text: '#FFFFFF', network: 'VISA', logo: 'Coopeuch' },
  tenpo: { background: 'linear-gradient(140deg,#7B2FF7,#4A1594)', text: '#FFFFFF', network: 'VISA', logo: 'Tenpo' },
  mach: { background: 'linear-gradient(140deg,#00E58A,#00A566)', text: '#0A1F1A', network: 'VISA', logo: 'Mach' },
  generic: { background: 'linear-gradient(140deg,#204B6B,#163A52)', text: '#F4EFE6', network: 'VISA', logo: null },
};

function CardPattern({ type }) {
  if (type === 'brushed') {
    return (
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.5, mixBlendMode: 'overlay',
        background: 'repeating-linear-gradient(115deg, rgba(255,255,255,0.22) 0px, rgba(255,255,255,0.22) 1px, transparent 1px, transparent 4px)',
      }} />
    );
  }
  if (type === 'dots-ring') {
    return (
      <svg viewBox="0 0 200 200" style={{ position: 'absolute', top: '-35px', right: '-45px', width: '170px', height: '170px', opacity: 0.55 }}>
        <circle cx="70" cy="100" r="52" fill="none" stroke="#5EA8E0" strokeWidth="4" strokeDasharray="2 7" strokeLinecap="round" />
        <circle cx="128" cy="100" r="52" fill="none" stroke="#5EA8E0" strokeWidth="4" strokeDasharray="2 7" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === 'diagonal-gold') {
    return (
      <>
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.15,
          background: 'repeating-linear-gradient(60deg, rgba(212,175,55,0.5) 0px, rgba(212,175,55,0.5) 1px, transparent 1px, transparent 6px)',
        }} />
        <div style={{ position: 'absolute', right: '-35px', bottom: '-35px', width: '150px', height: '150px', borderRadius: '50%', border: '2px solid rgba(212,175,55,0.25)' }} />
      </>
    );
  }
  if (type === 'pebble') {
    return (
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.6,
        backgroundImage:
          'radial-gradient(circle at 18% 28%, rgba(255,255,255,0.10) 0 6px, transparent 7px),' +
          'radial-gradient(circle at 46% 62%, rgba(255,255,255,0.08) 0 8px, transparent 9px),' +
          'radial-gradient(circle at 72% 22%, rgba(255,255,255,0.10) 0 5px, transparent 6px),' +
          'radial-gradient(circle at 86% 72%, rgba(255,255,255,0.08) 0 7px, transparent 8px),' +
          'radial-gradient(circle at 30% 86%, rgba(255,255,255,0.09) 0 6px, transparent 7px)',
      }} />
    );
  }
  if (type === 'ribbed') {
    return (
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.5,
        background: 'repeating-linear-gradient(70deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 2px, transparent 2px, transparent 7px)',
      }} />
    );
  }
  return null;
}

function Chip({ gradient }) {
  return (
    <div style={{ width: '28px', height: '20px', borderRadius: '5px', background: gradient, position: 'relative', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.3)', flexShrink: 0 }}>
      <div style={{ position: 'absolute', inset: '3px', border: '1px solid rgba(0,0,0,0.35)', borderRadius: '2px' }} />
      <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'rgba(0,0,0,0.3)' }} />
      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', background: 'rgba(0,0,0,0.3)' }} />
    </div>
  );
}

function Contactless({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginLeft: '4px', flexShrink: 0 }}>
      <path d="M8 4a12 12 0 0 1 0 16" stroke={color} strokeWidth="2.4" strokeLinecap="round" opacity="0.9" />
      <path d="M5 7a8 8 0 0 1 0 10" stroke={color} strokeWidth="2.4" strokeLinecap="round" opacity="0.7" />
      <path d="M2 10a4 4 0 0 1 0 4" stroke={color} strokeWidth="2.4" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

function NetworkMark({ network, color }) {
  if (network === 'VISA') {
    return <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontWeight: 800, fontSize: '0.92rem', letterSpacing: '0.3px', color }}>VISA</span>;
  }
  if (network === 'MASTERCARD') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
        <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#EB001B', opacity: 0.92 }} />
        <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#F79E1B', opacity: 0.92, marginLeft: '-6px' }} />
      </span>
    );
  }
  if (network === 'AMEX') {
    return (
      <span style={{ fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.03em', color, border: `1px solid ${color}`, borderRadius: '2px', padding: '2px 5px', display: 'inline-block' }}>AMEX</span>
    );
  }
  return null;
}

function CardFace({ t, isActive, onSelect, onDelete }) {
  const skinKey = getCardSkin(t.banco, t.nombre);
  const skin = SKINS[skinKey] || SKINS.generic;

  return (
    <div
      className="card-face-hover"
      onClick={() => onSelect(t)}
      style={{
        position: 'relative',
        aspectRatio: '1.586',
        borderRadius: '16px',
        overflow: 'hidden',
        background: skin.background,
        color: skin.text,
        cursor: 'pointer',
        border: skin.border || '1px solid rgba(255,255,255,0.14)',
        boxShadow: isActive
          ? '0 0 0 3px var(--gold-500), 0 10px 22px rgba(0,0,0,0.4)'
          : '0 6px 14px rgba(0,0,0,0.32)',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
    >
      <CardPattern type={skin.pattern} />

      <button
        onClick={(e) => { e.stopPropagation(); onDelete(t.id); }}
        style={{
          position: 'absolute', top: '4px', right: '4px', zIndex: 2,
          background: 'rgba(0,0,0,0.35)', border: 'none', color: skin.text,
          borderRadius: '50%', width: '18px', height: '18px', fontSize: '0.85rem',
          lineHeight: 1, opacity: 0.75, padding: 0,
        }}
        aria-label={`Eliminar ${t.nombre}`}
      >
        ×
      </button>

      {/* Fila superior: logo/badge del banco + chip */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          {skin.badge && (
            <div style={{ fontSize: '0.52rem', fontWeight: 700, letterSpacing: '0.06em', opacity: 0.85, marginBottom: '2px' }}>
              {skin.badge}
            </div>
          )}
          {skin.logo && (
            <div style={{
              fontFamily: skin.logoFont === 'serif' ? 'Georgia, serif' : 'var(--font-body)',
              fontWeight: 800, fontSize: '0.8rem',
            }}>
              {skin.logo}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Chip gradient={skin.chip} />
          <Contactless color={skin.text} />
        </div>
      </div>

      {/* Centro: script tipo "Singular" / "World Member Limited" */}
      {skin.script && (
        <div style={{ position: 'relative', zIndex: 1, textAlign: skinKey === 'scotiabank-singular' ? 'center' : 'left' }}>
          <div style={{ fontFamily: "'Brush Script MT','Segoe Script', cursive", fontSize: skinKey === 'scotiabank-singular' ? '1.4rem' : '0.98rem', lineHeight: 1.1 }}>
            {skin.script.title}
          </div>
          <div style={{ fontSize: '0.58rem', opacity: 0.85, marginTop: '2px' }}>{skin.script.subtitle}</div>
        </div>
      )}

      {/* Número enmascarado */}
      <div style={{ position: 'relative', zIndex: 1, fontFamily: 'var(--font-mono)', fontSize: '0.7rem', letterSpacing: '0.08em', opacity: 0.92 }}>
        {MASKED_NUMBER}
      </div>

      {/* Fila inferior: titular + red/marca */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ minWidth: 0, maxWidth: '62%' }}>
          <div style={{ fontSize: '0.56rem', fontWeight: 600, letterSpacing: '0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{HOLDER_NAME}</div>
          <div style={{ fontSize: '0.5rem', opacity: 0.75, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.nombre}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '4px' }}>
          {skin.brandMark === 'itau' ? (
            <div style={{ background: '#fff', color: '#111', fontWeight: 800, fontSize: '0.58rem', padding: '3px 6px', borderRadius: '3px', display: 'inline-block' }}>
              itaú
            </div>
          ) : (
            <>
              <NetworkMark network={skin.network} color={skin.text} />
              {skin.productLabel && <div style={{ fontSize: '0.5rem', opacity: 0.85, marginTop: '2px' }}>{skin.productLabel}</div>}
            </>
          )}
        </div>
      </div>

      {skin.accent && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '4px', background: skin.accent }} />}
    </div>
  );
}

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
        <h2 style={styles.h2}>Mis Tarjetas</h2>
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
        {tarjetas.map((t) => (
          <CardFace
            key={t.id}
            t={t}
            isActive={seleccionada?.id === t.id}
            onSelect={onSelect}
            onDelete={onDelete}
          />
        ))}
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
    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px',
  },
  empty: { color: 'var(--paper-100)', opacity: 0.6, fontSize: '0.9rem' },
};
