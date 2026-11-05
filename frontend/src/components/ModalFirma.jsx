import { useState } from "react";

import {
  LuDownload,
  LuSignature,
  LuUpload,
  LuCircleCheck,
  LuTriangleAlert,
  LuShieldCheck
} from "react-icons/lu";

import Modal from "./Modal";
import {
  descargarCertificadoPDF,
  subirCertificadoFirmado
} from "../services/certificacionService";
import { formatearFechaHora } from "../utils/formatos";


// ==========================================================
// FIRMA DEL CERTIFICADO PDF (solo el certificador asignado)
// El certificador descarga el PDF, lo firma como prefiera
// y sube el PDF firmado:
//   - lo imprime, lo firma a mano y lo escanea;
//   - o le pone su firma escaneada en Word y lo guarda como PDF;
//   - o, si tiene, lo firma electrónicamente con FirmaEC.
// Antes de subirlo confirma que el documento ya tiene su firma.
// ==========================================================

const TAMANO_MAXIMO = 10 * 1024 * 1024;

const ModalFirma = ({ certificacion, onCerrar, onListo }) => {

  const [archivo, setArchivo] = useState(null);
  const [confirmado, setConfirmado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState(null);

  const firma = resultado?.firma || certificacion.firma;
  const firmada = Boolean(firma?.firmada);
  const electronica = firma?.tipo === "electronica" || (firmada && !firma?.tipo);
  const nombre = certificacion.codigo || "certificado";


  const descargar = async (original) => {
    try {
      setError("");
      await descargarCertificadoPDF(
        certificacion._id,
        original ? `${nombre}.pdf` : `${nombre}-firmado.pdf`,
        { original }
      );
    } catch {
      setError("No se pudo descargar el PDF");
    }
  };

  const elegir = (evento) => {
    const elegido = evento.target.files?.[0] || null;
    setError("");

    if (elegido && !/\.pdf$/i.test(elegido.name)) {
      setError("El archivo debe ser un PDF. Si escaneaste con el celular, guarda el escaneo como PDF.");
      setArchivo(null);
      return;
    }

    if (elegido && elegido.size > TAMANO_MAXIMO) {
      setError("El PDF supera el tamaño máximo de 10 MB. Escanéalo con menor resolución.");
      setArchivo(null);
      return;
    }

    setArchivo(elegido);
  };

  const subir = async () => {
    if (!archivo) {
      setError("Selecciona el PDF firmado.");
      return;
    }

    if (!confirmado) {
      setError("Confirma que el documento ya contiene tu firma.");
      return;
    }

    try {
      setEnviando(true);
      setError("");
      const datos = await subirCertificadoFirmado(certificacion._id, archivo);
      setResultado(datos);
      setArchivo(null);
      setConfirmado(false);
    } catch (err) {
      setError(err.response?.data?.mensaje || "No se pudo subir el PDF firmado");
    } finally {
      setEnviando(false);
    }
  };


  return (
    <Modal
      titulo="Firma del certificado"
      subtitulo={`${certificacion.codigo || ""} · ${certificacion.tipoCertificacion}`}
      onCerrar={resultado ? () => onListo(resultado.mensaje) : onCerrar}
      bloqueado={enviando}
      ancho
    >
      <div className="gs-formulario">

        {error && (
          <div className="gs-alerta gs-alerta-error">
            <LuTriangleAlert aria-hidden="true" />
            {error}
          </div>
        )}

        {/* ---------- Estado actual ---------- */}
        {firmada && (
          <div className="fm-estado">
            <LuShieldCheck aria-hidden="true" />
            <div>
              <strong>{resultado ? "PDF firmado guardado" : "Este certificado ya está firmado"}</strong>
              <span>
                {electronica ? "Firmado electrónicamente" : "Firmado"} por {firma.firmante || "—"}
                {(firma.fechaFirma || firma.fechaCarga) && ` el ${formatearFechaHora(firma.fechaFirma || firma.fechaCarga)}`}
                {electronica && firma.emisor && ` · Emisor del certificado: ${firma.emisor}`}
              </span>
            </div>
            <button type="button" className="gs-btn gs-btn-secundario" onClick={() => descargar(false)}>
              <LuDownload aria-hidden="true" />
              PDF firmado
            </button>
          </div>
        )}

        {resultado?.advertencias?.length > 0 && (
          <div className="gs-alerta fm-avisos">
            <LuTriangleAlert aria-hidden="true" />
            <ul>
              {resultado.advertencias.map((a) => <li key={a}>{a}</li>)}
            </ul>
          </div>
        )}

        {resultado ? (
          <div className="gs-botones-modal">
            <button type="button" className="gs-btn gs-btn-principal" onClick={() => onListo(resultado.mensaje)}>
              <LuCircleCheck aria-hidden="true" />
              Listo
            </button>
          </div>
        ) : (
          <>
            {/* ---------- Pasos ---------- */}
            <ol className="fm-pasos">
              <li>
                <div>
                  <strong>Descarga el certificado sin firmar</strong>
                  <span>Es el PDF que generó el sistema, con el recuadro para tu firma y el QR de verificación.</span>
                </div>
                <button type="button" className="gs-btn gs-btn-secundario" onClick={() => descargar(true)}>
                  <LuDownload aria-hidden="true" />
                  Descargar PDF
                </button>
              </li>

              <li>
                <div>
                  <strong>Fírmalo</strong>
                  <span>
                    Imprímelo, fírmalo a mano en el recuadro y escanéalo como PDF (sirve una app de
                    escaneo del celular), o ábrelo en Word, coloca tu firma y guárdalo como PDF.
                    Si tienes firma electrónica, también puedes firmarlo con FirmaEC.
                  </span>
                </div>
              </li>

              <li>
                <div>
                  <strong>{firmada ? "Sube una nueva versión firmada (opcional)" : "Sube el PDF firmado"}</strong>
                  <span>Debe ser un PDF de máximo 10 MB.</span>
                  <label className="fm-archivo">
                    <input type="file" accept="application/pdf,.pdf" onChange={elegir} />
                    <LuSignature aria-hidden="true" />
                    {archivo ? archivo.name : "Elegir el PDF firmado…"}
                  </label>
                  <label className="fm-confirmar">
                    <input
                      type="checkbox"
                      checked={confirmado}
                      onChange={(e) => setConfirmado(e.target.checked)}
                    />
                    <span>
                      Confirmo que este documento es el certificado {certificacion.codigo || ""} y que
                      contiene mi firma como certificador.
                    </span>
                  </label>
                </div>
              </li>
            </ol>

            <div className="gs-botones-modal">
              <button type="button" className="gs-btn gs-btn-secundario" onClick={onCerrar} disabled={enviando}>
                Cerrar
              </button>
              <button
                type="button"
                className="gs-btn gs-btn-principal"
                onClick={subir}
                disabled={enviando || !archivo || !confirmado}
              >
                <LuUpload aria-hidden="true" />
                {enviando ? "Subiendo..." : "Subir PDF firmado"}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default ModalFirma;
