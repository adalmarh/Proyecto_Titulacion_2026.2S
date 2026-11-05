import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  LuInbox,
  LuSearch,
  LuClipboardCheck,
  LuUserCheck,
  LuUserX,
  LuCircleCheck,
  LuCircleX,
  LuTriangleAlert,
  LuClock,
  LuInfo,
  LuRefreshCw
} from "react-icons/lu";

import api from "../services/api";
import Modal from "../components/Modal";
import { usePermisos, ROLES } from "../utils/permisos";
import { formatearFecha, formatearFechaHora, nombreCompleto, idDe } from "../utils/formatos";


// ==========================================================
// SOLICITUDES DE CUENTA
// - Administrador: revisa todas y elige la asociación.
// - Asociación: revisa las de los productores que dicen
//   pertenecer a ella.
// Al aprobar, el backend crea la cuenta (y la ficha del
// productor si no existía). Al rechazar, se exige el motivo,
// que la persona verá al intentar iniciar sesión.
// ==========================================================

const NOMBRE_ESTADO = {
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  rechazada: "Rechazada"
};

const NOMBRE_TIPO = {
  productor: "Productor",
  asociacion: "Asociación"
};

// Avisa al menú lateral para que actualice el contador
const avisarCambio = () => window.dispatchEvent(new Event("solicitudes-cambio"));


