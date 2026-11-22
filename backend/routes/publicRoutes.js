const express = require("express");

const {
  consultarQRPublico
} = require("../controllers/qrController");

const {
  verificarCertificadoPublico
} = require("../controllers/certificacionController");

const {
  crearSolicitud,
  consultarEstadoSolicitud
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


// ==========================================
// CONSULTAR EL ESTADO DE MI SOLICITUD
// Con el correo y la contraseña de la solicitud.
// Máximo 10 consultas cada 15 minutos por red.
// ==========================================

router.post(
  "/solicitudes/estado",
  crearLimitador({
    maximo: Number(process.env.LIMITE_CONSULTAS_SOLICITUD) || 10,
    ventanaMs: 15 * 60 * 1000,
    mensaje: "Demasiadas consultas desde esta red. Intenta de nuevo en 15 minutos."
  }),
  consultarEstadoSolicitud
);


module.exports =
  router;
