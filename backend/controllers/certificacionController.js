const Certificacion =
  require("../models/Certificacion");

const Lote =
  require("../models/Lote");

const Usuario =
  require("../models/Usuario");

const crypto = require("crypto");
const { datosEmpresa } = require("../utils/empresa");
const {
  ErrorAnalisis,
  evaluarAnalisis,
  analisisParaGuardar
} = require("../utils/normaInen176");
const {
  DIAS_AVISO,
  diasParaVencer,
  filtroPorVencer,
  marcarCertificacionesVencidas
} = require("../utils/vencimientos");

const generarCertificadoPDF =
  require("../utils/generarCertificadoPDF");

const CertificadoFirmado =
  require("../models/CertificadoFirmado");

const {
  analizarFirmaPdf,
  perteneceACertificacion,
  nombreCoincide
} = require("../utils/firmaPdf");

const {
  filtroCertificaciones
} = require("../middleware/alcanceMiddleware");


// ==========================================
// SOLICITAR CERTIFICACIÓN
// ==========================================

const solicitarCertificacion = async (
  req,
  res
) => {

  try {

    const {
      lote,
      tipoCertificacion,
      datosCertificacion,
      observaciones
    } = req.body;


    // ========================================
    // VALIDACIONES
    // ========================================

    if (
      !lote ||
      !tipoCertificacion
    ) {

      return res.status(400).json({

        mensaje:
          "El lote y el tipo de certificación son obligatorios"

      });

    }


    // ========================================
    // VERIFICAR LOTE
    // ========================================

    const loteExiste =
      await Lote.findById(lote);


    if (!loteExiste) {

      return res.status(404).json({

        mensaje:
          "El lote seleccionado no existe"

      });

    }


    // ========================================
    // CREAR CERTIFICACIÓN
    // ========================================

    const nuevaCertificacion =
      await Certificacion.create({

        lote,

        solicitante:
          req.usuario._id,

        tipoCertificacion,

        datosCertificacion,

        observaciones,

        estado:
          "pendiente"

      });


    // ========================================
    // OBTENER CERTIFICACIÓN COMPLETA
    // ========================================

    const certificacionCreada =
      await Certificacion
        .findById(
          nuevaCertificacion._id
        )
        .populate(
          "lote",
          "codigo producto cantidad unidad estadoGrano estado"
        )
        .populate(
          "solicitante",
          "nombre apellido email rol"
        )
        .populate(
          "certificador",
          "nombre apellido email rol"
        );


    return res.status(201).json({

      mensaje:
        "Solicitud de certificación creada correctamente",

      certificacion:
        certificacionCreada

    });


  } catch (error) {

    console.error(
      "Error al solicitar certificación:",
      error
    );


    return res.status(500).json({

      mensaje:
        "Error al solicitar la certificación",

      error:
        error.message

    });

  }

};


// ==========================================
// OBTENER TODAS LAS CERTIFICACIONES
// ==========================================

const obtenerCertificaciones = async (
  req,
  res
) => {

  try {

    // Antes de listar, las aprobadas cuya fecha
    // ya pasó quedan marcadas como vencidas
    await marcarCertificacionesVencidas();

    // Cada rol ve solo las certificaciones
    // de su alcance (el certificador, las
    // que tiene asignadas)
    const filtro =
      await filtroCertificaciones(req);


    const certificaciones =
      await Certificacion
        .find({
          $and: [
            { activo: true },
            filtro
          ]
        })
        .populate(
          "lote",
          "codigo producto cantidad unidad estadoGrano estado"
        )
        .populate(
          "solicitante",
          "nombre apellido email rol"
        )
        .populate(
          "certificador",
          "nombre apellido email rol"
        )
        .sort({
          fechaSolicitud: -1
        });


    return res.status(200).json({

      total:
        certificaciones.length,

      certificaciones

    });


  } catch (error) {

    console.error(
      "Error al obtener certificaciones:",
      error
    );


    return res.status(500).json({

      mensaje:
        "Error al obtener las certificaciones",

      error:
        error.message

    });

  }

};


