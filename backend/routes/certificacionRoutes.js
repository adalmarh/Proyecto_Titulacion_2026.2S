const express = require("express");

const {
  solicitarCertificacion,
  obtenerCertificaciones,
  obtenerCertificacion,
  obtenerCertificacionesPorLote,
  asignarCertificador,
  aprobarCertificacion,
  rechazarCertificacion,
  descargarCertificadoPDF,
  subirCertificadoFirmado
} = require(
  "../controllers/certificacionController"
);

const protegerRuta =
  require("../middleware/authMiddleware");

const permitirRoles =
  require("../middleware/rolesMiddleware");

const {
  accesoLote,
  accesoCertificacion
} = require("../middleware/alcanceMiddleware");

const router =
  express.Router();


// ==========================================
// CONSULTAS
// Administrador: todas.
// Asociación y productor: las de sus lotes.
// Certificador: las que tiene asignadas.
// ==========================================

router.get(
  "/",
  protegerRuta,
  obtenerCertificaciones
);

router.get(
  "/lote/:loteId",
  protegerRuta,
  accesoLote((req) => req.params.loteId, "ver"),
  obtenerCertificacionesPorLote
);

router.get(
  "/:id/pdf",
  protegerRuta,
  accesoCertificacion(),
  descargarCertificadoPDF
);

router.get(
  "/:id",
  protegerRuta,
  accesoCertificacion(),
  obtenerCertificacion
);


// ==========================================
// SOLICITAR CERTIFICACIÓN
// Solo sobre lotes que el usuario gestiona.
// ==========================================

router.post(
  "/",
  protegerRuta,
  permitirRoles(
    "administrador",
    "asociacion",
    "productor"
  ),
  accesoLote((req) => req.body && req.body.lote, "gestionar"),
  solicitarCertificacion
);


// ==========================================
// ASIGNAR CERTIFICADOR: solo administrador
// ==========================================

router.patch(
  "/:id/asignar-certificador",
  protegerRuta,
  permitirRoles(
    "administrador"
  ),
  asignarCertificador
);


// ==========================================
// APROBAR / RECHAZAR
// El certificador solo puede resolver las
// certificaciones que tiene asignadas (se
// verifica también en el controlador).
// ==========================================

router.patch(
  "/:id/aprobar",
  protegerRuta,
  permitirRoles(
    "administrador",
    "certificador"
  ),
  accesoCertificacion(),
  aprobarCertificacion
);

router.patch(
  "/:id/rechazar",
  protegerRuta,
  permitirRoles(
    "administrador",
    "certificador"
  ),
  accesoCertificacion(),
  rechazarCertificacion
);

// ==========================================
// SUBIR EL CERTIFICADO PDF FIRMADO
// El cuerpo es el PDF tal cual (máximo 10 MB).
// Solo lo sube el certificador asignado
// (se verifica en el controlador).
// ==========================================

const recibirPDF = (req, res, next) =>
  express.raw({ type: "application/pdf", limit: "10mb" })(req, res, (error) => {
    if (error) {
      return res.status(error.status === 413 ? 413 : 400).json({
        mensaje: error.status === 413
          ? "El PDF supera el tamaño máximo de 10 MB"
          : "No se pudo leer el archivo PDF"
      });
    }
    return next();
  });

router.post(
  "/:id/firma",
  protegerRuta,
  permitirRoles(
    "certificador"
  ),
  accesoCertificacion(),
  recibirPDF,
  subirCertificadoFirmado
);


module.exports =
  router;
