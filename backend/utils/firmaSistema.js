// ==========================================================
// FIRMA ELECTRÓNICA DEL SISTEMA (simulada)
// ----------------------------------------------------------
// El certificador firma el certificado DENTRO de RutaCacao,
// sin descargar ni subir archivos:
//
//  1. Vuelve a escribir su contraseña: prueba que quien firma
//     es el titular de la cuenta (no basta con tener la
//     sesión abierta).
//  2. El sistema arma el «contenido firmado»: los datos del
//     certificado que aparecen en el PDF (código, lote,
//     cantidad, fechas, grado y análisis INEN, resultado,
//     observaciones, certificador y fecha de la firma).
//  3. Calcula la HUELLA SHA-256 de ese contenido. Si cambia
//     un solo dato, la huella cambia por completo.
//  4. Sella la huella con HMAC-SHA256 y una clave secreta del
//     servidor (FIRMA_SECRETO). Sin esa clave nadie puede
//     fabricar un sello válido, ni siquiera conociendo los
//     datos.
//  5. El PDF muestra un sello con código QR; al escanearlo,
//     la página de verificación recalcula la huella y el
//     sello y dice si la firma es válida y si los datos
//     siguen siendo los mismos que se firmaron.
//
// IMPORTANTE: es una firma electrónica SIMPLE del sistema.
// No reemplaza una firma electrónica con certificado emitido
// por una entidad de certificación acreditada en Ecuador
// (por ejemplo, la que se usa con FirmaEC).
// ==========================================================

const crypto = require("crypto");

const VERSION = 1;

class ErrorFirma extends Error {
  constructor(mensaje, estado = 400) {
    super(mensaje);
    this.estado = estado;
  }
}


// Clave para sellar. Debe ser fija: si cambia, las firmas
// anteriores dejan de verificarse.
const secreto = () => {
  const clave = process.env.FIRMA_SECRETO || process.env.JWT_SECRET;
  if (!clave) {
    throw new ErrorFirma("Falta FIRMA_SECRETO en la configuración del servidor", 500);
  }
  return clave;
};


const idDe = (valor) => (valor && valor._id ? String(valor._id) : valor ? String(valor) : null);
const fechaISO = (valor) => (valor ? new Date(valor).toISOString() : null);

const nombreDe = (persona) =>
  persona && typeof persona === "object"
    ? `${persona.nombre || ""} ${persona.apellido || ""}`.trim()
    : "";


// JSON con las claves siempre en el mismo orden, para que la
// misma información dé siempre la misma huella.
const jsonEstable = (valor) => {
  if (Array.isArray(valor)) return `[${valor.map(jsonEstable).join(",")}]`;
  if (valor && typeof valor === "object" && !(valor instanceof Date)) {
    return `{${Object.keys(valor).sort().map((k) => `${JSON.stringify(k)}:${jsonEstable(valor[k])}`).join(",")}}`;
  }
  return JSON.stringify(valor === undefined ? null : valor);
};


// Los datos del certificado que quedan firmados.
// No incluye el estado (aprobada → vencida cambia sola con el
// tiempo) ni la etapa del lote (avanza después de certificar).
const contenidoFirmado = (certificacion, { firmante, idFirmante, fechaFirma }) => {
  const lote = certificacion.lote && typeof certificacion.lote === "object" ? certificacion.lote : {};
  const datos = certificacion.datosCertificacion || {};
  const analisis = datos.analisisInen || {};

  const valoresAnalisis = {};
  for (const clave of [
    "humedad", "peso100Granos", "bienFermentados", "violetas", "pizarrosos", "mohosos",
    "defectuosos", "materialRelacionado", "materiaExtrana", "sinHumo", "sinInfestacion"
  ]) {
    valoresAnalisis[clave] = analisis[clave] ?? null;
  }

  return {
    v: VERSION,
    sistema: "RutaCacao",
    certificacion: idDe(certificacion._id),
    codigo: certificacion.codigo || null,
    codigoVerificacion: certificacion.codigoVerificacion || null,
    tipo: certificacion.tipoCertificacion || null,
    fechaEmision: fechaISO(certificacion.fechaEmision),
    fechaVencimiento: fechaISO(certificacion.fechaVencimiento),
    lote: {
      id: idDe(lote._id || certificacion.lote),
      codigo: lote.codigo || null,
      cantidadKg: lote.cantidad ?? null,
      estadoGrano: lote.estadoGrano || null,
      productor: idDe(lote.productor)
    },
    analisis: {
      norma: analisis.norma || null,
      grado: analisis.grado ?? null,
      ...valoresAnalisis
    },
    resultadoInspeccion: datos.resultadoInspeccion || null,
    observaciones: certificacion.observaciones || null,
    certificador: idDe(certificacion.certificador),
    firmante,
    idFirmante: idDe(idFirmante),
    fechaFirma: fechaISO(fechaFirma)
  };
};


const calcularHuella = (contenido) =>
  crypto.createHash("sha256").update(jsonEstable(contenido), "utf8").digest("hex");

const calcularSello = (huella) =>
  crypto.createHmac("sha256", secreto()).update(huella).digest("hex");

// Código corto para leer en el PDF: 4 grupos de 4 caracteres
const codigoDeFirma = (huella) =>
  huella.slice(0, 16).toUpperCase().match(/.{4}/g).join("-");


// Firma: devuelve lo que se guarda en certificacion.firma
const firmarCertificacion = (certificacion, usuario, fechaFirma = new Date()) => {
  const firmante = nombreDe(usuario);
  const contenido = contenidoFirmado(certificacion, { firmante, idFirmante: usuario._id, fechaFirma });
  const huella = calcularHuella(contenido);

  return {
    firmada: true,
    tipo: "sistema",
    firmante,
    identificacion: "",
    emisor: "RutaCacao",
    autofirmado: false,
    fechaFirma,
    certificadoHasta: null,
    sha256: huella,
    sello: calcularSello(huella),
    codigoFirma: codigoDeFirma(huella),
    version: VERSION
  };
};


// Verifica una firma del sistema con los datos ACTUALES.
//   valida : el sello corresponde a la huella guardada (la
//            firma la hizo este sistema y no se falsificó)
//   integra: los datos actuales dan la misma huella (no
//            cambiaron después de firmar)
const verificarFirma = (certificacion) => {
  const firma = certificacion.firma || {};

  if (!firma.firmada || firma.tipo !== "sistema" || !firma.sha256 || !firma.sello) {
    return { aplica: false };
  }

  const esperado = Buffer.from(calcularSello(firma.sha256), "hex");
  const guardado = Buffer.from(String(firma.sello), "hex");
  const valida = esperado.length === guardado.length && crypto.timingSafeEqual(esperado, guardado);

  const huellaActual = calcularHuella(
    contenidoFirmado(certificacion, {
      firmante: firma.firmante,
      idFirmante: firma.subidoPor,
      fechaFirma: firma.fechaFirma
    })
  );

  return {
    aplica: true,
    valida,
    integra: valida && huellaActual === firma.sha256,
    codigoFirma: firma.codigoFirma
  };
};


module.exports = {
  ErrorFirma,
  jsonEstable,
  contenidoFirmado,
  calcularHuella,
  codigoDeFirma,
  firmarCertificacion,
  verificarFirma
};