// ==========================================
// OBTENER UNA CERTIFICACIÓN
// ==========================================

const obtenerCertificacion = async (
  req,
  res
) => {

  try {

    const certificacion =
      await Certificacion
        .findById(
          req.params.id
        )
        .populate(
          "lote",
          "codigo producto cantidad unidad estadoGrano estado"
        )
        .populate(
          "solicitante",
          "nombre apellido email rol"
        )
        .populate(
          "certificador",
          "nombre apellido email rol"
        );


    if (!certificacion) {

      return res.status(404).json({

        mensaje:
          "La certificación no existe"

      });

    }


    return res.status(200).json(
      certificacion
    );


  } catch (error) {

    console.error(
      "Error al obtener certificación:",
      error
    );


    return res.status(500).json({

      mensaje:
        "Error al obtener la certificación",

      error:
        error.message

    });

  }

};


// ==========================================
// OBTENER CERTIFICACIONES POR LOTE
// ==========================================

const obtenerCertificacionesPorLote =
  async (
    req,
    res
  ) => {

    try {

      const {
        loteId
      } = req.params;


      // ======================================
      // VERIFICAR LOTE
      // ======================================

      const lote =
        await Lote.findById(
          loteId
        );


      if (!lote) {

        return res.status(404).json({

          mensaje:
            "El lote no existe"

        });

      }


      // ======================================
      // BUSCAR CERTIFICACIONES
      // ======================================

      const certificaciones =
        await Certificacion
          .find({
            $and: [
              {
                lote: loteId,
                activo: true
              },
              await filtroCertificaciones(req)
            ]
          })
          .populate(
            "solicitante",
            "nombre apellido email rol"
          )
          .populate(
            "certificador",
            "nombre apellido email rol"
          )
          .sort({
            fechaSolicitud: -1
          });


      return res.status(200).json({

        lote: {

          _id:
            lote._id,

          codigo:
            lote.codigo,

          producto:
            lote.producto

        },

        total:
          certificaciones.length,

        certificaciones

      });


    } catch (error) {

      console.error(
        "Error al obtener certificaciones del lote:",
        error
      );


      return res.status(500).json({

        mensaje:
          "Error al obtener las certificaciones del lote",

        error:
          error.message

      });

    }

  };


// ==========================================
// ASIGNAR CERTIFICADOR
// ==========================================

const asignarCertificador = async (
  req,
  res
) => {

  try {

    const {
      certificador
    } = req.body;


    // ========================================
    // VALIDAR CERTIFICADOR
    // ========================================

    if (!certificador) {

      return res.status(400).json({

        mensaje:
          "Debe seleccionar un certificador"

      });

    }


    const usuarioCertificador =
      await Usuario.findOne({

        _id:
          certificador,

        rol:
          "certificador",

        activo:
          true

      });


    if (!usuarioCertificador) {

      return res.status(404).json({

        mensaje:
          "El certificador no existe o no está activo"

      });

    }


    // ========================================
    // BUSCAR CERTIFICACIÓN
    // ========================================

    const certificacion =
      await Certificacion.findById(
        req.params.id
      );


    if (!certificacion) {

      return res.status(404).json({

        mensaje:
          "La certificación no existe"

      });

    }


    // ========================================
    // VALIDAR ESTADO
    // ========================================

    if (
      certificacion.estado ===
        "aprobada" ||
      certificacion.estado ===
        "rechazada" ||
      certificacion.estado ===
        "vencida"
    ) {

      return res.status(400).json({

        mensaje:
          "No se puede asignar un certificador a una certificación finalizada"

      });

    }


    // ========================================
    // ASIGNAR
    // ========================================

    certificacion.certificador =
      certificador;

    certificacion.estado =
      "en_revision";

    certificacion.fechaInspeccion =
      new Date();


    await certificacion.save();


    // ========================================
    // OBTENER DATOS COMPLETOS
    // ========================================

    const certificacionActualizada =
      await Certificacion
        .findById(
          certificacion._id
        )
        .populate(
          "lote",
          "codigo producto cantidad unidad estadoGrano estado"
        )
        .populate(
          "solicitante",
          "nombre apellido email rol"
        )
        .populate(
          "certificador",
          "nombre apellido email rol"
        );


    return res.status(200).json({

      mensaje:
        "Certificador asignado correctamente",

      certificacion:
        certificacionActualizada

    });


  } catch (error) {

    console.error(
      "Error al asignar certificador:",
      error
    );


    return res.status(500).json({

      mensaje:
        "Error al asignar el certificador",

      error:
        error.message

    });

  }

};


