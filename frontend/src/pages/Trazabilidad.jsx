import { useEffect, useMemo, useState } from "react";

import {
  LuRoute,
  LuPlus,
  LuTrash2,
  LuMapPin,
  LuPaperclip,
  LuUser,
  LuCircleCheck,
  LuTriangleAlert,
  LuPackage,
  LuHistory
} from "react-icons/lu";

import api from "../services/api";
import { usePermisos } from "../utils/permisos";
import {
  NOMBRE_TIPO_EVENTO,
  NOMBRE_ESTADO_LOTE,
  formatearFecha,
  formatearFechaHora,
  nombreCompleto
} from "../utils/formatos";
import { iconoEvento } from "../utils/iconos";


const NOMBRE_ROL = {
  administrador: "administrador",
  certificador: "certificador"
};

// "https://www.riegoecuador.com/..." → "riegoecuador.com"
const dominio = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "enlace";
  }
};


// ==========================================================
// TRAZABILIDAD
// Historial de actividades de cada lote de cacao: siembra,
// cosecha, fermentación, secado, transporte...
// - Administrador y productor registran actividades.
// - Solo el administrador puede eliminarlas.
// - El certificador las consulta.
// ==========================================================

const formularioVacio = {
  tipo: "siembra",
  descripcion: "",
  fecha: "",
  evidencia: ""
};


