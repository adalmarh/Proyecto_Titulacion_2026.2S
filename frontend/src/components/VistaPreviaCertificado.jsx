import { useEffect, useState } from "react";

import {
  LuDownload,
  LuExternalLink,
  LuTriangleAlert
} from "react-icons/lu";

import Modal from "./Modal";
import { obtenerCertificadoPDF } from "../services/certificacionService";


// ==========================================================
// VISTA PREVIA DEL CERTIFICADO PDF
// Muestra el PDF dentro del sistema, sin descargarlo.
//  - VisorCertificado: el visor solo (se usa dentro de la
//    ventana de firma, para revisar antes de firmar).
//  - VistaPreviaCertificado: el visor en una ventana propia
//    (botón «Ver» de las listas).
// Si el navegador no puede mostrar PDF dentro de la página
// (algunos celulares Android), ofrece abrirlo en otra pestaña.
// ==========================================================

export const VisorCertificado = ({ certificacion, original = false, alto = "70vh" }) => {

  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const nombre = `${certificacion.codigo || "certificado"}${certificacion.firma?.firmada && !original ? "-firmado" : ""}.pdf`;

  // navigator.pdfViewerEnabled es false en navegadores que
  // no muestran PDF dentro de la página
  const puedeMostrar = typeof navigator === "undefined" || navigator.pdfViewerEnabled !== false;

  useEffect(() => {
    let creada = "";
    let vigente = true;

    obtenerCertificadoPDF(certificacion._id, { original })
      .then((blob) => {
        creada = window.URL.createObjectURL(blob);
        if (vigente) setUrl(creada);
        else window.URL.revokeObjectURL(creada);
      })
      .catch(() => vigente && setError("No se pudo cargar el certificado."));

    return () => {
      vigente = false;
      if (creada) window.URL.revokeObjectURL(creada);
    };
  }, [certificacion._id, original]);

  if (error) {
    return (
      <div className="gs-alerta gs-alerta-error" role="alert">
        <LuTriangleAlert aria-hidden="true" />
        {error}
      </div>
    );
  }

  if (!url) {
    return <p className="vp-cargando" role="status">Cargando el certificado…</p>;
  }

  return (
    <div className="vp">
      {puedeMostrar ? (
        <iframe
          className="vp-marco"
          src={`${url}#toolbar=1&view=FitH`}
          title={`Vista previa del certificado ${certificacion.codigo || ""}`}
          style={{ height: alto }}
        />
      ) : (
        <p className="vp-aviso">
          Este navegador no muestra PDF dentro de la página. Ábrelo en otra pestaña para verlo.
        </p>
      )}

      <div className="vp-acciones">
        <a className="gs-btn gs-btn-secundario" href={url} target="_blank" rel="noreferrer">
          <LuExternalLink aria-hidden="true" />
          Abrir en otra pestaña
        </a>
        <a className="gs-btn gs-btn-secundario" href={url} download={nombre}>
          <LuDownload aria-hidden="true" />
          Descargar
        </a>
      </div>
    </div>
  );
};


const VistaPreviaCertificado = ({ certificacion, onCerrar }) => (
  <Modal
    titulo="Vista previa del certificado"
    subtitulo={`${certificacion.codigo || ""} · ${certificacion.tipoCertificacion || ""}${certificacion.firma?.firmada ? " · firmado" : " · sin firmar"}`}
    onCerrar={onCerrar}
    ancho
    clase="gs-modal-pdf"
  >
    <div className="gs-formulario">
      <VisorCertificado certificacion={certificacion} />
    </div>
  </Modal>
);

export default VistaPreviaCertificado;