// ==========================================
// APROBAR CERTIFICACIÓN
// ==========================================

const aprobarCertificacion = async (
  req,
  res
) => {

  try {

    const {
      fechaVencimiento,
      observaciones,
      resultadoInspeccion,
      analisisInen
    } = req.body || {};


    // ========================================
    // BUSCAR CERTIFICACIÓN
    // ========================================

    const certificacion =
      await Certificacion.findById(
        req.params.id
      );


    if (!certificacion) {

      return res.status(404).json({

        mensaje:
          "La certificación no existe"

      });

    }


    // ========================================
    // VALIDAR CERTIFICADOR
    // ========================================

    if (
      req.usuario.rol ===
      "certificador"
    ) {

      if (
        !certificacion.certificador ||
        certificacion.certificador.toString() !==
          req.usuario._id.toString()
      ) {

        return res.status(403).json({

          mensaje:
            "No tienes permiso para aprobar esta certificación"

        });

      }

    }


    // ========================================
    // VALIDAR ESTADO
    // ========================================

    if (
      certificacion.estado !==
      "en_revision"
    ) {

      return res.status(400).json({

        mensaje:
          "Solo se pueden aprobar certificaciones que estén en revisión"

      });

    }


    // ========================================
    // FECHA DE VENCIMIENTO
    // Debe ser una fecha válida y posterior a hoy;
    // si no, la certificación nacería vencida
    // ========================================

    let fechaAprobada = null;

    if (fechaVencimiento) {
      fechaAprobada = new Date(fechaVencimiento);

      if (Number.isNaN(fechaAprobada.getTime()) || fechaAprobada <= new Date()) {
        return res.status(400).json({
          mensaje: "La fecha de vencimiento debe ser posterior a hoy"
        });
      }
    }


    // ========================================
    // ANÁLISIS SEGÚN LA NTE INEN 176:2021
    // Es obligatorio para aprobar: justifica el
    // certificado y define el grado del cacao.
    // ========================================

    let resultadoNorma;

    try {
      resultadoNorma = evaluarAnalisis(analisisInen);
    } catch (errorAnalisis) {
      if (errorAnalisis instanceof ErrorAnalisis) {
        return res.status(400).json({ mensaje: errorAnalisis.message });
      }
      throw errorAnalisis;
    }

    if (!resultadoNorma.cumple) {
      return res.status(400).json({
        mensaje:
          "El lote no cumple la NTE INEN 176:2021, no se puede aprobar. " +
          "Registra el dictamen como rechazo. Motivo: " +
          resultadoNorma.motivos.join("; "),
        motivos: resultadoNorma.motivos
      });
    }


    // ========================================
    // APROBAR
    // ========================================

    certificacion.set(
      "datosCertificacion.analisisInen",
      analisisParaGuardar(analisisInen, resultadoNorma)
    );

    certificacion.estado =
      "aprobada";

    certificacion.fechaEmision =
      new Date();

    // Código aleatorio para la página pública de verificación
    if (!certificacion.codigoVerificacion) {
      certificacion.codigoVerificacion = nuevoCodigoVerificacion();
    }


    if (fechaAprobada) {
      certificacion.fechaVencimiento = fechaAprobada;
    }


    if (
      observaciones !== undefined
    ) {

      certificacion.observaciones =
        observaciones;

    }


    // Resultado de la inspección del certificador
    certificacion.set(
      "datosCertificacion.cumplimientoRequisitos",
      true
    );

    if (resultadoInspeccion) {
      certificacion.set(
        "datosCertificacion.resultadoInspeccion",
        String(resultadoInspeccion).trim()
      );
    }


    await certificacion.save();


    // ========================================
    // OBTENER CERTIFICACIÓN COMPLETA
    // ========================================

    const certificacionActualizada =
      await Certificacion
        .findById(
          certificacion._id
        )
        .populate({
          path: "lote",
          populate: [
            {
              path: "productor",
              select:
                "nombre apellido cedula telefono email"
            }
          ]
        })
        .populate(
          "solicitante",
          "nombre apellido email rol"
        )
        .populate(
          "certificador",
          "nombre apellido email rol"
        );


    return res.status(200).json({

      mensaje:
        "Certificación aprobada correctamente",

      certificacion:
        certificacionActualizada

    });


  } catch (error) {

    console.error(
      "Error al aprobar certificación:",
      error
    );


    return res.status(500).json({

      mensaje:
        "Error al aprobar la certificación",

      error:
        error.message

    });

  }

};


