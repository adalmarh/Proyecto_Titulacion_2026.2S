import { useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  LuBadgeCheck,
  LuPlus,
  LuSearch,
  LuUserCheck,
  LuClipboardCheck,
  LuCircleX,
  LuDownload,
  LuCircleCheck,
  LuTriangleAlert,
  LuHourglass,
  LuFileClock,
  LuSignature,
  LuCalendarClock,
  LuShieldCheck
} from "react-icons/lu";

import { diasParaVencer as diasPara } from "../utils/formatos";
import api from "../services/api";
import Modal from "../components/Modal";
import ModalDictamen from "../components/ModalDictamen";
import ModalFirma from "../components/ModalFirma";
import { AuthContext } from "../context/AuthContext";
import {
  obtenerCertificaciones,
  crearCertificacion,
  asignarCertificador,
  descargarCertificadoPDF
} from "../services/certificacionService";
import { obtenerCertificadores } from "../services/usuarioService";
import { usePermisos } from "../utils/permisos";
import {
  NOMBRE_ESTADO_CERTIFICACION,
  TIPOS_CERTIFICACION,
  formatearFecha,
  nombreCompleto,
  idDe
} from "../utils/formatos";


// ==========================================================
// CERTIFICACIONES
// - Administrador y productor solicitan.
// - El administrador asigna el certificador.
// - El administrador y el certificador emiten el dictamen.
// - Las aprobadas tienen certificado PDF.
// Flujo: pendiente → en revisión → aprobada / rechazada.
// ==========================================================

const solicitudVacia = {
  lote: "",
  tipoCertificacion: "",
  observacionesInspeccion: ""
};


