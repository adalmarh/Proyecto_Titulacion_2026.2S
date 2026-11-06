const express = require("express");

const {
  consultarQRPublico
} = require("../controllers/qrController");

const {
  verificarCertificadoPublico
} = require("../controllers/certificacionController");

const {
  crearSolicitud
} = require("../controllers/solicitudController");

const crearLimitador = require("../utils/limitador");
const { datosEmpresa } = require("../utils/empresa");

const router =
  express.Router();


// ==========================================
// CONSULTA PÚBLICA DEL QR
// ==========================================

router.get(
  "/qr/:token",
  consultarQRPublico
);


// ==========================================
// VERIFICACIÓN DE UN CERTIFICADO
// (QR impreso en el certificado PDF)
// ==========================================

router.get(
  "/certificados/:codigo",
  verificarCertificadoPublico
);


// ==========================================
// DATOS DE LA EMPRESA (nombre, RUC, ciudad)
// Los muestran el inicio de sesión y la
// solicitud de cuenta.
// ==========================================

router.get(
  "/empresa",
  (req, res) => res.json(datosEmpresa())
);


// ==========================================
// SOLICITUD DE CUENTA (desde el inicio de sesión)
// Máximo 5 solicitudes por hora desde una misma red.
// ==========================================

router.post(
  "/solicitudes",
  crearLimitador({
    maximo: Number(process.env.LIMITE_SOLICITUDES) || 5,
    ventanaMs: 60 * 60 * 1000,
    mensaje: "Se enviaron demasiadas solicitudes desde esta red. Intenta de nuevo en una hora."
  }),
  crearSolicitud
);


module.exports =
  router;