const Trazabilidad = () => {

  const permisos = usePermisos();

  const [lotes, setLotes] = useState([]);
  const [loteId, setLoteId] = useState("");
  const [eventos, setEventos] = useState([]);
  const [formulario, setFormulario] = useState(formularioVacio);

  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");


  // ========================================
  // CARGAR DATOS
  // ========================================

  useEffect(() => {
    api.get("/lotes")
      .then((respuesta) => {
        const lista = Array.isArray(respuesta.data)
          ? respuesta.data
          : respuesta.data.lotes || [];
        setLotes(lista.filter((l) => l.activo !== false));
      })
      .catch(() => setError("No se pudieron cargar los lotes"));
  }, []);

  const cargarEventos = async (id) => {
    if (!id) {
      setEventos([]);
      return;
    }

    try {
      setCargando(true);
      setError("");
      const respuesta = await api.get(`/trazabilidad/lote/${id}`);
      setEventos(respuesta.data.eventos || []);
    } catch (err) {
      setEventos([]);
      setError(err.response?.data?.mensaje || "No se pudo cargar la trazabilidad");
    } finally {
      setCargando(false);
    }
  };

  const cambiarLote = (evento) => {
    const id = evento.target.value;
    setLoteId(id);
    setMensaje("");
    setError("");
    setFormulario(formularioVacio);
    cargarEventos(id);
  };

  const lote = lotes.find((l) => l._id === loteId);

  // Más reciente primero
  const eventosOrdenados = useMemo(
    () => [...eventos].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)),
    [eventos]
  );


  // ========================================
  // REGISTRAR ACTIVIDAD
  // ========================================

  const cambiarCampo = (evento) => {
    const { name, value } = evento.target;
    setFormulario((anterior) => ({ ...anterior, [name]: value }));
  };

  const registrar = async (evento) => {
    evento.preventDefault();
    setMensaje("");
    setError("");

    if (!loteId || !formulario.tipo || !formulario.descripcion.trim()) {
      setError("Selecciona el tipo de actividad y escribe una descripción.");
      return;
    }

    try {
      setGuardando(true);

      await api.post("/trazabilidad", {
        lote: loteId,
        tipo: formulario.tipo,
        descripcion: formulario.descripcion.trim(),
        fecha: formulario.fecha || undefined,
        evidencia: formulario.evidencia.trim() || undefined
      });

      setMensaje(`Actividad «${NOMBRE_TIPO_EVENTO[formulario.tipo]}» registrada correctamente`);
      setFormulario(formularioVacio);
      await cargarEventos(loteId);

    } catch (err) {
      setError(err.response?.data?.mensaje || "No se pudo registrar la actividad");
    } finally {
      setGuardando(false);
    }
  };


  // ========================================
  // ELIMINAR ACTIVIDAD
  // ========================================

  const eliminar = async (registro) => {
    if (!window.confirm(
      `¿Eliminar la actividad «${NOMBRE_TIPO_EVENTO[registro.tipo] || registro.tipo}» del ${formatearFecha(registro.fecha)}? Esta acción no se puede deshacer.`
    )) {
      return;
    }

    try {
      setError("");
      await api.delete(`/trazabilidad/${registro._id}`);
      setMensaje("Actividad eliminada");
      await cargarEventos(loteId);
    } catch (err) {
      setError(err.response?.data?.mensaje || "No se pudo eliminar la actividad");
    }
  };


  // ========================================
  // RENDER
  // ========================================

  // El productor del lote se muestra una sola vez en la cabecera.
  // En cada actividad solo se indica quién la registró cuando no
  // fue el propio productor (por ejemplo, el administrador).
  const productorLote = lote ? nombreCompleto(lote.productor) : "";

  // La ubicación es la del lote (siempre la misma): se muestra
  // una vez en la cabecera y no se pide en cada actividad.
  const ubicacionLote = lote
    ? [lote.ubicacion?.parroquia, lote.ubicacion?.canton, lote.ubicacion?.provincia]
      .filter(Boolean)
      .join(", ")
    : "";

  // Se decide solo por el rol: un productor solo registra en sus
  // propios lotes, así que cualquier otro rol es otra persona.
  const registradoPorOtro = (responsable) =>
    Boolean(responsable) && responsable.rol !== "productor";

  const historial = (
    <section className="gs-panel">
      <div className="gs-panel-cabecera">
        <div>
          <h2><LuHistory aria-hidden="true" />Historial del lote</h2>
          <p className="tz-historial-sub">
            {productorLote && (
              <span className="tz-productor">
                <LuUser aria-hidden="true" />
                Productor: <strong>{productorLote}</strong>
              </span>
            )}
            {ubicacionLote && (
              <span className="tz-productor">
                <LuMapPin aria-hidden="true" />
                {ubicacionLote}
              </span>
            )}
            <span>
              {eventos.length === 1 ? "1 actividad registrada" : `${eventos.length} actividades registradas`}
            </span>
          </p>
        </div>
      </div>

      <div className="gs-panel-cuerpo">
        {cargando ? (
          <p className="gs-ayuda">Cargando historial...</p>
        ) : eventosOrdenados.length === 0 ? (
          <div className="gs-vacio" style={{ padding: "28px 10px" }}>
            <LuRoute aria-hidden="true" />
            <h3>Este lote todavía no tiene actividades</h3>
            <p>
              {permisos.registrarEventos
                ? "Registra la primera con el formulario."
                : "Aparecerán aquí cuando se registren."}
            </p>
          </div>
        ) : (
          <ol className="gs-linea-tiempo">
            {eventosOrdenados.map((registro) => {
              const Icono = iconoEvento(registro.tipo);

              return (
                <li key={registro._id}>
                  <span className="gs-linea-icono" aria-hidden="true">
                    <Icono />
                  </span>

                  <div className="gs-linea-texto">
                    <div className="gs-linea-cabecera">
                      <div>
                        <h3>{NOMBRE_TIPO_EVENTO[registro.tipo] || registro.tipo}</h3>
                        <time dateTime={registro.fecha}>
                          {formatearFechaHora(registro.fecha)}
                        </time>
                      </div>

                      {permisos.eliminarEventos && (
                        <button
                          className="gs-btn gs-btn-peligro gs-btn-icono"
                          onClick={() => eliminar(registro)}
                          aria-label={`Eliminar actividad ${NOMBRE_TIPO_EVENTO[registro.tipo] || registro.tipo}`}
                          title="Eliminar actividad"
                        >
                          <LuTrash2 aria-hidden="true" />
                        </button>
                      )}
                    </div>

                    <p>{registro.descripcion}</p>

                    {(registradoPorOtro(registro.responsable) || registro.evidencia) && (
                    <p className="gs-linea-meta gs-ayuda">
                      {registradoPorOtro(registro.responsable) && (
                        <span>
                          <LuUser aria-hidden="true" />
                          Registrado por {nombreCompleto(registro.responsable)}
                          {NOMBRE_ROL[registro.responsable.rol] && ` (${NOMBRE_ROL[registro.responsable.rol]})`}
                        </span>
                      )}
                      {registro.evidencia && (
                        <span className="tz-evidencia">
                          <LuPaperclip aria-hidden="true" />
                          {/^https?:\/\//i.test(registro.evidencia) ? (
                            <a href={registro.evidencia} target="_blank" rel="noreferrer" title={registro.evidencia}>
                              Ver evidencia ({dominio(registro.evidencia)})
                            </a>
                          ) : (
                            registro.evidencia
                          )}
                        </span>
                      )}
                    </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );


  return (
    <div className="gs-pagina">

      <div className="gs-encabezado">
        <div>
          <h1>
            <LuRoute aria-hidden="true" />
            Trazabilidad
          </h1>
          <p>
            {permisos.registrarEventos
              ? "Registra las actividades de cada lote, desde la siembra hasta la distribución."
              : "Consulta el historial de actividades de cada lote."}
          </p>
        </div>
      </div>


      {mensaje && (
        <div className="gs-alerta gs-alerta-exito">
          <LuCircleCheck aria-hidden="true" />
          {mensaje}
        </div>
      )}

      {error && (
        <div className="gs-alerta gs-alerta-error">
          <LuTriangleAlert aria-hidden="true" />
          {error}
        </div>
      )}


      {/* SELECCIÓN DEL LOTE */}
      <section className="gs-panel" style={{ marginBottom: 20 }}>
        <div className="gs-panel-cuerpo">
          <div className="gs-campos">
            <div className="gs-campo">
              <label htmlFor="t-lote">Lote</label>
              <select id="t-lote" value={loteId} onChange={cambiarLote}>
                <option value="">Seleccione un lote</option>
                {lotes.map((l) => (
                  <option key={l._id} value={l._id}>
                    {l.codigo} · {nombreCompleto(l.productor)}
                  </option>
                ))}
              </select>
            </div>

            {lote && (
              <dl className="gs-ficha" style={{ alignSelf: "end" }}>
                <dt>Etapa</dt>
                <dd>
                  <span className={`gs-estado gs-estado-${lote.estado}`}>
                    {NOMBRE_ESTADO_LOTE[lote.estado] || lote.estado}
                  </span>
                </dd>
                <dt>Cantidad</dt>
                <dd>{Number(lote.cantidad).toLocaleString("es-EC")} {lote.unidad || "kg"}</dd>
              </dl>
            )}
          </div>
        </div>
      </section>


      {!loteId ? (
        <div className="gs-tarjeta">
          <div className="gs-vacio">
            <LuPackage aria-hidden="true" />
            <h3>Selecciona un lote</h3>
            <p>
              {lotes.length === 0
                ? "No hay lotes activos disponibles."
                : "Elige un lote para ver su historial de actividades."}
            </p>
          </div>
        </div>
      ) : permisos.registrarEventos ? (
        <div className="gs-cuadricula">

          {/* FORMULARIO */}
          <section className="gs-panel">
            <div className="gs-panel-cabecera">
              <div>
                <h2><LuPlus aria-hidden="true" />Registrar actividad</h2>
                <p>Lote {lote?.codigo}</p>
              </div>
            </div>

            <form className="gs-formulario gs-panel-cuerpo" onSubmit={registrar}>
              <div className="gs-campos">
                <div className="gs-campo">
                  <label htmlFor="t-tipo">Tipo de actividad *</label>
                  <select id="t-tipo" name="tipo" value={formulario.tipo} onChange={cambiarCampo} required>
                    {Object.entries(NOMBRE_TIPO_EVENTO).map(([valor, nombre]) => (
                      <option key={valor} value={valor}>{nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="gs-campo">
                  <label htmlFor="t-fecha">Fecha y hora</label>
                  <input
                    id="t-fecha"
                    type="datetime-local"
                    name="fecha"
                    value={formulario.fecha}
                    onChange={cambiarCampo}
                  />
                  <span className="gs-ayuda">Si la dejas vacía se usa la fecha actual.</span>
                </div>

                <div className="gs-campo gs-campo-ancho">
                  <label htmlFor="t-descripcion">Descripción *</label>
                  <textarea
                    id="t-descripcion"
                    name="descripcion"
                    rows={3}
                    value={formulario.descripcion}
                    onChange={cambiarCampo}
                    placeholder="Ej.: Fermentación en cajones de madera durante 6 días"
                    required
                  />
                </div>

                <div className="gs-campo gs-campo-ancho">
                  <label htmlFor="t-evidencia">Evidencia</label>
                  <input
                    id="t-evidencia"
                    name="evidencia"
                    value={formulario.evidencia}
                    onChange={cambiarCampo}
                    placeholder="N.º de guía, enlace a foto…"
                  />
                </div>
              </div>

              <div className="gs-botones-modal">
                <button type="submit" className="gs-btn gs-btn-principal" disabled={guardando}>
                  <LuPlus aria-hidden="true" />
                  {guardando ? "Registrando..." : "Registrar actividad"}
                </button>
              </div>
            </form>
          </section>

          {historial}
        </div>
      ) : (
        historial
      )}

    </div>
  );
};

export default Trazabilidad;
