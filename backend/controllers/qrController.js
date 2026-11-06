const crypto = require("crypto");
const QRCode = require("qrcode");

const CodigoQR = require("../models/CodigoQR");
const Lote = require("../models/Lote");
const EventoTrazabilidad = require("../models/EventoTrazabilidad");
const Certificacion = require("../models/Certificacion");
const {
  armarRespuestaPublica
} = require("../utils/respuestaPublica");


// ======================================================
// GENERAR TOKEN ÚNICO
// ======================================================

const generarTokenUnico = () => {
  return crypto
    .randomBytes(32)
    .toString("hex");
};


// ======================================================
// GENERAR URL PÚBLICA
// ======================================================

const generarUrlPublica = (token) => {

  const baseURL =
    process.env.QR_FRONTEND_URL ||
    "http://localhost:5173";

  return `${baseURL}/publico/qr/${token}`;
};


// ======================================================
// GENERAR CÓDIGO QR
// ======================================================

const generarCodigoQR = async (
  req,
  res
) => {

  try {

    const {
      loteId
    } = req.params;


    // ================================================
    // BUSCAR LOTE
    // ================================================

    const lote =
      await Lote.findById(
        loteId
      );


    if (!lote) {

      return res.status(404).json({
        mensaje:
          "Lote no encontrado"
      });

    }


    // ================================================
    // BUSCAR QR EXISTENTE
    // ================================================

    const codigoExistente =
      await CodigoQR.findOne({
        lote: loteId
      });


    // ================================================
    // SI YA EXISTE UNO ACTIVO
    // ================================================

    if (
      codigoExistente &&
      codigoExistente.activo
    ) {

      const imagen =
        await QRCode.toDataURL(
          codigoExistente.urlPublica
        );


      return res.status(200).json({

        mensaje:
          "El lote ya tiene un código QR activo",

        qr:
          codigoExistente,

        imagen

      });

    }


    // ================================================
    // GENERAR NUEVO TOKEN
    // ================================================

    const token =
      generarTokenUnico();


    // ================================================
    // GENERAR URL PÚBLICA
    // ================================================

    const urlPublica =
      generarUrlPublica(
        token
      );


    // ================================================
    // REUTILIZAR REGISTRO INACTIVO
    // O CREAR UNO NUEVO
    // ================================================

    const codigoQR =
      codigoExistente ||
      new CodigoQR({
        lote: loteId
      });


    codigoQR.token =
      token;

    codigoQR.urlPublica =
      urlPublica;

    codigoQR.activo =
      true;

    codigoQR.totalEscaneos =
      0;

    codigoQR.ultimoEscaneo =
      null;


    await codigoQR.save();


    // ================================================
    // GENERAR IMAGEN QR
    // ================================================

    const imagen =
      await QRCode.toDataURL(
        urlPublica
      );


    // ================================================
    // RESPUESTA
    // ================================================

    return res.status(201).json({

      mensaje:
        "Código QR generado correctamente",

      qr:
        codigoQR,

      imagen

    });

  } catch (error) {

    console.error(
      "Error al generar código QR:",
      error
    );

    return res.status(500).json({

      mensaje:
        "Error al generar el código QR",

      error:
        error.message

    });

  }

};


// ======================================================
// OBTENER CÓDIGO QR POR LOTE
// ======================================================

const obtenerCodigoQRPorLote =
  async (
    req,
    res
  ) => {

    try {

      const {
        loteId
      } = req.params;


      // ================================================
      // VERIFICAR LOTE
      // ================================================

      const lote =
        await Lote.findById(
          loteId
        );


      if (!lote) {

        return res.status(404).json({

          mensaje:
            "Lote no encontrado"

        });

      }


      // ================================================
      // BUSCAR QR ACTIVO
      // ================================================

      const codigoQR =
        await CodigoQR.findOne({

          lote: loteId,

          activo: true

        });


      if (!codigoQR) {

        return res.status(404).json({

          mensaje:
            "El lote no tiene un código QR activo"

        });

      }


      // ================================================
      // GENERAR IMAGEN
      // ================================================

      const imagen =
        await QRCode.toDataURL(
          codigoQR.urlPublica
        );


      // ================================================
      // RESPUESTA
      // ================================================

      return res.status(200).json({

        mensaje:
          "Código QR obtenido correctamente",

        qr:
          codigoQR,

        imagen

      });

    } catch (error) {

      console.error(
        "Error al obtener código QR:",
        error
      );

      return res.status(500).json({

        mensaje:
          "Error al obtener el código QR",

        error:
          error.message

      });

    }

  };


// ======================================================
// REGENERAR CÓDIGO QR
// ======================================================