// ==========================================
// RECHAZAR CERTIFICACIÓN
// ==========================================

const rechazarCertificacion = async (
  req,
  res
) => {

  try {

    const {
      observaciones,
      resultadoInspeccion,
      analisisInen
    } = req.body || {};


    // ========================================
    // VALIDAR OBSERVACIONES
    // ========================================

    if (
      !observaciones ||
      !observaciones.trim()
    ) {

      return res.status(400).json({

        mensaje:
          "Debe indicar el motivo del rechazo"

      });

    }


    // ========================================
    // BUSCAR CERTIFICACIÓN
    // ========================================

    const certificacion =
      await Certificacion.findById(
        req.params.id
      );


    if (!certificacion) {

      return res.status(404).json({

        mensaje:
          "La certificación no existe"

      });

    }


    // ========================================
    // VALIDAR CERTIFICADOR
    // ========================================

    if (
      req.usuario.rol ===
      "certificador"
    ) {

      if (
        !certificacion.certificador ||
        certificacion.certificador.toString() !==
          req.usuario._id.toString()
      ) {

        return res.status(403).json({

          mensaje:
            "No tienes permiso para rechazar esta certificación"

        });

      }

    }


    // ========================================
    // VALIDAR ESTADO
    // ========================================

    if (
      certificacion.estado ===
        "aprobada" ||
      certificacion.estado ===
        "rechazada" ||
      certificacion.estado ===
        "vencida"
    ) {

      return res.status(400).json({

        mensaje:
          "Esta certificación ya se encuentra finalizada"

      });

    }


    // ========================================
    // RECHAZAR
    // ========================================

    certificacion.estado =
      "rechazada";

    certificacion.observaciones =
      observaciones.trim();

    certificacion.set(
      "datosCertificacion.cumplimientoRequisitos",
      false
    );

    if (resultadoInspeccion) {
      certificacion.set(
        "datosCertificacion.resultadoInspeccion",
        String(resultadoInspeccion).trim()
      );
    }

    // Al rechazar, el análisis INEN es opcional; si se envía,
    // se guarda como respaldo del rechazo.
    if (analisisInen) {
      try {
        const resultadoNorma = evaluarAnalisis(analisisInen);
        certificacion.set(
          "datosCertificacion.analisisInen",
          analisisParaGuardar(analisisInen, resultadoNorma)
        );
      } catch (errorAnalisis) {
        if (errorAnalisis instanceof ErrorAnalisis) {
          return res.status(400).json({ mensaje: errorAnalisis.message });
        }
        throw errorAnalisis;
      }
    }


    await certificacion.save();


    // ========================================
    // OBTENER CERTIFICACIÓN ACTUALIZADA
    // ========================================

    const certificacionActualizada =
      await Certificacion
        .findById(
          certificacion._id
        )
        .populate(
          "lote",
          "codigo producto cantidad unidad estadoGrano estado"
        )
        .populate(
          "solicitante",
          "nombre apellido email rol"
        )
        .populate(
          "certificador",
          "nombre apellido email rol"
        );


    return res.status(200).json({

      mensaje:
        "Certificación rechazada correctamente",

      certificacion:
        certificacionActualizada

    });


  } catch (error) {

    console.error(
      "Error al rechazar certificación:",
      error
    );


    return res.status(500).json({

      mensaje:
        "Error al rechazar la certificación",

      error:
        error.message

    });

  }

};


