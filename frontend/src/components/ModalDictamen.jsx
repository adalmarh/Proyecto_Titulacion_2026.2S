import { useMemo, useState } from "react";

import {
  LuCircleCheck,
  LuCircleX,
  LuTriangleAlert,
  LuFlaskConical,
  LuExternalLink
} from "react-icons/lu";

import Modal from "./Modal";
import {
  aprobarCertificacion,
  rechazarCertificacion
} from "../services/certificacionService";
import {
  NORMA,
  PARAMETROS_INEN,
  REQUISITOS_GENERALES_INEN,
  textoLimite,
  evaluarAnalisisInen,
  analisisParaEnviar
} from "../utils/normaInen176";

const analisisVacio = {
  ...Object.fromEntries(PARAMETROS_INEN.map((p) => [p.clave, ""])),
  ...Object.fromEntries(REQUISITOS_GENERALES_INEN.map((r) => [r.clave, false]))
};

const TEXTO_GRADO = { 0: "No cumple", 1: "Grado 1", 2: "Grado 2", 3: "Grado 3" };


// ==========================================
// DICTAMEN DE UNA CERTIFICACIÓN
// Aprobar (con fecha de vencimiento y el
// análisis de calidad según la NTE INEN 176)
// o rechazar (con motivo obligatorio).
// Lo usan el panel del certificador y la
// página de Certificaciones.
// ==========================================

// Hoy + 1 año en formato AAAA-MM-DD
const unAnio = () => {
  const fecha = new Date();
  fecha.setFullYear(fecha.getFullYear() + 1);
  return fecha.toISOString().slice(0, 10);
};


// Primer día que se puede elegir como vencimiento (mañana):
// una certificación no puede nacer vencida.
const manana = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};


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
  const [analisis, setAnalisis] = useState(analisisVacio);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const aprobar = dictamen === "aprobar";

  const evaluacion = useMemo(() => evaluarAnalisisInen(analisis), [analisis]);

  const cambiarAnalisis = (clave, valor) =>
    setAnalisis((anterior) => ({ ...anterior, [clave]: valor }));


  const enviar = async (evento) => {
    evento.preventDefault();
    setError("");

    if (!aprobar && !observaciones.trim()) {
      setError("Indica el motivo del rechazo en las observaciones.");
      return;
    }

    if (aprobar && evaluacion.estado !== "cumple") {
      setError(
        evaluacion.estado === "incompleto"
          ? "Completa el análisis de calidad según la NTE INEN 176 para poder aprobar."
          : "Según la NTE INEN 176 el lote no cumple: registra el dictamen como rechazo."
      );
      return;
    }

    try {
      setEnviando(true);

      if (aprobar) {
        await aprobarCertificacion(certificacion._id, {
          fechaVencimiento: vencimiento || undefined,
          observaciones: observaciones.trim() || undefined,
          resultadoInspeccion: resultado.trim() || undefined,
          analisisInen: analisisParaEnviar(analisis)
        });
      } else {
        await rechazarCertificacion(
          certificacion._id,
          observaciones.trim(),
          resultado.trim() || undefined,
          // al rechazar, el análisis se guarda solo si está completo
          evaluacion.estado === "incompleto" ? undefined : analisisParaEnviar(analisis)
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
                  min={manana()}
                  onChange={(e) => setVencimiento(e.target.value)}
                />
                <span className="gs-ayuda">Por defecto, un año desde hoy.</span>
              </div>
            )}

            {/* ANÁLISIS SEGÚN LA NTE INEN 176:2021 */}
            <fieldset className="gs-campo-ancho inen">
              <legend>
                <LuFlaskConical aria-hidden="true" />
                Análisis de calidad · {NORMA.codigo}
                {!aprobar && <span className="inen-opcional"> (opcional)</span>}
              </legend>
              <p className="gs-ayuda">
                Resultados de la muestra del lote (prueba de corte de 100 granos).
                El grado se calcula con la Tabla 1 de la norma.{" "}
                <a href="/normativa/inen-176" target="_blank" rel="noreferrer">
                  Ver norma y parámetros <LuExternalLink aria-hidden="true" />
                </a>
              </p>

              <div className="inen-filas">
                {PARAMETROS_INEN.map((p, i) => {
                  const grado = evaluacion.grados[i];
                  return (
                    <div className="inen-fila" key={p.clave}>
                      <label htmlFor={`inen-${p.clave}`}>
                        {p.nombre}
                        <span className="gs-ayuda">G1: {textoLimite(p, 0)} · G3: {textoLimite(p, 2)}</span>
                      </label>
                      <div className="inen-valor">
                        <input
                          id={`inen-${p.clave}`}
                          inputMode="decimal"
                          value={analisis[p.clave]}
                          onChange={(e) => cambiarAnalisis(p.clave, e.target.value)}
                          aria-describedby={`inen-g-${p.clave}`}
                        />
                        <span>{p.unidad}</span>
                      </div>
                      <span id={`inen-g-${p.clave}`} className={`inen-grado inen-g${grado ?? "x"}`}>
                        {grado === null ? "—" : TEXTO_GRADO[grado]}
                      </span>
                    </div>
                  );
                })}
              </div>

              {REQUISITOS_GENERALES_INEN.map((r) => (
                <label className="inen-casilla" key={r.clave}>
                  <input
                    type="checkbox"
                    checked={analisis[r.clave]}
                    onChange={(e) => cambiarAnalisis(r.clave, e.target.checked)}
                  />
                  {r.nombre}
                </label>
              ))}

              <div className={`inen-resultado inen-resultado-${evaluacion.estado}`} role="status">
                {evaluacion.estado === "cumple" && (
                  <><LuCircleCheck aria-hidden="true" /> Cumple la norma · <strong>Grado {evaluacion.grado}</strong></>
                )}
                {evaluacion.estado === "incompleto" && (
                  <>Faltan {evaluacion.faltan} {evaluacion.faltan === 1 ? "valor" : "valores"} para calcular el grado</>
                )}
                {evaluacion.estado === "no_cumple" && (
                  <><LuCircleX aria-hidden="true" /> No cumple: {evaluacion.motivos.join(", ")}</>
                )}
              </div>
            </fieldset>

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
              disabled={enviando || (aprobar && evaluacion.estado !== "cumple")}
              title={aprobar && evaluacion.estado !== "cumple" ? "Completa un análisis que cumpla la NTE INEN 176" : undefined}
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
