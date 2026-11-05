import api from "./api";

// ==========================================
// OBTENER TODAS LAS CERTIFICACIONES
// ==========================================
export const obtenerCertificaciones = async () => {
  const respuesta = await api.get(
    "/certificaciones"
  );

  return respuesta.data;
};

// ==========================================
// OBTENER CERTIFICACIÓN POR ID
// ==========================================
export const obtenerCertificacion = async (id) => {
  const respuesta = await api.get(
    `/certificaciones/${id}`
  );

  return respuesta.data;
};

// ==========================================
// OBTENER CERTIFICACIONES DE UN LOTE
// ==========================================
export const obtenerCertificacionesPorLote = async (
  loteId
) => {
  const respuesta = await api.get(
    `/certificaciones/lote/${loteId}`
  );

  return respuesta.data;
};

// ==========================================
// SOLICITAR CERTIFICACIÓN
// ==========================================
export const crearCertificacion = async (datos) => {
  const respuesta = await api.post(
    "/certificaciones",
    datos
  );

  return respuesta.data;
};

// ==========================================
// ASIGNAR CERTIFICADOR
// ==========================================
export const asignarCertificador = async (
  id,
  certificador
) => {
  const respuesta = await api.patch(
    `/certificaciones/${id}/asignar-certificador`,
    {
      certificador
    }
  );

  return respuesta.data;
};

// ==========================================
// APROBAR CERTIFICACIÓN
// ==========================================
export const aprobarCertificacion = async (
  id,
  datos = {}
) => {
  const respuesta = await api.patch(
    `/certificaciones/${id}/aprobar`,
    datos
  );

  return respuesta.data;
};

// ==========================================
// RECHAZAR CERTIFICACIÓN
// ==========================================
export const rechazarCertificacion = async (
  id,
  observaciones,
  resultadoInspeccion
) => {
  const respuesta = await api.patch(
    `/certificaciones/${id}/rechazar`,
    {
      observaciones,
      resultadoInspeccion
    }
  );

  return respuesta.data;
};

// ==========================================
// DESCARGAR CERTIFICADO PDF
// Se pide como archivo (blob) porque la ruta
// exige el token de sesión. Si ya está firmado,
// el backend entrega la versión firmada; con
// { original: true } se descarga el PDF sin
// firmar (el que se imprime o se firma).
// ==========================================
export const descargarCertificadoPDF = async (
  id,
  nombreArchivo = "certificado.pdf",
  { original = false } = {}
) => {
  const respuesta = await api.get(
    `/certificaciones/${id}/pdf`,
    {
      responseType: "blob",
      params: original ? { version: "original" } : undefined
    }
  );

  const url = window.URL.createObjectURL(
    new Blob([respuesta.data], { type: "application/pdf" })
  );

  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();

  window.URL.revokeObjectURL(url);
};

// ==========================================
// SUBIR EL CERTIFICADO FIRMADO
// Firma manuscrita escaneada, en Word o electrónica.
// Se envía el PDF tal cual (sin formularios) y la
// confirmación de que ya contiene la firma.
// ==========================================
export const subirCertificadoFirmado = async (id, archivo) => {
  const respuesta = await api.post(
    `/certificaciones/${id}/firma`,
    archivo,
    {
      headers: { "Content-Type": "application/pdf" },
      params: { confirmo: "si" }
    }
  );

  return respuesta.data;
};