// ==========================================
// GENERAR CERTIFICADO PDF
// ==========================================

const descargarCertificadoPDF =
  async (
    req,
    res
  ) => {

    try {

      // ======================================
      // BUSCAR CERTIFICACIÓN
      // ======================================

      const certificacion =
        await Certificacion
          .findById(
            req.params.id
          )
          .populate({
            path: "lote",

            populate: [
              {
                path: "productor",

                select:
                  "nombre apellido cedula telefono email"
              }
            ]
          })
          .populate(
            "solicitante",
            "nombre apellido email rol"
          )
          .populate(
            "certificador",
            "nombre apellido email rol"
          );


      // ======================================
      // VERIFICAR CERTIFICACIÓN
      // ======================================

      if (!certificacion) {

        return res.status(404).json({

          mensaje:
            "La certificación no existe"

        });

      }


      // ======================================
      // SOLO CERTIFICACIONES APROBADAS
      // ======================================

      if (
        certificacion.estado !==
        "aprobada"
      ) {

        return res.status(400).json({

          mensaje:
            "Solo se pueden generar certificados PDF de certificaciones aprobadas"

        });

      }


      // ======================================
      // VERSIÓN FIRMADA ELECTRÓNICAMENTE
      // Si ya se subió, se entrega esa. Con
      // ?version=original se descarga el PDF sin
      // firmar (el que se firma con FirmaEC).
      // ======================================

      const nombreBase = certificacion.codigo || "certificado";

      if (certificacion.firma?.firmada && req.query.version !== "original") {
        const firmado = await CertificadoFirmado.findOne({
          certificacion: certificacion._id
        });

        if (firmado) {
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Disposition", `attachment; filename="${nombreBase}-firmado.pdf"`);
          return res.send(firmado.pdf);
        }
      }


      // ======================================
      // GENERAR PDF (sin firmar)
      // ======================================

      await asegurarCodigoVerificacion(certificacion);

      const pdf = await generarCertificadoPDF(certificacion, {
        urlVerificacion: urlVerificacion(certificacion),
        urlNorma: urlNorma()
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${nombreBase}.pdf"`);
      return res.send(pdf);


    } catch (error) {

      console.error(
        "Error al generar certificado PDF:",
        error
      );


      // Si todavía no se enviaron
      // cabeceras al navegador

      if (!res.headersSent) {

        return res.status(500).json({

          mensaje:
            "Error al generar el certificado PDF",

          error:
            error.message

        });

      }

    }

  };


// ==========================================
// CÓDIGO Y ENLACE DE VERIFICACIÓN
// ==========================================

function nuevoCodigoVerificacion() {
  return crypto.randomBytes(9).toString("base64url");
}

async function asegurarCodigoVerificacion(certificacion) {
  if (!certificacion.codigoVerificacion) {
    certificacion.codigoVerificacion = nuevoCodigoVerificacion();
    await Certificacion.updateOne(
      { _id: certificacion._id },
      { codigoVerificacion: certificacion.codigoVerificacion }
    );
  }
  return certificacion.codigoVerificacion;
}

function urlVerificacion(certificacion) {
  const base = (process.env.QR_FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");
  return `${base}/verificar/${certificacion.codigoVerificacion}`;
}

// Página pública con la norma, las bases y los parámetros
// usados para emitir el certificado
function urlNorma() {
  const base = (process.env.QR_FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");
  return `${base}/normativa/inen-176`;
}


// ==========================================
// SUBIR EL CERTIFICADO FIRMADO
// Solo el certificador asignado. Descarga el PDF,
// lo firma como prefiera y sube el PDF firmado:
//   - a mano: lo imprime, lo firma y lo escanea;
//   - en Word u otro editor, con su firma escaneada;
//   - con FirmaEC (firma electrónica, opcional).
// Debe confirmar (?confirmo=si) que el documento ya
// tiene su firma. Si el PDF trae una firma electrónica
// válida, se registra también como electrónica.
// El sistema nunca recibe un certificado .p12 ni su
// contraseña. Body: el PDF tal cual (application/pdf).
// ==========================================

const subirCertificadoFirmado = async (req, res) => {
  try {
    const certificacion = await Certificacion.findById(req.params.id)
      .populate("certificador", "nombre apellido");

    if (!certificacion) {
      return res.status(404).json({ mensaje: "La certificación no existe" });
    }

    // Solo el certificador asignado (nadie más)
    const esSuCertificador =
      req.usuario.rol === "certificador" &&
      certificacion.certificador &&
      String(certificacion.certificador._id) === String(req.usuario._id);

    if (!esSuCertificador) {
      return res.status(403).json({
        mensaje: "Solo el certificador asignado puede subir el certificado firmado"
      });
    }

    if (certificacion.estado !== "aprobada") {
      return res.status(400).json({
        mensaje: "Solo se pueden firmar certificaciones aprobadas"
      });
    }

    const archivo = req.body;

    if (!Buffer.isBuffer(archivo) || archivo.length === 0) {
      return res.status(400).json({ mensaje: "Selecciona el archivo PDF firmado" });
    }

    if (archivo.subarray(0, 5).toString("latin1") !== "%PDF-") {
      return res.status(400).json({ mensaje: "El archivo no es un PDF" });
    }

    if (req.query.confirmo !== "si") {
      return res.status(400).json({
        mensaje: "Confirma que el documento ya contiene tu firma antes de subirlo"
      });
    }

    const nombreCertificador =
      `${certificacion.certificador.nombre || ""} ${certificacion.certificador.apellido || ""}`.trim();

    const sha256 = crypto.createHash("sha256").update(archivo).digest("hex");
    const advertencias = [];

    // ---------- ¿Trae además una firma electrónica? ----------
    const analisis = analizarFirmaPdf(archivo);
    let datosFirma;

    if (analisis.ok) {
      const firma = analisis.firma;

      if (!perteneceACertificacion(archivo, certificacion)) {
        return res.status(400).json({
          mensaje: `Este PDF no es el certificado ${certificacion.codigo || ""}. Descarga el PDF de esta certificación, fírmalo y súbelo.`
        });
      }

      if (!nombreCoincide(firma.firmante, certificacion.certificador)) {
        advertencias.push(
          `El nombre del certificado de firma (${firma.firmante || "sin nombre"}) no coincide con el certificador asignado.`
        );
      }

      const autofirmado = Boolean(firma.emisor) && firma.emisor === firma.firmante;
      if (autofirmado) {
        advertencias.push(
          "El certificado de firma es de prueba (lo emitió la misma persona). Para validez legal se necesita un certificado de una entidad acreditada."
        );
      }

      if (
        firma.fechaFirma && firma.certificadoHasta &&
        new Date(firma.fechaFirma) > new Date(firma.certificadoHasta)
      ) {
        advertencias.push("El certificado de firma estaba vencido en la fecha de la firma.");
      }

      datosFirma = {
        tipo: "electronica",
        firmante: firma.firmante,
        identificacion: firma.identificacion,
        emisor: firma.emisor,
        autofirmado,
        fechaFirma: firma.fechaFirma,
        certificadoHasta: firma.certificadoHasta
      };

    } else {
      // Firma manuscrita (o el PDF tenía una firma electrónica
      // que ya no es válida porque se editó después).
      if (analisis.firmas?.length) {
        advertencias.push(
          `El PDF tenía una firma electrónica que no es válida (${analisis.motivo.toLowerCase()}). Se registró como firma manuscrita.`
        );
      }

      datosFirma = {
        tipo: "manuscrita",
        firmante: nombreCertificador,
        identificacion: "",
        emisor: "",
        autofirmado: false,
        fechaFirma: new Date(),
        certificadoHasta: null
      };
    }

    // ---------- Guardar ----------
    await CertificadoFirmado.findOneAndUpdate(
      { certificacion: certificacion._id },
      {
        certificacion: certificacion._id,
        pdf: archivo,
        sha256,
        tamano: archivo.length,
        subidoPor: req.usuario._id
      },
      { upsert: true, new: true }
    );

    certificacion.firma = {
      firmada: true,
      ...datosFirma,
      sha256,
      fechaCarga: new Date(),
      subidoPor: req.usuario._id
    };
    await certificacion.save();

    return res.status(200).json({
      mensaje: datosFirma.tipo === "electronica"
        ? `Certificado ${certificacion.codigo || ""} firmado electrónicamente por ${datosFirma.firmante}`
        : `Certificado ${certificacion.codigo || ""} firmado por ${datosFirma.firmante}`,
      firma: certificacion.firma,
      advertencias
    });

  } catch (error) {
    console.error("Error al subir el certificado firmado:", error);
    return res.status(500).json({ mensaje: "Error al guardar el certificado firmado" });
  }
};


// ==========================================
// VERIFICACIÓN PÚBLICA DEL CERTIFICADO
// GET /api/public/certificados/:codigo
// Cualquier persona que escanee el QR del PDF.
// ==========================================

const verificarCertificadoPublico = async (req, res) => {
  try {
    const codigo = String(req.params.codigo || "");

    if (!/^[A-Za-z0-9_-]{8,32}$/.test(codigo)) {
      return res.status(404).json({ mensaje: "El certificado no existe" });
    }

    const certificacion = await Certificacion.findOne({ codigoVerificacion: codigo })
      .populate({
        path: "lote",
        select: "codigo producto cantidad unidad estadoGrano ubicacion productor",
        populate: [
          { path: "productor", select: "nombre apellido" }
        ]
      })
      .populate("certificador", "nombre apellido");

    if (!certificacion || !["aprobada", "vencida"].includes(certificacion.estado)) {
      return res.status(404).json({ mensaje: "El certificado no existe" });
    }

    const ahora = new Date();
    const vencido =
      certificacion.estado === "vencida" ||
      (certificacion.fechaVencimiento && new Date(certificacion.fechaVencimiento) < ahora);

    const lote = certificacion.lote || {};
    const persona = (p) => (p ? { nombre: p.nombre, apellido: p.apellido } : null);

    return res.status(200).json({
      codigo: certificacion.codigo,
      tipoCertificacion: certificacion.tipoCertificacion,
      estado: vencido ? "vencido" : "vigente",
      activo: certificacion.activo !== false,
      fechaEmision: certificacion.fechaEmision,
      fechaVencimiento: certificacion.fechaVencimiento || null,
      certificador: persona(certificacion.certificador),
      lote: {
        codigo: lote.codigo,
        producto: lote.producto,
        cantidad: lote.cantidad,
        unidad: lote.unidad,
        estadoGrano: lote.estadoGrano || "seco",
        provincia: lote.ubicacion?.provincia || "",
        canton: lote.ubicacion?.canton || ""
      },
      productor: persona(lote.productor),
      empresa: datosEmpresa(),
      // Norma y grado (sin los valores del análisis)
      norma: certificacion.datosCertificacion?.analisisInen?.grado
        ? {
          codigo: certificacion.datosCertificacion.analisisInen.norma,
          grado: certificacion.datosCertificacion.analisisInen.grado
        }
        : null,
      firma: certificacion.firma?.firmada
        ? {
          firmada: true,
          tipo: certificacion.firma.tipo || "electronica",
          firmante: certificacion.firma.firmante,
          emisor: certificacion.firma.emisor,
          autofirmado: certificacion.firma.autofirmado,
          fechaFirma: certificacion.firma.fechaFirma,
          sha256: certificacion.firma.sha256
        }
        : { firmada: false }
    });

  } catch (error) {
    console.error("Error al verificar el certificado:", error);
    return res.status(500).json({ mensaje: "Error al verificar el certificado" });
  }
};


// ==========================================
// EXPORTAR CONTROLADORES
// ==========================================

// ==========================================
// AVISOS DE VENCIMIENTO
// Certificaciones aprobadas que vencen en los
// próximos 30 días y las que vencieron en los
// últimos 30, dentro del alcance del usuario.
// ==========================================

const obtenerAvisosVencimiento = async (req, res) => {
  try {
    const ahora = new Date();
    await marcarCertificacionesVencidas(ahora);

    const alcance = await filtroCertificaciones(req);

    const consulta = (condicion, orden) =>
      Certificacion.find({ $and: [condicion, alcance] })
        .select("codigo tipoCertificacion estado fechaVencimiento lote certificador")
        .populate({
          path: "lote",
          select: "codigo productor",
          populate: { path: "productor", select: "nombre apellido" }
        })
        .populate("certificador", "nombre apellido")
        .sort({ fechaVencimiento: orden })
        .limit(50);

    const resumir = (c) => ({
      _id: c._id,
      codigo: c.codigo,
      tipoCertificacion: c.tipoCertificacion,
      estado: c.estado,
      fechaVencimiento: c.fechaVencimiento,
      diasParaVencer: diasParaVencer(c.fechaVencimiento, ahora),
      lote: c.lote
        ? {
          _id: c.lote._id,
          codigo: c.lote.codigo,
          productor: c.lote.productor
            ? { nombre: c.lote.productor.nombre, apellido: c.lote.productor.apellido }
            : null
        }
        : null,
      certificador: c.certificador
        ? { nombre: c.certificador.nombre, apellido: c.certificador.apellido }
        : null
    });

    const [porVencer, vencidas] = await Promise.all([
      consulta(filtroPorVencer(ahora), 1),
      consulta({
        estado: "vencida",
        activo: true,
        fechaVencimiento: { $gte: new Date(ahora.getTime() - DIAS_AVISO * 24 * 60 * 60 * 1000) }
      }, -1)
    ]);

    return res.status(200).json({
      dias: DIAS_AVISO,
      porVencer: porVencer.map(resumir),
      vencidas: vencidas.map(resumir)
    });

  } catch (error) {
    console.error("Error al consultar los vencimientos:", error);
    return res.status(500).json({ mensaje: "Error al consultar los vencimientos" });
  }
};


module.exports = {

  obtenerAvisosVencimiento,

  solicitarCertificacion,

  obtenerCertificaciones,

  obtenerCertificacion,

  obtenerCertificacionesPorLote,

  asignarCertificador,

  aprobarCertificacion,

  rechazarCertificacion,

  descargarCertificadoPDF,

  subirCertificadoFirmado,

  verificarCertificadoPublico

};