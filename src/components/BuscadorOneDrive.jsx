import { useState } from 'react';
import { createPortal } from 'react-dom';

export default function BuscadorOneDrive() {
  const [modo, setModo] = useState('buscar'); // 'buscar' | 'preguntar-documentos' | 'preguntar-correos' | 'preguntar-agenda' | 'comparar'
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState(null);
  const [avisoIncompleto, setAvisoIncompleto] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState(null);
  const [archivoAnalisis, setArchivoAnalisis] = useState(null);

  const [pregunta, setPregunta] = useState('');
  const [respuestaRag, setRespuestaRag] = useState(null);
  const [fuentesRag, setFuentesRag] = useState(null);
  const [avisoRag, setAvisoRag] = useState(null);
  const [diagnosticoAgenda, setDiagnosticoAgenda] = useState(null);
  const [correoExpandido, setCorreoExpandido] = useState(null);
  const [preguntando, setPreguntando] = useState(false);
  const [errorRag, setErrorRag] = useState(null);

  const [aviso, setAviso] = useState('');
  const [filtroArchivo, setFiltroArchivo] = useState('');
  const [archivoSubido, setArchivoSubido] = useState(null); // { nombre, base64 }
  const [leyendoArchivo, setLeyendoArchivo] = useState(false);
  const [evaluacionCV, setEvaluacionCV] = useState(null);
  const [cvsUsados, setCvsUsados] = useState(null);
  const [comparando, setComparando] = useState(false);
  const [errorCV, setErrorCV] = useState(null);

  function elegirArchivo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLeyendoArchivo(true);
    const lector = new FileReader();
    lector.onload = () => {
      // El resultado viene como "data:<mime>;base64,AAAA..." — solo se
      // necesita la parte de después de la coma.
      const base64 = String(lector.result).split(',')[1] || '';
      setArchivoSubido({ nombre: file.name, base64 });
      setLeyendoArchivo(false);
    };
    lector.onerror = () => {
      setErrorCV('No se pudo leer ese archivo.');
      setLeyendoArchivo(false);
    };
    lector.readAsDataURL(file);
  }

  function compararCV(e) {
    e.preventDefault();
    const texto = aviso.trim();
    if (!texto) return;
    setComparando(true);
    setErrorCV(null);
    setEvaluacionCV(null);
    setCvsUsados(null);
    fetch('/api/unread-mail?tipo=onedrive-comparar-cv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        archivoSubido
          ? { aviso: texto, archivoBase64: archivoSubido.base64, archivoNombre: archivoSubido.nombre }
          : { aviso: texto, filtro: filtroArchivo.trim() }
      ),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setErrorCV(d.error);
        else {
          setEvaluacionCV(d.evaluacion);
          setCvsUsados(d.cvs || []);
        }
      })
      .catch(() => setErrorCV('No se pudo comparar los CV.'))
      .finally(() => setComparando(false));
  }

  function preguntar(e) {
    e.preventDefault();
    const texto = pregunta.trim();
    if (!texto) return;
    setPreguntando(true);
    setErrorRag(null);
    setRespuestaRag(null);
    setFuentesRag(null);
    setAvisoRag(null);
    setDiagnosticoAgenda(null);
    const fuente = modo === 'preguntar-documentos' ? 'documentos' : modo === 'preguntar-correos' ? 'correos' : modo === 'preguntar-agenda' ? 'agenda' : 'todos';
    fetch(`/api/unread-mail?tipo=onedrive-preguntar&fuente=${fuente}&q=${encodeURIComponent(texto)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setErrorRag(d.error);
        else {
          setRespuestaRag(d.respuesta);
          setFuentesRag(d.fuentes || []);
          setAvisoRag(d.avisoRespaldo || null);
          setDiagnosticoAgenda(d.diagnosticoAgenda || null);
        }
      })
      .catch(() => setErrorRag('No se pudo generar la respuesta.'))
      .finally(() => setPreguntando(false));
  }

  function buscar(e) {
    e.preventDefault();
    const termino = q.trim();
    if (!termino) return;
    setBuscando(true);
    setError(null);
    setResultados(null);
    setAvisoIncompleto(null);
    fetch(`/api/unread-mail?tipo=onedrive&q=${encodeURIComponent(termino)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else {
          setResultados(d.resultados);
          setAvisoIncompleto(d.avisoIncompleto || null);
        }
      })
      .catch(() => setError('No se pudo buscar en OneDrive.'))
      .finally(() => setBuscando(false));
  }

  function analizar(r) {
    setArchivoAnalisis({ nombre: r.nombre, tipoIcono: r.tipoIcono, tipoColor: r.tipoColor, cargando: true });
    fetch(`/api/unread-mail?tipo=onedrive-analisis&id=${encodeURIComponent(r.id)}`)
      .then((res) => res.json())
      .then((d) => {
        if (d.error) {
          setArchivoAnalisis((prev) => ({ ...prev, cargando: false, error: d.error }));
        } else {
          setArchivoAnalisis((prev) => ({ ...prev, cargando: false, ...d }));
        }
      })
      .catch(() => setArchivoAnalisis((prev) => ({ ...prev, cargando: false, error: 'No se pudo analizar el archivo.' })));
  }

  function formatearFecha(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return '';
    }
  }

  return (
    <section style={styles.section}>
      <h2 style={styles.h2}>Buscar en OneDrive</h2>
      <p style={styles.sub}>
        {modo === 'buscar' && 'Por nombre de archivo (con o sin extensión) o por palabras dentro del documento.'}
        {modo === 'preguntar-documentos' && 'Hazle una pregunta a tus documentos de OneDrive.'}
        {modo === 'preguntar-correos' && 'Hazle una pregunta a tus correos (Gmail y Outlook).'}
        {modo === 'preguntar-agenda' && 'Hazle una pregunta a tu agenda (Google y Outlook Calendar).'}
        {modo === 'comparar' && 'Pega un aviso de trabajo y te digo cuál de tus versiones de CV calza mejor.'}
      </p>

      <div style={styles.toggleFila}>
        <button
          style={{ ...styles.toggleBoton, ...(modo === 'buscar' ? styles.toggleBotonActivo : {}) }}
          onClick={() => setModo('buscar')}
        >
          🔍 Buscar archivos
        </button>
        <button
          style={{ ...styles.toggleBoton, ...(modo === 'preguntar-documentos' ? styles.toggleBotonActivo : {}) }}
          onClick={() => setModo('preguntar-documentos')}
        >
          📄 Preguntar documentos
        </button>
        <button
          style={{ ...styles.toggleBoton, ...(modo === 'preguntar-correos' ? styles.toggleBotonActivo : {}) }}
          onClick={() => setModo('preguntar-correos')}
        >
          ✉️ Preguntar correos
        </button>
        <button
          style={{ ...styles.toggleBoton, ...(modo === 'preguntar-agenda' ? styles.toggleBotonActivo : {}) }}
          onClick={() => setModo('preguntar-agenda')}
        >
          📅 Preguntar agenda
        </button>
        <button
          style={{ ...styles.toggleBoton, ...(modo === 'comparar' ? styles.toggleBotonActivo : {}) }}
          onClick={() => setModo('comparar')}
        >
          🎯 Comparar CV con un aviso
        </button>
      </div>

      {modo === 'buscar' && (
      <>
      <form style={styles.formFila} onSubmit={buscar}>
        <input
          style={styles.input}
          type="text"
          placeholder="ej: presupuesto 2026, informe.docx, contrato..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button style={styles.botonBuscar} type="submit" disabled={buscando}>
          {buscando ? 'Buscando…' : '🔍 Buscar'}
        </button>
      </form>

      {error && <p style={styles.error}>{error}</p>}

      {resultados && (
        <div style={styles.resultadosWrap}>
          <div style={styles.contadorFila}>
            <p style={styles.contador}>
              {resultados.length === 0 ? 'Sin resultados.' : `${resultados.length} resultado${resultados.length === 1 ? '' : 's'}`}
            </p>
            <button style={styles.botonCerrarResultados} onClick={() => setResultados(null)}>✕ Cerrar resultados</button>
          </div>
          {avisoIncompleto && <p style={styles.ragAviso}>⚠️ {avisoIncompleto}</p>}
          {resultados.map((r, i) => (
            <div key={i} style={styles.fila}>
              <span style={{ ...styles.icono, background: r.tipoColor }}>{r.tipoIcono}</span>
              <span style={styles.filaTexto}>
                <span style={styles.nombre}>{r.nombre}</span>
                <span style={styles.meta}>
                  <span style={{ ...styles.etiqueta, color: r.tipoColor }}>{r.tipoEtiqueta}</span>
                  {r.carpeta && <span> · {r.carpeta}</span>}
                  {r.tamano && <span> · {r.tamano}</span>}
                  {r.modificado && <span> · {formatearFecha(r.modificado)}</span>}
                </span>
              </span>
              {r.analizable && (
                <button style={styles.botonAnalisis} onClick={() => analizar(r)}>¿Análisis?</button>
              )}
              <a href={r.webUrl} target="_blank" rel="noreferrer" style={styles.abrir}>Abrir ↗</a>
            </div>
          ))}
        </div>
      )}
      </>
      )}

      {(modo === 'preguntar-documentos' || modo === 'preguntar-correos' || modo === 'preguntar-agenda') && (
        <>
        <form style={styles.formFila} onSubmit={preguntar}>
          <input
            style={styles.input}
            type="text"
            placeholder="ej: ¿qué contratos vencen este año?, resume los CV recibidos..."
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
          />
          <button style={styles.botonBuscar} type="submit" disabled={preguntando}>
            {preguntando ? 'Pensando…' : '💬 Preguntar'}
          </button>
        </form>

        {errorRag && <p style={styles.error}>{errorRag}</p>}

        {respuestaRag && (
          <div style={styles.ragCaja}>
            <div style={styles.contadorFila}>
              <p style={styles.contador}>Respuesta</p>
              <button style={styles.botonCerrarResultados} onClick={() => { setRespuestaRag(null); setFuentesRag(null); }}>✕ Cerrar</button>
            </div>
            {avisoRag && <p style={styles.ragAviso}>⚠️ {avisoRag}</p>}
            {respuestaRag.split('\n').filter(Boolean).map((linea, i) => (
              <p key={i} style={styles.ragLinea}>{linea}</p>
            ))}
            {fuentesRag && fuentesRag.length > 0 && (
              <div style={styles.ragFuentes}>
                <p style={styles.modalSeccion}>Fuentes</p>
                {fuentesRag.map((f, i) => {
                  if (f.tipo === 'Correo') {
                    const expandido = correoExpandido === i;
                    return (
                      <div key={i} style={styles.tarjetaCorreo} onClick={() => setCorreoExpandido(expandido ? null : i)}>
                        <div style={styles.tarjetaFilaCorreo}>
                          <span style={styles.tarjetaHoraCorreo}>{f.fecha || ''}</span>
                          <span style={{ ...styles.insigniaCorreo, ...(f.origen === 'Outlook' ? styles.insigniaOutlookCorreo : styles.insigniaGmailCorreo) }}>
                            {f.origen}
                          </span>
                        </div>
                        <p style={styles.tarjetaAsuntoCorreo}>{f.asunto || f.nombre}</p>
                        {f.de && <p style={styles.tarjetaDeCorreo}>{f.de}</p>}
                        {expandido && f.cuerpo && (
                          <p style={styles.tarjetaCuerpoCorreo}>{f.cuerpo}</p>
                        )}
                        {f.webUrl && expandido && (
                          <a href={f.webUrl} target="_blank" rel="noreferrer" style={styles.tarjetaAbrirCorreo} onClick={(e) => e.stopPropagation()}>
                            Abrir correo completo ↗
                          </a>
                        )}
                        <p style={styles.tarjetaTogglePista}>{expandido ? '▲ Ocultar' : '▼ Ver contenido'}</p>
                      </div>
                    );
                  }
                  const icono = f.tipo === 'Agenda' ? '📅' : '📄';
                  const etiqueta = f.tipo && f.origen ? `${icono} [${f.tipo} · ${f.origen}] ${f.nombre}` : `${icono} ${f.nombre}`;
                  return f.webUrl ? (
                    <a key={i} href={f.webUrl} target="_blank" rel="noreferrer" style={styles.ragFuenteItem}>
                      {etiqueta} ↗
                    </a>
                  ) : (
                    <p key={i} style={styles.ragFuenteItem}>{etiqueta}</p>
                  );
                })}
              </div>
            )}
            {diagnosticoAgenda && (
              <p style={styles.ragDiagnostico}>
                🔧 Agenda — Google: {diagnosticoAgenda.google} · Outlook: {diagnosticoAgenda.outlook}
              </p>
            )}
          </div>
        )}
        </>
      )}

      {modo === 'comparar' && (
        <>
        <div style={styles.subirFila}>
          <label style={styles.botonSubir}>
            {leyendoArchivo ? 'Leyendo…' : archivoSubido ? `📎 ${archivoSubido.nombre}` : '📎 Subir archivo desde mi computador'}
            <input
              type="file"
              accept=".docx,.pdf,.txt,.csv,.xlsx,.xls"
              onChange={elegirArchivo}
              style={styles.inputArchivoOculto}
            />
          </label>
          {archivoSubido && (
            <button style={styles.botonQuitarArchivo} onClick={() => setArchivoSubido(null)}>✕ Quitar</button>
          )}
        </div>

        {!archivoSubido && (
          <>
          <form style={styles.formFila} onSubmit={compararCV}>
            <input
              style={styles.input}
              type="text"
              placeholder="O escribe el nombre del archivo en OneDrive (opcional) — ej: CV_Daniel_Arellano_Gerente_Operaciones"
              value={filtroArchivo}
              onChange={(e) => setFiltroArchivo(e.target.value)}
            />
          </form>
          <p style={styles.subCampo}>
            Déjalo vacío para que busque automáticamente entre tus archivos que parecen CV en OneDrive. Si escribes algo, solo compara los archivos cuyo nombre lo contenga.
          </p>
          </>
        )}

        <form style={styles.formFila} onSubmit={compararCV}>
          <textarea
            style={styles.textarea}
            placeholder="Pega aquí el texto del aviso de trabajo (cargo, requisitos, descripción)..."
            value={aviso}
            onChange={(e) => setAviso(e.target.value)}
            rows={5}
          />
        </form>
        <button style={styles.botonBuscar} onClick={compararCV} disabled={comparando || leyendoArchivo}>
          {comparando ? 'Comparando…' : '🎯 Comparar mi CV con este aviso'}
        </button>

        {errorCV && <p style={styles.error}>{errorCV}</p>}

        {evaluacionCV && (
          <div style={styles.ragCaja}>
            <div style={styles.contadorFila}>
              <p style={styles.contador}>Evaluación</p>
              <button style={styles.botonCerrarResultados} onClick={() => { setEvaluacionCV(null); setCvsUsados(null); }}>✕ Cerrar</button>
            </div>
            {evaluacionCV.split('\n').filter(Boolean).map((linea, i) => (
              <p key={i} style={styles.ragLinea}>{linea}</p>
            ))}
            {cvsUsados && cvsUsados.length > 0 && (
              <div style={styles.ragFuentes}>
                <p style={styles.modalSeccion}>CVs considerados</p>
                {cvsUsados.map((f, i) => (
                  f.webUrl ? (
                    <a key={i} href={f.webUrl} target="_blank" rel="noreferrer" style={styles.ragFuenteItem}>
                      📄 {f.nombre} ↗
                    </a>
                  ) : (
                    <p key={i} style={styles.ragFuenteItem}>📎 {f.nombre} (subido)</p>
                  )
                ))}
              </div>
            )}
          </div>
        )}
        </>
      )}

      {archivoAnalisis && createPortal(
        <div style={styles.modalFondo} onClick={() => setArchivoAnalisis(null)}>
          <div style={styles.modalCaja} onClick={(e) => e.stopPropagation()}>
            <button style={styles.modalCerrar} onClick={() => setArchivoAnalisis(null)} aria-label="Cerrar">✕</button>

            <div style={styles.modalEncabezado}>
              <span style={{ ...styles.icono, background: archivoAnalisis.tipoColor }}>{archivoAnalisis.tipoIcono}</span>
              <p style={styles.modalNombre}>{archivoAnalisis.nombre}</p>
            </div>

            {archivoAnalisis.cargando && <p style={styles.modalCargando}>Leyendo el archivo y generando el resumen…</p>}
            {archivoAnalisis.error && <p style={styles.error}>{archivoAnalisis.error}</p>}

            {archivoAnalisis.datosGenerales && (
              <div style={styles.modalDatos}>
                <p style={styles.modalSeccion}>Datos generales</p>
                {archivoAnalisis.datosGenerales.autor && (
                  <p style={styles.modalDato}><strong>Autor:</strong> {archivoAnalisis.datosGenerales.autor}</p>
                )}
                {archivoAnalisis.datosGenerales.ultimaEdicionPor && (
                  <p style={styles.modalDato}><strong>Última edición por:</strong> {archivoAnalisis.datosGenerales.ultimaEdicionPor}</p>
                )}
                {archivoAnalisis.datosGenerales.creado && (
                  <p style={styles.modalDato}><strong>Creado:</strong> {formatearFecha(archivoAnalisis.datosGenerales.creado)}</p>
                )}
                {archivoAnalisis.datosGenerales.modificado && (
                  <p style={styles.modalDato}><strong>Modificado:</strong> {formatearFecha(archivoAnalisis.datosGenerales.modificado)}</p>
                )}
                {archivoAnalisis.datosGenerales.tamano && (
                  <p style={styles.modalDato}><strong>Tamaño:</strong> {archivoAnalisis.datosGenerales.tamano}</p>
                )}
              </div>
            )}

            {archivoAnalisis.disponible === false && (
              <p style={styles.modalMotivo}>{archivoAnalisis.motivo}</p>
            )}

            {archivoAnalisis.resumen && (
              <div style={styles.modalResumen}>
                <p style={styles.modalSeccion}>Resumen ejecutivo</p>
                {archivoAnalisis.resumen.split('\n').filter(Boolean).map((linea, i) => (
                  <p key={i} style={styles.modalLinea}>{linea.replace(/^[-•*]\s*/, '')}</p>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}

const styles = {
  section: { marginTop: '32px' },
  h2: { fontFamily: 'var(--font-display)', fontSize: '2rem', margin: '0 0 4px', color: 'var(--paper-050)' },
  sub: { fontSize: '0.85rem', color: 'var(--paper-100)', margin: '0 0 14px' },
  subCampo: { fontSize: '0.72rem', color: 'var(--paper-100)', margin: '-2px 0 10px' },
  subirFila: { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' },
  botonSubir: {
    display: 'inline-block', background: 'var(--navy-900)', border: '1px dashed var(--navy-700)',
    color: 'var(--paper-050)', borderRadius: '10px', padding: '10px 16px', fontSize: '0.85rem',
    fontWeight: 600, cursor: 'pointer',
  },
  inputArchivoOculto: { display: 'none' },
  botonQuitarArchivo: {
    background: 'transparent', border: '1px solid var(--navy-700)', color: 'var(--paper-100)',
    borderRadius: '999px', padding: '6px 12px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
  },
  formFila: { display: 'flex', gap: '8px' },
  input: {
    flex: 1, background: 'var(--navy-900)', border: '1px solid var(--navy-700)', color: 'var(--paper-050)',
    borderRadius: '10px', padding: '11px 14px', fontSize: '0.9rem', outline: 'none',
    fontFamily: 'var(--font-body)',
  },
  textarea: {
    width: '100%', background: 'var(--navy-900)', border: '1px solid var(--navy-700)', color: 'var(--paper-050)',
    borderRadius: '10px', padding: '11px 14px', fontSize: '0.85rem', outline: 'none',
    fontFamily: 'var(--font-body)', resize: 'vertical', boxSizing: 'border-box', marginBottom: '8px',
  },
  botonBuscar: {
    background: 'var(--gold-500)', border: 'none', color: 'var(--navy-950)', borderRadius: '10px',
    padding: '11px 18px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  error: { fontSize: '0.8rem', color: 'var(--cal-red)', marginTop: '10px' },
  resultadosWrap: { marginTop: '16px' },
  contadorFila: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  contador: { fontSize: '0.75rem', color: 'var(--paper-100)', margin: 0 },
  botonCerrarResultados: {
    background: 'transparent', border: '1px solid var(--navy-700)', color: 'var(--paper-100)',
    borderRadius: '999px', padding: '4px 12px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
  },
  fila: {
    display: 'flex', alignItems: 'flex-start', gap: '12px', textDecoration: 'none', flexWrap: 'wrap',
    background: 'var(--navy-900)', border: '1px solid var(--navy-700)', borderRadius: '10px',
    padding: '12px 14px', marginBottom: '8px', overflow: 'hidden', boxSizing: 'border-box', width: '100%',
  },
  icono: {
    flexShrink: 0, width: '34px', height: '34px', borderRadius: '8px', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem',
  },
  filaTexto: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 },
  nombre: {
    fontSize: '0.9rem', fontWeight: 600, color: 'var(--paper-050)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  meta: { fontSize: '0.72rem', color: 'var(--paper-100)', wordBreak: 'break-word', overflowWrap: 'anywhere' },
  etiqueta: { fontWeight: 700 },
  abrir: { flexShrink: 0, fontSize: '0.75rem', color: 'var(--gold-500)', fontWeight: 600, whiteSpace: 'nowrap' },
  botonAnalisis: {
    flexShrink: 0, background: 'var(--navy-800)', border: '1px solid var(--navy-700)', color: 'var(--paper-050)',
    borderRadius: '999px', padding: '5px 12px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
  },
  modalFondo: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px',
  },
  modalCaja: {
    position: 'relative', background: 'var(--navy-900)', border: '1px solid var(--navy-700)',
    borderRadius: '18px', padding: '26px 22px 20px', width: '100%', maxWidth: '480px',
    maxHeight: '85vh', overflowY: 'auto', color: 'var(--paper-100)', fontFamily: 'var(--font-body)',
  },
  modalCerrar: {
    position: 'absolute', top: '14px', right: '14px', background: 'var(--navy-800)',
    border: '1px solid var(--navy-700)', color: 'var(--paper-100)', borderRadius: '50%',
    width: '28px', height: '28px', fontSize: '0.85rem', cursor: 'pointer',
  },
  modalEncabezado: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' },
  modalNombre: { fontSize: '1.05rem', fontWeight: 700, color: 'var(--paper-050)', margin: 0 },
  modalCargando: { fontSize: '0.85rem', color: 'var(--paper-100)' },
  modalDatos: { marginBottom: '16px' },
  modalSeccion: {
    fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700,
    color: 'var(--gold-500)', margin: '0 0 8px',
  },
  modalDato: { fontSize: '0.82rem', color: 'var(--paper-100)', margin: '3px 0' },
  modalMotivo: {
    fontSize: '0.82rem', color: 'var(--paper-100)', background: 'var(--navy-800)',
    border: '1px solid var(--navy-700)', borderRadius: '10px', padding: '10px 12px',
  },
  modalResumen: {
    background: 'var(--navy-800)', border: '1px solid var(--navy-700)', borderRadius: '12px', padding: '14px 16px',
  },
  modalLinea: {
    fontSize: '0.85rem', color: 'var(--paper-050)', margin: '0 0 8px', paddingLeft: '14px', position: 'relative',
  },
  toggleFila: { display: 'flex', gap: '8px', marginBottom: '14px' },
  toggleBoton: {
    background: 'var(--navy-900)', border: '1px solid var(--navy-700)', color: 'var(--paper-100)',
    borderRadius: '999px', padding: '7px 14px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
  },
  toggleBotonActivo: {
    background: 'var(--gold-500)', borderColor: 'var(--gold-500)', color: 'var(--navy-950)',
  },
  ragCaja: {
    background: 'var(--navy-900)', border: '1px solid var(--navy-700)', borderRadius: '12px',
    padding: '16px', marginTop: '16px',
  },
  ragLinea: { fontSize: '0.9rem', color: 'var(--paper-050)', lineHeight: 1.5, margin: '0 0 10px' },
  ragAviso: {
    fontSize: '0.78rem', color: 'var(--cal-red)', background: 'var(--navy-800)',
    border: '1px solid var(--navy-700)', borderRadius: '8px', padding: '8px 10px', margin: '0 0 12px',
  },
  ragDiagnostico: { fontSize: '0.68rem', color: 'var(--paper-100)', marginTop: '10px', fontFamily: 'var(--font-mono)' },
  ragFuentes: { marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--navy-700)' },
  ragFuenteItem: {
    display: 'block', fontSize: '0.8rem', color: 'var(--gold-500)', fontWeight: 600,
    textDecoration: 'none', margin: '4px 0',
  },
  tarjetaCorreo: {
    background: 'var(--navy-800)', border: '1px solid var(--navy-700)', borderRadius: '10px',
    padding: '10px 12px', margin: '6px 0', cursor: 'pointer',
    boxSizing: 'border-box', maxWidth: '100%', overflow: 'hidden',
  },
  tarjetaFilaCorreo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' },
  tarjetaHoraCorreo: { fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--paper-100)' },
  insigniaCorreo: {
    fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase',
    padding: '2px 8px', borderRadius: '999px', color: '#fff',
  },
  insigniaGmailCorreo: { background: 'var(--gold-500)' },
  insigniaOutlookCorreo: { background: '#4FA0E0' },
  tarjetaAsuntoCorreo: { fontSize: '0.82rem', fontWeight: 700, color: 'var(--paper-050)', margin: '0 0 2px', overflowWrap: 'break-word' },
  tarjetaDeCorreo: { fontSize: '0.74rem', color: 'var(--paper-100)', margin: 0, overflowWrap: 'break-word' },
  tarjetaCuerpoCorreo: {
    fontSize: '0.76rem', color: 'var(--paper-050)', lineHeight: 1.5, margin: '8px 0 0',
    paddingTop: '8px', borderTop: '1px solid var(--navy-700)', whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere', wordBreak: 'break-word', maxWidth: '100%',
  },
  tarjetaAbrirCorreo: { display: 'inline-block', fontSize: '0.72rem', color: 'var(--gold-500)', fontWeight: 600, marginTop: '8px' },
  tarjetaTogglePista: { fontSize: '0.65rem', color: 'var(--paper-100)', opacity: 0.6, margin: '6px 0 0' },
};
