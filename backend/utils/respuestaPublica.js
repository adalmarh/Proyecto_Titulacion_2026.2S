// ======================================================
// RESPUESTA PÚBLICA DEL QR
// ------------------------------------------------------
// Prepara SOLO la información que puede ver cualquier
// persona que escanea el código QR (consumidor final),
// sin iniciar sesión.
//
// No se publican: cédula, teléfono ni correo del
// productor; correos de usuarios; identificadores
// internos; ni certificaciones rechazadas o pendientes
// con sus observaciones.
// ======================================================

const { datosEmpresa } = require("./empresa");

const nombrePersona = (persona) =>
  persona
    ? {
      nombre: persona.nombre || "",
      apellido: persona.apellido || ""
    }
    : null;


// Una certificación aprobada está vigente si no tiene
// fecha de vencimiento o si esa fecha aún no ha pasado.
const estaVigente = (certificacion, ahora) =>
  !certificacion.fechaVencimiento ||
  new Date(certificacion.fechaVencimiento) >= ahora;


const certificacionPublica = (certificacion, ahora) => ({
  codigo: certificacion.codigo || null,
  tipoCertificacion: certificacion.tipoCertificacion,
  fechaEmision: certificacion.fechaEmision || null,
  fechaVencimiento: certificacion.fechaVencimiento || null,
  vigente: estaVigente(certificacion, ahora),
  observaciones: certificacion.observaciones || "",
  certificador: nombrePersona(certificacion.certificador),
  // Firma del certificado PDF (manuscrita o electrónica)
  firmada: Boolean(certificacion.firma?.firmada),
  firmante: certificacion.firma?.firmada ? certificacion.firma.firmante || "" : "",
  tipoFirma: certificacion.firma?.firmada ? certificacion.firma.tipo || "electronica" : "",
  codigoVerificacion: certificacion.codigoVerificacion || null
});


const armarRespuestaPublica = ({
  lote,
  eventos = [],
  certificaciones = [],
  codigoQR,
  ahora = new Date()
}) => {

  // ---------- Certificaciones ----------
  const aprobadas = certificaciones
    .filter((c) => c.estado === "aprobada")
    .map((c) => certificacionPublica(c, ahora))
    .sort(
      (a, b) =>
        new Date(b.fechaEmision || 0) - new Date(a.fechaEmision || 0)
    );

  const vigente = aprobadas.find((c) => c.vigente) || null;

  const enTramite = certificaciones.some(
    (c) => c.estado === "pendiente" || c.estado === "en_revision"
  );

  let estadoCertificacion = "sin_certificacion";

  if (vigente) {
    estadoCertificacion = "vigente";
  } else if (aprobadas.length > 0) {
    estadoCertificacion = "vencida";
  } else if (enTramite) {
    estadoCertificacion = "en_tramite";
  }


  // ---------- Respuesta ----------
  return {
    mensaje: "Información pública del lote obtenida correctamente",

    lote: {
      codigo: lote.codigo,
      producto: lote.producto,
      descripcion: lote.descripcion || "",
      ubicacion: lote.ubicacion || {},
      fechaSiembra: lote.fechaSiembra || null,
      fechaEstimadaCosecha: lote.fechaEstimadaCosecha || null,
      fechaCosecha: lote.fechaCosecha || null,
      cantidad: lote.cantidad,
      unidad: lote.unidad || "kg",
      estado: lote.estado,
      activo: lote.activo !== false
    },

    productor: nombrePersona(lote.productor),

    // Empresa a la que pertenecen todos los productores
    empresa: datosEmpresa(),

    trazabilidad: {
      totalEventos: eventos.length,
      eventos: eventos.map((e) => ({
        tipo: e.tipo,
        descripcion: e.descripcion,
        fecha: e.fecha,
        ubicacion: e.ubicacion || "",
        evidencia: e.evidencia || "",
        responsable: e.responsable
          ? {
            ...nombrePersona(e.responsable),
            rol: e.responsable.rol || ""
          }
          : null
      }))
    },

    certificacion: {
      estado: estadoCertificacion,
      vigente
    },

    certificaciones: aprobadas,

    qr: {
      totalEscaneos: codigoQR.totalEscaneos || 0,
      ultimoEscaneo: codigoQR.ultimoEscaneo || null
    }
  };
};


module.exports = {
  armarRespuestaPublica,
  estaVigente
};
