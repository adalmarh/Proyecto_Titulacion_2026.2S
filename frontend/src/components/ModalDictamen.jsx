import { useState } from "react";

import {
  LuCircleCheck,
  LuCircleX,
  LuTriangleAlert
} from "react-icons/lu";

import Modal from "./Modal";
import {
  aprobarCertificacion,
  rechazarCertificacion
} from "../services/certificacionService";


// ==========================================
// DICTAMEN DE UNA CERTIFICACIÓN
// Aprobar (con fecha de vencimiento) o
// rechazar (con motivo obligatorio).
// Lo usan el panel del certificador y la
// página de Certificaciones.
// ==========================================

// Hoy + 1 año en formato AAAA-MM-DD
const unAnio = () => {
  const fecha = new Date();
  fecha.setFullYear(fecha.getFullYear() + 1);
  return fecha.toISOString().slice(0, 10);
};

const hoy = () => new Date().toISOString().slice(0, 10);


const ModalDictamen = ({
  certificacion,
  onCerrar,
  onListo,
  soloRechazo = false,
  children
}) => {

  // Una solicitud aún sin certificador (pendiente) solo puede rechazarse
  const [dictamen, setDictamen] = useState(soloRechazo ? "rechazar" : "aprobar");
  const [vencimiento, setVencimiento] = useState(unAnio());
  const [resultado, setResultado] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const aprobar = dictamen === "aprobar";


  const enviar = async (evento) => {
    evento.preventDefault();
    setError("");

    if (!aprobar && !observaciones.trim()) {
      setError("Indica el motivo del rechazo en las observaciones.");
      return;
    }

    try {
      setEnviando(true);

      if (aprobar) {
        await aprobarCertificacion(certificacion._id, {
          fechaVencimiento: vencimiento || undefined,
          observaciones: observaciones.trim() || undefined,
          resultadoInspeccion: resultado.trim() || undefined
        });
      } else {
        await rechazarCertificacion(
          certificacion._id,
          observaciones.trim(),
          resultado.trim() || undefined
        );
      }

      onListo(
        aprobar
          ? `Certificación ${certificacion.codigo || ""} aprobada correctamente`
          : `Certificación ${certificacion.codigo || ""} rechazada`
      );

    } catch (err) {
      setError(
        err.response?.data?.mensaje ||
        "No se pudo registrar el dictamen"
      );
    } finally {
      setEnviando(false);
    }
  };


  return (
    <Modal
      titulo="Dictamen de certificación"
      subtitulo={`${certificacion.tipoCertificacion} · ${certificacion.codigo || ""}`}
      onCerrar={onCerrar}
      bloqueado={enviando}
      ancho={Boolean(children)}
    >
      <div className={children ? "gs-dictamen gs-dictamen-doble" : "gs-dictamen"}>

        {/* Información adicional (lote, historial...) */}
        {children && <div className="gs-dictamen-info">{children}</div>}

        <form className="gs-formulario gs-dictamen-form" onSubmit={enviar}>

          {error && (
            <div className="gs-alerta gs-alerta-error">
              <LuTriangleAlert aria-hidden="true" />
              {error}
            </div>
          )}

          <div className="gs-opciones" role="radiogroup" aria-label="Dictamen">
            {!soloRechazo && (
            <label className={`gs-opcion ${aprobar ? "gs-opcion-aprobar" : ""}`}>
              <input
                type="radio"
                name="dictamen"
                checked={aprobar}
                onChange={() => setDictamen("aprobar")}
              />
              <LuCircleCheck aria-hidden="true" />
              Aprobar
            </label>
            )}

            <label className={`gs-opcion ${!aprobar ? "gs-opcion-rechazar" : ""}`}>
              <input
                type="radio"
                name="dictamen"
                checked={!aprobar}
                onChange={() => setDictamen("rechazar")}
              />
              <LuCircleX aria-hidden="true" />
              Rechazar
            </label>
          </div>

          <div className="gs-campos">

            {aprobar && (
              <div className="gs-campo gs-campo-ancho">
                <label htmlFor="d-vencimiento">Fecha de vencimiento</label>
                <input
                  id="d-vencimiento"
                  type="date"
                  value={vencimiento}
                  min={hoy()}
                  onChange={(e) => setVencimiento(e.target.value)}
                />
                <span className="gs-ayuda">Por defecto, un año desde hoy.</span>
              </div>
            )}

            <div className="gs-campo gs-campo-ancho">
              <label htmlFor="d-resultado">Resultado de la inspección</label>
              <input
                id="d-resultado"
                value={resultado}
                onChange={(e) => setResultado(e.target.value)}
                placeholder="Ej.: Visita a finca el 12/10, muestras conformes"
              />
            </div>

            <div className="gs-campo gs-campo-ancho">
              <label htmlFor="d-observaciones">
                Observaciones{!aprobar && " (obligatorias)"}
              </label>
              <textarea
                id="d-observaciones"
                rows={4}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder={
                  aprobar
                    ? "Comentarios para el productor (opcional)"
                    : "Explica qué requisito no se cumple"
                }
                required={!aprobar}
              />
            </div>

          </div>

          <div className="gs-botones-modal">
            <button
              type="button"
              className="gs-btn gs-btn-secundario"
              onClick={onCerrar}
              disabled={enviando}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className={`gs-btn ${aprobar ? "gs-btn-principal" : "gs-btn-rechazo"}`}
              disabled={enviando}
            >
              {enviando
                ? "Enviando..."
                : aprobar
                  ? "Aprobar certificación"
                  : "Rechazar certificación"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default ModalDictamen;
