import { useContext, useEffect, useState } from "react";

import {
  LuShieldCheck,
  LuClipboardCheck,
  LuCircleCheck,
  LuCircleX,
  LuBadgeCheck,
  LuDownload,
  LuHistory,
  LuSignature
} from "react-icons/lu";

import api from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { descargarCertificadoPDF } from "../services/certificacionService";
import ModalDictamen from "../components/ModalDictamen";
import ModalFirma from "../components/ModalFirma";
import {
  NOMBRE_ESTADO_CERTIFICACION,
  NOMBRE_ESTADO_LOTE,
  NOMBRE_TIPO_EVENTO,
  formatearFecha,
  nombreCompleto
} from "../utils/formatos";

import "./Paneles.css";


// ==========================================
// PANEL DEL CERTIFICADOR
// Muestra solo las certificaciones que tiene
// asignadas y permite revisarlas: datos del
// lote, su historial de trazabilidad y el
// dictamen (aprobar o rechazar).
// ==========================================

const PanelCertificador = () => {

  const { usuario } = useContext(AuthContext);

  const [certificaciones, setCertificaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  // Revisión en curso
  const [revisando, setRevisando] = useState(null);
  const [detalleLote, setDetalleLote] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorRevision, setErrorRevision] = useState("");

  // Firma del certificado PDF
  const [firmando, setFirmando] = useState(null);
  const sinFirmar = certificaciones.filter((c) => c.estado === "aprobada" && !c.firma?.firmada);


  // ========================================
  // CARGAR CERTIFICACIONES ASIGNADAS
  // ========================================

  const cargar = async () => {
    try {
      setError("");
      const respuesta = await api.get("/certificaciones");
      setCertificaciones(respuesta.data.certificaciones || []);
    } catch (err) {
      setError(
        err.response?.data?.mensaje ||
        "No se pudieron cargar tus certificaciones"
      );
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);


  const porRevisar = certificaciones.filter((c) => c.estado === "en_revision");
  const aprobadas = certificaciones.filter((c) => c.estado === "aprobada");
  const rechazadas = certificaciones.filter((c) => c.estado === "rechazada");
  const resueltas = certificaciones.filter(
    (c) => c.estado !== "en_revision" && c.estado !== "pendiente"
  );


  // ========================================
  // ABRIR REVISIÓN
  // Carga el lote completo y su trazabilidad.
  // ========================================

  const abrirRevision = async (certificacion) => {
    setRevisando(certificacion);
    setErrorRevision("");
    setDetalleLote(null);
    setHistorial([]);

    const loteId = certificacion.lote?._id;

    if (!loteId) {
      return;
    }

    try {
      setCargandoDetalle(true);

      const [resLote, resHistorial] = await Promise.all([
        api.get(`/lotes/${loteId}`),
        api.get(`/trazabilidad/lote/${loteId}`)
      ]);

      setDetalleLote(resLote.data);
      setHistorial(resHistorial.data.eventos || []);

    } catch (err) {
      setErrorRevision(
        err.response?.data?.mensaje ||
        "No se pudo cargar la información del lote"
      );
    } finally {
      setCargandoDetalle(false);
    }
  };

  const dictamenListo = async (texto) => {
    setMensaje(texto);
    setRevisando(null);
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


  if (cargando) {
    return <div className="pn-vacio">Cargando tu panel...</div>;
  }


  return (
    <div className="pn-pagina">

      {/* BIENVENIDA */}
      <section className="pn-bienvenida">
        <div>
          <h1>Hola, {usuario?.nombre}</h1>
          <p>
            {sinFirmar.length > 0 && `Tienes ${sinFirmar.length} ${sinFirmar.length === 1 ? "certificado aprobado" : "certificados aprobados"} sin firmar. `}
            {porRevisar.length === 0
              ? "No tienes certificaciones pendientes de revisión."
              : `Tienes ${porRevisar.length} ${
                porRevisar.length === 1
                  ? "certificación pendiente"
                  : "certificaciones pendientes"
              } de revisión.`}
          </p>
        </div>

        <LuShieldCheck className="pn-bienvenida-icono" aria-hidden="true" />
      </section>


      {mensaje && <div className="pn-alerta pn-alerta-exito">{mensaje}</div>}
      {error && <div className="pn-alerta pn-alerta-error">{error}</div>}


      {/* RESUMEN */}
      <section className="pn-resumen" aria-label="Resumen">
        <div className="pn-dato kpi-ambar">
          <span className="pn-dato-icono"><LuClipboardCheck aria-hidden="true" /></span>
          <div>
            <strong>{porRevisar.length}</strong>
            <span>Por revisar</span>
          </div>
        </div>

        <div className="pn-dato kpi-verde">
          <span className="pn-dato-icono"><LuCircleCheck aria-hidden="true" /></span>
          <div>
            <strong>{aprobadas.length}</strong>
            <span>Aprobadas</span>
          </div>
        </div>

        <div className="pn-dato kpi-rojo">
          <span className="pn-dato-icono"><LuCircleX aria-hidden="true" /></span>
          <div>
            <strong>{rechazadas.length}</strong>
            <span>Rechazadas</span>
          </div>
        </div>

        <div className="pn-dato kpi-azul">
          <span className="pn-dato-icono"><LuBadgeCheck aria-hidden="true" /></span>
          <div>
            <strong>{certificaciones.length}</strong>
            <span>Asignadas en total</span>
          </div>
        </div>
      </section>


      {/* POR REVISAR */}
      <section className="pn-seccion">
        <div className="pn-seccion-cabecera">
          <h2><LuClipboardCheck aria-hidden="true" />Certificaciones por revisar</h2>
        </div>

        {porRevisar.length === 0 ? (
          <div className="pn-vacio">
            Cuando el administrador te asigne una certificación, aparecerá aquí.
          </div>
        ) : (
          <div className="pn-tarjetas">
            {porRevisar.map((c) => (
              <article className="pn-tarjeta" key={c._id}>
                <div className="pn-tarjeta-cabecera">
                  <div>
                    <strong>{c.tipoCertificacion}</strong>
                    <span className="pn-codigo">{c.codigo}</span>
                  </div>
                  <span className="pn-estado pn-estado-en_revision">En revisión</span>
                </div>

                <dl>
                  <dt>Lote</dt>
                  <dd>{c.lote?.codigo || "—"}</dd>
                  <dt>Cantidad</dt>
                  <dd>{c.lote ? `${c.lote.cantidad} ${c.lote.unidad || "kg"}` : "—"}</dd>
                  <dt>Solicitante</dt>
                  <dd>{nombreCompleto(c.solicitante)}</dd>
                  <dt>Solicitada</dt>
                  <dd>{formatearFecha(c.fechaSolicitud)}</dd>
                </dl>

                <button
                  className="pn-btn pn-btn-principal"
                  onClick={() => abrirRevision(c)}
                >
                  <LuClipboardCheck aria-hidden="true" />
                  Revisar
                </button>
              </article>
            ))}
          </div>
        )}
      </section>


      {/* HISTORIAL DE DICTÁMENES */}
      <section className="pn-seccion">
        <div className="pn-seccion-cabecera">
          <h2><LuHistory aria-hidden="true" />Mis dictámenes</h2>
        </div>

        {resueltas.length === 0 ? (
          <div className="pn-vacio">Todavía no has emitido dictámenes.</div>
        ) : (
          <ul className="pn-lista">
            {resueltas.map((c) => (
              <li className="pn-item" key={c._id}>
                <div className="pn-item-principal">
                  <strong>{c.tipoCertificacion} · {c.lote?.codigo}</strong>
                  <span>
                    {c.codigo}
                    {c.estado === "aprobada" &&
                      ` · Vence: ${formatearFecha(c.fechaVencimiento)}`}
                    {c.observaciones && ` · ${c.observaciones}`}
                  </span>
                </div>

                <div className="pn-acciones-rapidas" style={{ marginTop: 0 }}>
                  <span className={`pn-estado pn-estado-${c.estado}`}>
                    {NOMBRE_ESTADO_CERTIFICACION[c.estado] || c.estado}
                  </span>

                  {c.estado === "aprobada" && (
                    <button
                      className="pn-btn pn-btn-secundario"
                      onClick={() => descargarPDF(c)}
                    >
                      <LuDownload aria-hidden="true" />
                      PDF
                    </button>
                  )}

                  {c.estado === "aprobada" && (
                    <button
                      className={`pn-btn ${c.firma?.firmada ? "pn-btn-secundario" : "pn-btn-principal"}`}
                      onClick={() => setFirmando(c)}
                      title={c.firma?.firmada ? `Firmado por ${c.firma.firmante}` : "Firmar el certificado"}
                    >
                      {c.firma?.firmada ? <LuShieldCheck aria-hidden="true" /> : <LuSignature aria-hidden="true" />}
                      {c.firma?.firmada ? "Firmado" : "Firmar"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>


      {firmando && (
        <ModalFirma
          certificacion={firmando}
          onCerrar={() => setFirmando(null)}
          onListo={async (texto) => {
            setMensaje(texto);
            setFirmando(null);
            await cargar();
          }}
        />
      )}


      {/* MODAL DE REVISIÓN: datos del lote + dictamen */}
      {revisando && (
        <ModalDictamen
          certificacion={revisando}
          onCerrar={() => setRevisando(null)}
          onListo={dictamenListo}
        >
          <h3>Lote {revisando.lote?.codigo}</h3>

          {errorRevision && (
            <div className="pn-alerta pn-alerta-error">{errorRevision}</div>
          )}

          {cargandoDetalle ? (
            <p className="pn-ayuda">Cargando información del lote...</p>
          ) : detalleLote && (
            <dl className="gs-ficha">
              <dt>Producto</dt>
              <dd>{detalleLote.producto}</dd>
              <dt>Productor</dt>
              <dd>{nombreCompleto(detalleLote.productor)}</dd>
              <dt>Asociación</dt>
              <dd>{detalleLote.asociacion?.nombre || "—"}</dd>
              <dt>Cantidad</dt>
              <dd>{detalleLote.cantidad} {detalleLote.unidad || "kg"}</dd>
              <dt>Etapa</dt>
              <dd>{NOMBRE_ESTADO_LOTE[detalleLote.estado] || detalleLote.estado}</dd>
              <dt>Siembra</dt>
              <dd>{formatearFecha(detalleLote.fechaSiembra)}</dd>
            </dl>
          )}

          <h3>Historial de trazabilidad</h3>

          {!cargandoDetalle && historial.length === 0 ? (
            <p className="pn-ayuda">Este lote no tiene actividades registradas.</p>
          ) : (
            <ul className="pn-historial">
              {historial.map((e) => (
                <li key={e._id}>
                  <strong>{NOMBRE_TIPO_EVENTO[e.tipo] || e.tipo}</strong>
                  <span>{formatearFecha(e.fecha)} · {e.descripcion}</span>
                </li>
              ))}
            </ul>
          )}
        </ModalDictamen>
      )}

    </div>
  );
};

export default PanelCertificador;