const regenerarCodigoQR =
  async (
    req,
    res
  ) => {

    try {

      const {
        loteId
      } = req.params;


      // ================================================
      // VERIFICAR LOTE
      // ================================================

      const lote =
        await Lote.findById(
          loteId
        );


      if (!lote) {

        return res.status(404).json({

          mensaje:
            "Lote no encontrado"

        });

      }


      // ================================================
      // BUSCAR REGISTRO EXISTENTE
      // ================================================

      let codigoQR =
        await CodigoQR.findOne({
          lote: loteId
        });


      // ================================================
      // SI NO EXISTE, CREAR UNO
      // ================================================

      if (!codigoQR) {

        codigoQR =
          new CodigoQR({
            lote: loteId
          });

      }


      // ================================================
      // GENERAR NUEVO TOKEN
      // ================================================

      const token =
        generarTokenUnico();


      // ================================================
      // GENERAR NUEVA URL
      // ================================================

      const urlPublica =
        generarUrlPublica(
          token
        );


      // ================================================
      // ACTUALIZAR QR
      // ================================================

      codigoQR.token =
        token;

      codigoQR.urlPublica =
        urlPublica;

      codigoQR.activo =
        true;

      codigoQR.totalEscaneos =
        0;

      codigoQR.ultimoEscaneo =
        null;


      await codigoQR.save();


      // ================================================
      // GENERAR IMAGEN
      // ================================================

      const imagen =
        await QRCode.toDataURL(
          urlPublica
        );


      // ================================================
      // RESPUESTA
      // ================================================

      return res.status(200).json({

        mensaje:
          "Código QR regenerado correctamente",

        qr:
          codigoQR,

        imagen

      });

    } catch (error) {

      console.error(
        "Error al regenerar código QR:",
        error
      );

      return res.status(500).json({

        mensaje:
          "Error al regenerar el código QR",

        error:
          error.message

      });

    }

  };


// ======================================================
// DESACTIVAR CÓDIGO QR
// ======================================================

const desactivarCodigoQR =
  async (
    req,
    res
  ) => {

    try {

      const {
        loteId
      } = req.params;


      // ================================================
      // BUSCAR QR ACTIVO
      // ================================================

      const codigoQR =
        await CodigoQR.findOne({

          lote: loteId,

          activo: true

        });


      if (!codigoQR) {

        return res.status(404).json({

          mensaje:
            "No existe un código QR activo para este lote"

        });

      }


      // ================================================
      // DESACTIVAR
      // ================================================

      codigoQR.activo =
        false;


      await codigoQR.save();


      // ================================================
      // RESPUESTA
      // ================================================

      return res.status(200).json({

        mensaje:
          "Código QR desactivado correctamente",

        qr:
          codigoQR

      });

    } catch (error) {

      console.error(
        "Error al desactivar código QR:",
        error
      );

      return res.status(500).json({

        mensaje:
          "Error al desactivar el código QR",

        error:
          error.message

      });

    }

  };


// ======================================================
// CONSULTA PÚBLICA DEL QR
// ======================================================

const consultarQRPublico =
  async (
    req,
    res
  ) => {

    try {

      const {
        token
      } = req.params;


      // ================================================
      // BUSCAR QR ACTIVO
      // (un QR regenerado o desactivado ya no es válido)
      // ================================================

      const codigoQR =
        await CodigoQR.findOne({
          token,
          activo: true
        });

      if (!codigoQR) {
        return res.status(404).json({
          mensaje:
            "El código QR no existe o se encuentra desactivado"
        });
      }


      // ================================================
      // OBTENER LOTE (solo datos públicos)
      // ================================================

      const lote =
        await Lote.findById(codigoQR.lote)
          .populate("productor", "nombre apellido");

      if (!lote) {
        return res.status(404).json({
          mensaje:
            "El lote asociado al código QR no existe"
        });
      }


      // ================================================
      // REGISTRAR ESCANEO
      // ================================================

      codigoQR.totalEscaneos =
        (codigoQR.totalEscaneos || 0) + 1;

      codigoQR.ultimoEscaneo =
        new Date();

      await codigoQR.save();


      // ================================================
      // TRAZABILIDAD Y CERTIFICACIONES
      // ================================================

      const eventos =
        await EventoTrazabilidad
          .find({ lote: lote._id })
          .populate("responsable", "nombre apellido rol")
          .sort({ fecha: 1 });

      const certificaciones =
        await Certificacion
          .find({
            lote: lote._id,
            activo: true
          })
          .populate("certificador", "nombre apellido");


      // ================================================
      // RESPUESTA PÚBLICA
      // (ver utils/respuestaPublica.js: qué se publica)
      // ================================================

      return res.status(200).json(
        armarRespuestaPublica({
          lote,
          eventos,
          certificaciones,
          codigoQR
        })
      );

    } catch (error) {

      console.error(
        "Error al consultar QR público:",
        error
      );

      return res.status(500).json({
        mensaje:
          "Error al consultar la información pública del QR"
      });

    }

  };


// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {

  generarCodigoQR,

  obtenerCodigoQRPorLote,

  regenerarCodigoQR,

  desactivarCodigoQR,

  consultarQRPublico

};