const Solicitudes = () => {

  const permisos = usePermisos();
  const esAdmin = permisos.rol === ROLES.ADMIN;

  const [solicitudes, setSolicitudes] = useState([]);
  const [asociaciones, setAsociaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const [filtroEstado, setFiltroEstado] = useState("pendiente");
  const [busqueda, setBusqueda] = useState("");

  // Revisión
  const [revisando, setRevisando] = useState(null);
  const [decision, setDecision] = useState("aprobar");
  const [asociacionElegida, setAsociacionElegida] = useState("");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorModal, setErrorModal] = useState("");


  const cargar = useCallback(async () => {
    try {
      setError("");
      const r = await api.get("/solicitudes");
      setSolicitudes(r.data.solicitudes || []);
    } catch (err) {
      setError(err.response?.data?.mensaje || "No se pudieron cargar las solicitudes");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    if (esAdmin) {
      api.get("/asociaciones")
        .then((r) => setAsociaciones((r.data || []).filter((a) => a.activa !== false)))
        .catch(() => setAsociaciones([]));
    }
  }, [cargar, esAdmin]);


  const contar = (estado) => solicitudes.filter((s) => s.estado === estado).length;

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return solicitudes.filter((s) =>
      (!filtroEstado || s.estado === filtroEstado) &&
      (!texto || `${s.nombre} ${s.apellido} ${s.cedula} ${s.email}`.toLowerCase().includes(texto))
    );
  }, [solicitudes, filtroEstado, busqueda]);


  // ========================================
  // REVISAR
  // ========================================

  const abrirRevision = (solicitud) => {
    setRevisando(solicitud);
    setDecision("aprobar");
    setAsociacionElegida(idDe(solicitud.asociacion));
    setMotivo("");
    setErrorModal("");
    setMensaje("");
  };

  const enviarRevision = async (evento) => {
    evento.preventDefault();
    setErrorModal("");

    const aprobar = decision === "aprobar";

    if (aprobar && esAdmin && !asociacionElegida) {
      setErrorModal("Selecciona la asociación. Si es nueva, regístrala primero en Asociaciones.");
      return;
    }

    if (!aprobar && motivo.trim().length < 5) {
      setErrorModal("Escribe el motivo del rechazo; la persona lo verá al intentar entrar.");
      return;
    }

    try {
      setEnviando(true);

      const r = aprobar
        ? await api.patch(`/solicitudes/${revisando._id}/aprobar`, esAdmin ? { asociacion: asociacionElegida } : {})
        : await api.patch(`/solicitudes/${revisando._id}/rechazar`, { motivo: motivo.trim() });

      setMensaje(
        aprobar
          ? `${r.data.mensaje}. Ya puede iniciar sesión con ${revisando.email}.`
          : `Solicitud de ${revisando.nombre} ${revisando.apellido} rechazada`
      );
      setRevisando(null);
      avisarCambio();
      await cargar();

    } catch (err) {
      setErrorModal(err.response?.data?.mensaje || "No se pudo registrar la revisión");
    } finally {
      setEnviando(false);
    }
  };


  // ========================================
  // RENDER
  // ========================================

  const ubicacion = (s) =>
    [s.parroquia, s.canton, s.provincia].filter(Boolean).join(", ") || "—";

  const nombreAsociacion = (s) =>
    s.asociacion?.nombre || (s.nombreAsociacion ? `Nueva: ${s.nombreAsociacion}` : "—");

  return (
    <div className="gs-pagina">

      <div className="gs-encabezado">
        <div>
          <h1>
            <LuInbox aria-hidden="true" />
            Solicitudes de cuenta
          </h1>
          <p>
            {esAdmin
              ? "Personas que pidieron acceso desde la pantalla de inicio de sesión."
              : "Productores que pidieron acceso indicando que pertenecen a tu asociación."}
          </p>
        </div>

        <button className="gs-btn gs-btn-secundario" onClick={cargar}>
          <LuRefreshCw aria-hidden="true" />
          Actualizar
        </button>
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


      <section className="gs-resumen gs-resumen-3" aria-label="Resumen">
        <div className="gs-kpi kpi-ambar">
          <span className="gs-kpi-icono"><LuClock aria-hidden="true" /></span>
          <div>
            <strong>{contar("pendiente")}</strong>
            <span>Pendientes de revisar</span>
          </div>
        </div>
        <div className="gs-kpi kpi-verde">
          <span className="gs-kpi-icono"><LuUserCheck aria-hidden="true" /></span>
          <div>
            <strong>{contar("aprobada")}</strong>
            <span>Aprobadas</span>
          </div>
        </div>
        <div className="gs-kpi kpi-rojo">
          <span className="gs-kpi-icono"><LuUserX aria-hidden="true" /></span>
          <div>
            <strong>{contar("rechazada")}</strong>
            <span>Rechazadas</span>
          </div>
        </div>
      </section>


      <div className="gs-filtros">
        <div className="gs-buscador">
          <LuSearch aria-hidden="true" />
          <input
            type="search"
            placeholder="Buscar por nombre, cédula o correo"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar solicitudes"
          />
        </div>

        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} aria-label="Filtrar por estado">
          <option value="pendiente">Pendientes</option>
          <option value="aprobada">Aprobadas</option>
          <option value="rechazada">Rechazadas</option>
          <option value="">Todas</option>
        </select>
      </div>


      <div className="gs-tarjeta">
        {cargando ? (
          <div className="gs-vacio">Cargando solicitudes...</div>
        ) : filtradas.length === 0 ? (
          <div className="gs-vacio">
            <LuInbox aria-hidden="true" />
            <h3>
              {filtroEstado === "pendiente" ? "No hay solicitudes pendientes" : "No hay solicitudes con este filtro"}
            </h3>
            <p>
              Las personas piden su cuenta con el enlace «Solicitar acceso» de la pantalla de inicio de sesión.
            </p>
          </div>
        ) : (
          <div className="gs-tabla-scroll">
            <table className="gs-tabla">
              <thead>
                <tr>
                  <th>Solicitante</th>
                  <th>Contacto</th>
                  <th>Cuenta</th>
                  <th>Asociación</th>
                  <th>Enviada</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((s) => (
                  <tr key={s._id}>
                    <td>
                      <span className="gs-principal">{s.nombre} {s.apellido}</span>
                      <span className="gs-secundario">C.I. {s.cedula}</span>
                    </td>
                    <td>
                      <span className="gs-principal" style={{ fontWeight: 500 }}>{s.email}</span>
                      <span className="gs-secundario">{s.telefono || "Sin celular"}</span>
                    </td>
                    <td>
                      <span className={`gs-etiqueta gs-rol-${s.rolSolicitado}`}>{NOMBRE_TIPO[s.rolSolicitado]}</span>
                    </td>
                    <td>
                      {nombreAsociacion(s)}
                      {(s.canton || s.provincia) && (
                        <span className="gs-secundario">{[s.canton, s.provincia].filter(Boolean).join(", ")}</span>
                      )}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatearFecha(s.createdAt)}</td>
                    <td>
                      <span className={`gs-estado gs-estado-${s.estado}`}>{NOMBRE_ESTADO[s.estado]}</span>
                      {s.estado !== "pendiente" && s.revisadoPor && (
                        <span className="gs-secundario">por {nombreCompleto(s.revisadoPor)}</span>
                      )}
                    </td>
                    <td>
                      {s.estado === "pendiente" ? (
                        <button className="gs-btn gs-btn-principal" onClick={() => abrirRevision(s)}>
                          <LuClipboardCheck aria-hidden="true" />
                          Revisar
                        </button>
                      ) : s.estado === "rechazada" ? (
                        <span className="gs-ayuda" title={s.motivoRechazo}>
                          {s.motivoRechazo.length > 40 ? `${s.motivoRechazo.slice(0, 40)}…` : s.motivoRechazo}
                        </span>
                      ) : (
                        <span className="gs-ayuda">{formatearFecha(s.fechaRevision)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>


      {/* MODAL DE REVISIÓN */}
      {revisando && (
        <Modal
          titulo="Revisar solicitud de cuenta"
          subtitulo={`${revisando.nombre} ${revisando.apellido} · ${NOMBRE_TIPO[revisando.rolSolicitado]}`}
          onCerrar={() => setRevisando(null)}
          bloqueado={enviando}
          ancho
        >
          <div className="gs-dictamen gs-dictamen-doble">

            <div className="gs-dictamen-info">
              <h3>Datos enviados</h3>
              <dl className="gs-ficha">
                <dt>Nombre</dt>
                <dd>{revisando.nombre} {revisando.apellido}</dd>
                <dt>Cédula</dt>
                <dd>{revisando.cedula}</dd>
                <dt>Correo</dt>
                <dd>{revisando.email}</dd>
                <dt>Celular</dt>
                <dd>
                  {revisando.telefono ? (
                    <a className="gs-enlace" href={`tel:${revisando.telefono}`}>{revisando.telefono}</a>
                  ) : "—"}
                </dd>
                <dt>Ubicación</dt>
                <dd>{ubicacion(revisando)}</dd>
                <dt>{revisando.rolSolicitado === "productor" ? "Cómo llegar" : "Sede"}</dt>
                <dd>{revisando.direccion || "—"}</dd>
                <dt>Cuenta</dt>
                <dd>{NOMBRE_TIPO[revisando.rolSolicitado]}</dd>
                <dt>Asociación</dt>
                <dd>{nombreAsociacion(revisando)}</dd>
                <dt>Enviada</dt>
                <dd>{formatearFechaHora(revisando.createdAt)}</dd>
                <dt>Privacidad</dt>
                <dd>
                  {revisando.consentimiento?.fecha
                    ? `Aviso aceptado el ${formatearFecha(revisando.consentimiento.fecha)} (versión ${revisando.consentimiento.version})`
                    : "Sin constancia (solicitud anterior al aviso)"}
                </dd>
              </dl>

              {revisando.mensaje && (
                <>
                  <h3>Mensaje</h3>
                  <p className="gs-cita">{revisando.mensaje}</p>
                </>
              )}

              {revisando.productorExistente && (
                <div className={`gs-alerta ${revisando.productorExistente.tieneCuenta ? "gs-alerta-error" : "gs-alerta-info"}`}>
                  <LuInfo aria-hidden="true" />
                  <span>
                    {revisando.productorExistente.tieneCuenta
                      ? "Esta cédula ya tiene una cuenta: conviene rechazar la solicitud."
                      : `Ya existe la ficha del productor ${nombreCompleto(revisando.productorExistente)} (${revisando.productorExistente.asociacion?.nombre || "sin asociación"}). Al aprobar, la cuenta se vinculará a esa ficha y a sus lotes.`}
                  </span>
                </div>
              )}
            </div>


            <form className="gs-formulario" onSubmit={enviarRevision}>

              {errorModal && (
                <div className="gs-alerta gs-alerta-error">
                  <LuTriangleAlert aria-hidden="true" />
                  {errorModal}
                </div>
              )}

              <div className="gs-opciones" role="radiogroup" aria-label="Decisión">
                <label className={`gs-opcion ${decision === "aprobar" ? "gs-opcion-aprobar" : ""}`}>
                  <input type="radio" name="decision" checked={decision === "aprobar"} onChange={() => setDecision("aprobar")} />
                  <LuCircleCheck aria-hidden="true" />
                  Aprobar
                </label>
                <label className={`gs-opcion ${decision === "rechazar" ? "gs-opcion-rechazar" : ""}`}>
                  <input type="radio" name="decision" checked={decision === "rechazar"} onChange={() => setDecision("rechazar")} />
                  <LuCircleX aria-hidden="true" />
                  Rechazar
                </label>
              </div>

              {decision === "aprobar" ? (
                esAdmin ? (
                  <div className="gs-campo">
                    <label htmlFor="r-asociacion">Asociación de la cuenta *</label>
                    <select
                      id="r-asociacion"
                      value={asociacionElegida}
                      onChange={(e) => setAsociacionElegida(e.target.value)}
                    >
                      <option value="">Seleccione la asociación</option>
                      {asociaciones.map((a) => (
                        <option key={a._id} value={a._id}>{a.nombre}</option>
                      ))}
                    </select>
                    {revisando.nombreAsociacion && !revisando.asociacion && (
                      <span className="gs-ayuda">
                        Pidió una asociación nueva: «{revisando.nombreAsociacion}». Regístrala en{" "}
                        <Link to="/asociaciones" className="gs-enlace">Asociaciones</Link> y luego vuelve aquí.
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="gs-ayuda">
                    Se creará la cuenta de productor en tu asociación, con su celular y la
                    dirección de la finca en su ficha. Aprueba solo si reconoces a la persona
                    como socia; si tienes dudas, llámala o visita la finca antes.
                  </p>
                )
              ) : (
                <div className="gs-campo">
                  <label htmlFor="r-motivo">Motivo del rechazo *</label>
                  <textarea
                    id="r-motivo"
                    rows={3}
                    maxLength={300}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Ej.: No figura en el registro de socios"
                  />
                  <span className="gs-ayuda">La persona verá este motivo al intentar iniciar sesión.</span>
                </div>
              )}

              <div className="gs-botones-modal">
                <button type="button" className="gs-btn gs-btn-secundario" onClick={() => setRevisando(null)} disabled={enviando}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`gs-btn ${decision === "aprobar" ? "gs-btn-principal" : "gs-btn-rechazo"}`}
                  disabled={enviando}
                >
                  {enviando ? "Guardando..." : decision === "aprobar" ? "Aprobar y crear cuenta" : "Rechazar solicitud"}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

    </div>
  );
};

export default Solicitudes;