const Certificaciones = () => {

  const permisos = usePermisos();
  const { usuario } = useContext(AuthContext);

  const [certificaciones, setCertificaciones] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [certificadores, setCertificadores] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  // Solicitud
  const [solicitando, setSolicitando] = useState(false);
  const [solicitud, setSolicitud] = useState(solicitudVacia);
  const [enviando, setEnviando] = useState(false);
  const [errorModal, setErrorModal] = useState("");

  // Asignación
  const [asignando, setAsignando] = useState(null);
  const [certificadorElegido, setCertificadorElegido] = useState("");

  // Dictamen
  const [dictaminando, setDictaminando] = useState(null);

  // Firma del certificado PDF
  const [firmando, setFirmando] = useState(null);


  // ========================================
  // CARGAR DATOS
  // ========================================

  const cargar = useCallback(async () => {
    try {
      setError("");
      const datos = await obtenerCertificaciones();
      setCertificaciones(datos.certificaciones || []);
    } catch (err) {
      setError(err.response?.data?.mensaje || "No se pudieron cargar las certificaciones");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();

    if (permisos.solicitarCertificacion) {
      api.get("/lotes")
        .then((r) => {
          const lista = Array.isArray(r.data) ? r.data : r.data.lotes || [];
          setLotes(lista.filter((l) => l.activo !== false));
        })
        .catch(() => {});
    }

    // Solo quien asigna necesita la lista de certificadores
    if (permisos.asignarCertificador) {
      obtenerCertificadores()
        .then((r) => setCertificadores(r.certificadores || []))
        .catch(() => setCertificadores([]));
    }
  }, [cargar, permisos.solicitarCertificacion, permisos.asignarCertificador]);


  // ========================================
  // RESUMEN Y FILTROS
  // ========================================

  const contar = (estado) => certificaciones.filter((c) => c.estado === estado).length;

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return certificaciones.filter((c) => {
      const coincideTexto =
        !texto ||
        `${c.codigo || ""} ${c.lote?.codigo || ""} ${c.tipoCertificacion} ${nombreCompleto(c.solicitante)}`
          .toLowerCase()
          .includes(texto);

      return coincideTexto && (!filtroEstado || c.estado === filtroEstado);
    });
  }, [certificaciones, busqueda, filtroEstado]);


  // ========================================
  // SOLICITAR
  // ========================================

  const abrirSolicitud = () => {
    setSolicitud(solicitudVacia);
    setErrorModal("");
    setMensaje("");
    setSolicitando(true);
  };

  const cambiarSolicitud = (evento) => {
    const { name, value } = evento.target;
    setSolicitud((anterior) => ({ ...anterior, [name]: value }));
  };

  const enviarSolicitud = async (evento) => {
    evento.preventDefault();
    setErrorModal("");

    if (!solicitud.lote || !solicitud.tipoCertificacion) {
      setErrorModal("Selecciona el lote y el tipo de certificación.");
      return;
    }

    try {
      setEnviando(true);

      await crearCertificacion({
        lote: solicitud.lote,
        tipoCertificacion: solicitud.tipoCertificacion,
        datosCertificacion: {
          observacionesInspeccion: solicitud.observacionesInspeccion.trim()
        }
      });

      setMensaje("Solicitud de certificación enviada correctamente");
      setSolicitando(false);
      await cargar();

    } catch (err) {
      setErrorModal(err.response?.data?.mensaje || "No se pudo enviar la solicitud");
    } finally {
      setEnviando(false);
    }
  };


  // ========================================
  // ASIGNAR CERTIFICADOR
  // ========================================

  const abrirAsignacion = (certificacion) => {
    setAsignando(certificacion);
    setCertificadorElegido("");
    setErrorModal("");
    setMensaje("");
  };

  const confirmarAsignacion = async (evento) => {
    evento.preventDefault();
    setErrorModal("");

    if (!certificadorElegido) {
      setErrorModal("Elige un certificador.");
      return;
    }

    try {
      setEnviando(true);
      await asignarCertificador(asignando._id, certificadorElegido);
      setMensaje(`Certificador asignado a ${asignando.codigo || "la solicitud"}`);
      setAsignando(null);
      await cargar();
    } catch (err) {
      setErrorModal(err.response?.data?.mensaje || "No se pudo asignar el certificador");
    } finally {
      setEnviando(false);
    }
  };


  // ========================================
  // DICTAMEN Y PDF
  // ========================================

  const dictamenListo = async (texto) => {
    setMensaje(texto);
    setDictaminando(null);
    await cargar();
  };

  const descargarPDF = async (certificacion) => {
    try {
      setError("");
      await descargarCertificadoPDF(
        certificacion._id,
        `${certificacion.codigo || "certificado"}${certificacion.firma?.firmada ? "-firmado" : ""}.pdf`
      );
    } catch {
      setError("No se pudo descargar el certificado PDF");
    }
  };


  // ========================================
  // RENDER
  // ========================================

  // Solo el certificador asignado firma el certificado
  const puedeFirmar = (c) =>
    permisos.rol === "certificador" && String(idDe(c.certificador)) === String(usuario?.id);

  const firmaListo = async (texto) => {
    setMensaje(texto);
    setFirmando(null);
    await cargar();
  };

  const accionesDe = (c) => {
    const acciones = [];

    if (permisos.asignarCertificador && c.estado === "pendiente") {
      acciones.push(
        <button key="asignar" className="gs-btn gs-btn-icono" onClick={() => abrirAsignacion(c)}>
          <LuUserCheck aria-hidden="true" />
          Asignar
        </button>
      );
    }

    if (permisos.resolverCertificacion && c.estado === "en_revision") {
      acciones.push(
        <button key="dictamen" className="gs-btn gs-btn-principal" onClick={() => setDictaminando(c)}>
          <LuClipboardCheck aria-hidden="true" />
          Dictaminar
        </button>
      );
    }

    if (permisos.resolverCertificacion && c.estado === "pendiente") {
      acciones.push(
        <button
          key="rechazar"
          className="gs-btn gs-btn-peligro"
          onClick={() => setDictaminando({ ...c, soloRechazo: true })}
        >
          <LuCircleX aria-hidden="true" />
          Rechazar
        </button>
      );
    }

    if (c.estado === "aprobada") {
      acciones.push(
        <button key="pdf" className="gs-btn gs-btn-icono" onClick={() => descargarPDF(c)}>
          <LuDownload aria-hidden="true" />
          PDF
        </button>
      );

      // Firma del PDF: solo el certificador asignado
      if (puedeFirmar(c)) {
        acciones.push(
          <button
            key="firma"
            className={`gs-btn ${c.firma?.firmada ? "gs-btn-icono" : "gs-btn-principal"}`}
            onClick={() => setFirmando(c)}
          >
            <LuSignature aria-hidden="true" />
            {c.firma?.firmada ? "Firma" : "Firmar"}
          </button>
        );
      }
    }

    if (acciones.length === 0 && (c.estado === "pendiente" || c.estado === "en_revision")) {
      return (
        <span className="gs-ayuda" style={{ whiteSpace: "nowrap" }}>
          {c.estado === "pendiente" ? "Esperando asignación" : "En manos del certificador"}
        </span>
      );
    }

    return acciones.length ? <div className="gs-acciones">{acciones}</div> : <span className="gs-ayuda">—</span>;
  };


  return (
    <div className="gs-pagina">

      <div className="gs-encabezado">
        <div>
          <h1>
            <LuBadgeCheck aria-hidden="true" />
            Certificaciones
          </h1>
          <p>Solicitudes de certificación de los lotes de cacao y su dictamen.</p>
        </div>

        {permisos.solicitarCertificacion && (
          <button className="gs-btn gs-btn-principal" onClick={abrirSolicitud}>
            <LuPlus aria-hidden="true" />
            Solicitar certificación
          </button>
        )}
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


      {/* RESUMEN */}
      <section className="gs-resumen" aria-label="Resumen">
        <div className="gs-kpi kpi-ambar">
          <span className="gs-kpi-icono"><LuFileClock aria-hidden="true" /></span>
          <div>
            <strong>{contar("pendiente")}</strong>
            <span>Pendientes de asignar</span>
          </div>
        </div>
        <div className="gs-kpi kpi-azul">
          <span className="gs-kpi-icono"><LuHourglass aria-hidden="true" /></span>
          <div>
            <strong>{contar("en_revision")}</strong>
            <span>En revisión</span>
          </div>
        </div>
        <div className="gs-kpi kpi-verde">
          <span className="gs-kpi-icono"><LuBadgeCheck aria-hidden="true" /></span>
          <div>
            <strong>{contar("aprobada")}</strong>
            <span>Aprobadas</span>
          </div>
        </div>
        <div className="gs-kpi kpi-rojo">
          <span className="gs-kpi-icono"><LuCircleX aria-hidden="true" /></span>
          <div>
            <strong>{contar("rechazada") + contar("vencida")}</strong>
            <span>Rechazadas o vencidas</span>
          </div>
        </div>
      </section>


      {/* FILTROS */}
      <div className="gs-filtros">
        <div className="gs-buscador">
          <LuSearch aria-hidden="true" />
          <input
            type="search"
            placeholder="Buscar por código, lote, tipo o solicitante"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar certificaciones"
          />
        </div>

        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          {Object.entries(NOMBRE_ESTADO_CERTIFICACION).map(([valor, nombre]) => (
            <option key={valor} value={valor}>{nombre}</option>
          ))}
        </select>
      </div>


      {/* TABLA */}
      <div className="gs-tarjeta">
        {cargando ? (
          <div className="gs-vacio">Cargando certificaciones...</div>
        ) : filtradas.length === 0 ? (
          <div className="gs-vacio">
            <LuBadgeCheck aria-hidden="true" />
            <h3>
              {certificaciones.length === 0
                ? "Todavía no hay solicitudes de certificación"
                : "Ninguna certificación coincide con los filtros"}
            </h3>
            <p>
              {certificaciones.length > 0
                ? "Cambia la búsqueda o el estado."
                : permisos.solicitarCertificacion
                  ? "Solicita la primera con el botón «Solicitar certificación»."
                  : "Aparecerán aquí cuando se soliciten."}
            </p>
          </div>
        ) : (
          <div className="gs-tabla-scroll">
            <table className="gs-tabla">
              <thead>
                <tr>
                  <th>Certificación</th>
                  <th>Lote</th>
                  <th>Solicitante</th>
                  <th>Certificador</th>
                  <th>Estado</th>
                  <th>Fechas</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {filtradas.map((c) => (
                  <tr key={c._id}>
                    <td>
                      <span className="gs-principal">{c.tipoCertificacion}</span>
                      <span className="gs-codigo">{c.codigo || "—"}</span>
                    </td>

                    <td>
                      <span className="gs-codigo">{c.lote?.codigo || "—"}</span>
                      <span className="gs-secundario">{c.lote?.producto}</span>
                    </td>

                    <td>{nombreCompleto(c.solicitante)}</td>

                    <td>
                      {c.certificador ? (
                        nombreCompleto(c.certificador)
                      ) : (
                        <span className="gs-ayuda">Sin asignar</span>
                      )}
                    </td>

                    <td>
                      <span className={`gs-estado gs-estado-${c.estado}`}>
                        {NOMBRE_ESTADO_CERTIFICACION[c.estado] || c.estado}
                      </span>
                      {c.estado === "aprobada" && (
                        c.firma?.firmada ? (
                          <span className="gs-firma-chip" title={`Firmado por ${c.firma.firmante}`}>
                            <LuShieldCheck aria-hidden="true" />
                            Firmada
                          </span>
                        ) : (
                          <span className="gs-firma-chip gs-firma-pendiente">
                            <LuSignature aria-hidden="true" />
                            Sin firmar
                          </span>
                        )
                      )}
                      {c.estado === "rechazada" && c.observaciones && (
                        <span className="gs-secundario" title={c.observaciones}>
                          {c.observaciones.length > 50 ? `${c.observaciones.slice(0, 50)}…` : c.observaciones}
                        </span>
                      )}
                    </td>

                    <td style={{ whiteSpace: "nowrap" }}>
                      {formatearFecha(c.fechaSolicitud)}
                      <span className="gs-secundario">
                        {c.estado === "aprobada" || c.estado === "vencida"
                          ? `${c.estado === "vencida" ? "Venció" : "Vence"}: ${formatearFecha(c.fechaVencimiento)}`
                          : "Solicitud"}
                      </span>
                      {c.estado === "aprobada" && diasPara(c.fechaVencimiento) !== null && diasPara(c.fechaVencimiento) <= 30 && (
                        <span className="av-chip">
                          <LuCalendarClock aria-hidden="true" />
                          {diasPara(c.fechaVencimiento) <= 0
                            ? "Vence hoy"
                            : diasPara(c.fechaVencimiento) === 1
                              ? "Vence mañana"
                              : `Vence en ${diasPara(c.fechaVencimiento)} días`}
                        </span>
                      )}
                    </td>

                    <td>{accionesDe(c)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>


      {/* SOLICITAR CERTIFICACIÓN */}
      {solicitando && (
        <Modal
          titulo="Solicitar certificación"
          subtitulo="El administrador asignará un certificador para revisarla."
          onCerrar={() => setSolicitando(false)}
          bloqueado={enviando}
        >
          <form className="gs-formulario" onSubmit={enviarSolicitud}>

            {errorModal && (
              <div className="gs-alerta gs-alerta-error">
                <LuTriangleAlert aria-hidden="true" />
                {errorModal}
              </div>
            )}

            <div className="gs-campos">
              <div className="gs-campo gs-campo-ancho">
                <label htmlFor="c-lote">Lote *</label>
                <select id="c-lote" name="lote" value={solicitud.lote} onChange={cambiarSolicitud} required>
                  <option value="">Seleccione el lote</option>
                  {lotes.map((l) => (
                    <option key={l._id} value={l._id}>
                      {l.codigo} · {nombreCompleto(l.productor)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="gs-campo gs-campo-ancho">
                <label htmlFor="c-tipo">Tipo de certificación *</label>
                <select
                  id="c-tipo"
                  name="tipoCertificacion"
                  value={solicitud.tipoCertificacion}
                  onChange={cambiarSolicitud}
                  required
                >
                  <option value="">Seleccione el tipo</option>
                  {TIPOS_CERTIFICACION.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="gs-campo gs-campo-ancho">
                <label htmlFor="c-observaciones">Observaciones para el certificador</label>
                <textarea
                  id="c-observaciones"
                  name="observacionesInspeccion"
                  rows={3}
                  value={solicitud.observacionesInspeccion}
                  onChange={cambiarSolicitud}
                  placeholder="Información útil para la inspección (opcional)"
                />
              </div>
            </div>

            <div className="gs-botones-modal">
              <button type="button" className="gs-btn gs-btn-secundario" onClick={() => setSolicitando(false)} disabled={enviando}>
                Cancelar
              </button>
              <button type="submit" className="gs-btn gs-btn-principal" disabled={enviando}>
                {enviando ? "Enviando..." : "Enviar solicitud"}
              </button>
            </div>
          </form>
        </Modal>
      )}


      {/* ASIGNAR CERTIFICADOR */}
      {asignando && (
        <Modal
          titulo="Asignar certificador"
          subtitulo={`${asignando.tipoCertificacion} · lote ${asignando.lote?.codigo || ""}`}
          onCerrar={() => setAsignando(null)}
          bloqueado={enviando}
        >
          <form className="gs-formulario" onSubmit={confirmarAsignacion}>

            {errorModal && (
              <div className="gs-alerta gs-alerta-error">
                <LuTriangleAlert aria-hidden="true" />
                {errorModal}
              </div>
            )}

            {certificadores.length === 0 ? (
              <p className="gs-ayuda">
                No hay certificadores activos. Crea una cuenta con el rol
                «Certificador» en la sección Usuarios.
              </p>
            ) : (
              <div className="gs-campo">
                <label htmlFor="c-certificador">Certificador *</label>
                <select
                  id="c-certificador"
                  value={certificadorElegido}
                  onChange={(e) => setCertificadorElegido(e.target.value)}
                  required
                >
                  <option value="">Seleccione el certificador</option>
                  {certificadores.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.nombre} {u.apellido} · {u.email}
                    </option>
                  ))}
                </select>
                <span className="gs-ayuda">
                  La solicitud pasará a «En revisión» y aparecerá en su panel.
                </span>
              </div>
            )}

            <div className="gs-botones-modal">
              <button type="button" className="gs-btn gs-btn-secundario" onClick={() => setAsignando(null)} disabled={enviando}>
                Cancelar
              </button>
              <button
                type="submit"
                className="gs-btn gs-btn-principal"
                disabled={enviando || certificadores.length === 0}
              >
                {enviando ? "Asignando..." : "Asignar"}
              </button>
            </div>
          </form>
        </Modal>
      )}


      {/* FIRMA ELECTRÓNICA DEL PDF */}
      {firmando && (
        <ModalFirma
          certificacion={firmando}
          onCerrar={() => setFirmando(null)}
          onListo={firmaListo}
        />
      )}


      {/* DICTAMEN */}
      {dictaminando && (
        <ModalDictamen
          certificacion={dictaminando}
          soloRechazo={Boolean(dictaminando.soloRechazo)}
          onCerrar={() => setDictaminando(null)}
          onListo={dictamenListo}
        />
      )}

    </div>
  );
};

export default Certificaciones;
