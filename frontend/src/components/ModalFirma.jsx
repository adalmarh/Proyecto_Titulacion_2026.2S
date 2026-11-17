import { useState } from "react";

import {
  LuDownload,
  LuSignature,
  LuUpload,
  LuCircleCheck,
  LuTriangleAlert,
  LuShieldCheck,
  LuKeyRound,
  LuQrCode,
  LuEye,
  LuEyeOff
} from "react-icons/lu";

import Modal from "./Modal";
import { VisorCertificado } from "./VistaPreviaCertificado";
import {
  descargarCertificadoPDF,
  firmarEnSistema,
  subirCertificadoFirmado
} from "../services/certificacionService";
import { formatearFechaHora } from "../utils/formatos";


// ==========================================================
// FIRMA DEL CERTIFICADO (solo el certificador asignado)
//
// Opción principal: FIRMAR EN EL SISTEMA (firma electrónica
// simple). El certificador confirma con su contraseña; el
// sistema sella los datos del certificado (huella SHA-256)
// y el PDF sale con un sello y un código QR para validar la
// firma. No se descarga ni se sube ningún archivo.
//
// Alternativa: descargar el PDF, firmarlo fuera del sistema
// (a mano y escaneado, en Word o con FirmaEC) y subirlo.
// ==========================================================

const TAMANO_MAXIMO = 10 * 1024 * 1024;

const TEXTO_TIPO = {
  sistema: "Firmado electrónicamente en RutaCacao",
  electronica: "Firmado electrónicamente (FirmaEC u otro firmador)",
  manuscrita: "Firmado a mano (PDF escaneado)"
};

const ModalFirma = ({ certificacion, onCerrar, onListo }) => {

  // Firma en el sistema
  const [password, setPassword] = useState("");
  const [declaro, setDeclaro] = useState(false);
  const [verPrevia, setVerPrevia] = useState(false);

  // Alternativa: subir el PDF firmado fuera del sistema
  const [archivo, setArchivo] = useState(null);
  const [confirmado, setConfirmado] = useState(false);

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState(null);

  const firma = resultado?.firma || certificacion.firma;
  const firmada = Boolean(firma?.firmada);
  const tipo = firma?.tipo || (firmada ? "electronica" : "");
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

  // ---------- Firmar en el sistema ----------
  const firmar = async (evento) => {
    evento.preventDefault();

    if (!declaro) {
      setError("Confirma que revisaste el certificado y que lo firmas.");
      return;
    }
    if (!password) {
      setError("Escribe tu contraseña para firmar.");
      return;
    }

    try {
      setEnviando(true);
      setError("");
      const datos = await firmarEnSistema(certificacion._id, password);
      setResultado(datos);
      setPassword("");
    } catch (err) {
      setError(err.response?.data?.mensaje || "No se pudo firmar el certificado");
    } finally {
      setEnviando(false);
    }
  };

  // ---------- Alternativa: subir el PDF firmado ----------
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
          <div className="gs-alerta gs-alerta-error" role="alert">
            <LuTriangleAlert aria-hidden="true" />
            {error}
          </div>
        )}

        {/* ---------- Ya firmado ---------- */}
        {firmada && (
          <div className="fm-estado">
            <LuShieldCheck aria-hidden="true" />
            <div>
              <strong>{resultado ? "Certificado firmado" : "Este certificado ya está firmado"}</strong>
              <span>
                {TEXTO_TIPO[tipo] || "Firmado"} por {firma.firmante || "—"}
                {(firma.fechaFirma || firma.fechaCarga) && ` el ${formatearFechaHora(firma.fechaFirma || firma.fechaCarga)}`}
                {tipo === "electronica" && firma.emisor && ` · Emisor del certificado: ${firma.emisor}`}
              </span>
              {tipo === "sistema" && firma.codigoFirma && (
                <span className="fm-codigo">Código de firma: <strong>{firma.codigoFirma}</strong></span>
              )}
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

        {resultado && (
          <div className="gs-botones-modal">
            <button type="button" className="gs-btn gs-btn-principal" onClick={() => onListo(resultado.mensaje)}>
              <LuCircleCheck aria-hidden="true" />
              Listo
            </button>
          </div>
        )}

        {/* ---------- Firmar en el sistema (opción principal) ---------- */}
        {!resultado && !firmada && (
          <form className="fs" onSubmit={firmar}>
            <div className="fs-cabecera">
              <LuQrCode aria-hidden="true" />
              <div>
                <strong>Firmar en el sistema</strong>
                <span>
                  Sin descargar ni subir archivos. El certificado sale con un sello de firma y un código QR
                  para que cualquiera compruebe que lo firmaste tú y que sus datos no cambiaron.
                </span>
              </div>
            </div>

            <button
              type="button"
              className="gs-btn gs-btn-secundario fs-ver"
              onClick={() => setVerPrevia((v) => !v)}
              aria-expanded={verPrevia}
            >
              {verPrevia ? <LuEyeOff aria-hidden="true" /> : <LuEye aria-hidden="true" />}
              {verPrevia ? "Ocultar el certificado" : "Ver el certificado antes de firmar"}
            </button>

            {verPrevia && <VisorCertificado certificacion={certificacion} alto="55vh" />}

            <ul className="fs-datos">
              <li>Se sellan los datos del certificado: lote, cantidad, fechas, análisis y grado INEN, resultado y observaciones.</li>
              <li>Si después alguien cambia uno de esos datos, la verificación lo mostrará.</li>
            </ul>

            <label className="fm-confirmar">
              <input type="checkbox" checked={declaro} onChange={(e) => setDeclaro(e.target.checked)} />
              <span>
                Revisé el certificado {certificacion.codigo || ""} y lo firmo electrónicamente como certificador.
              </span>
            </label>

            <div className="gs-campo fs-clave">
              <label htmlFor="fs-password">Tu contraseña de RutaCacao</label>
              <div className="fs-entrada">
                <LuKeyRound aria-hidden="true" />
                <input
                  id="fs-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <span className="gs-ayuda">La pedimos de nuevo para confirmar que quien firma eres tú.</span>
            </div>

            <div className="gs-botones-modal">
              <button type="button" className="gs-btn gs-btn-secundario" onClick={onCerrar} disabled={enviando}>
                Firmar después
              </button>
              <button type="submit" className="gs-btn gs-btn-principal" disabled={enviando || !declaro || !password}>
                <LuSignature aria-hidden="true" />
                {enviando ? "Firmando..." : "Firmar electrónicamente"}
              </button>
            </div>
          </form>
        )}

        {/* ---------- Alternativa: firmar fuera del sistema ---------- */}
        {!resultado && tipo !== "sistema" && (
          <details className="fm-alternativa">
            <summary>
              {firmada
                ? "Subir una nueva versión firmada fuera del sistema"
                : "Otra opción: firmar fuera del sistema (a mano o con FirmaEC)"}
            </summary>

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
                  <strong>Sube el PDF firmado</strong>
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
                  <button
                    type="button"
                    className="gs-btn gs-btn-secundario fm-subir"
                    onClick={subir}
                    disabled={enviando || !archivo || !confirmado}
                  >
                    <LuUpload aria-hidden="true" />
                    {enviando ? "Subiendo..." : "Subir PDF firmado"}
                  </button>
                </div>
              </li>
            </ol>
          </details>
        )}

        {!resultado && firmada && (
          <div className="gs-botones-modal">
            <button type="button" className="gs-btn gs-btn-secundario" onClick={onCerrar}>
              Cerrar
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ModalFirma;
