const express = require("express");

const {
  crearSolicitudLote,
  listarSolicitudesLote,
  totalPendientesLote,
  cancelarSolicitudLote,
  rechazarSolicitudLote
} = require("../controllers/solicitudLoteController");

const protegerRuta = require("../middleware/authMiddleware");
const permitirRoles = require("../middleware/rolesMiddleware");

const router = express.Router();


// ==========================================
// SOLICITUDES DE LOTE
// La aprobación se hace creando el lote:
// POST /api/lotes con { ..., solicitudLote: id }
// ==========================================

// El productor solicita un lote nuevo
router.post("/", protegerRuta, permitirRoles("productor"), crearSolicitudLote);

// Administrador: todas · productor: las suyas
router.get("/", protegerRuta, permitirRoles("administrador", "productor"), listarSolicitudesLote);

// Contador para el administrador
router.get("/pendientes/total", protegerRuta, permitirRoles("administrador"), totalPendientesLote);

// El productor cancela una solicitud suya pendiente
router.patch("/:id/cancelar", protegerRuta, permitirRoles("productor"), cancelarSolicitudLote);

// El administrador la rechaza con un motivo
router.patch("/:id/rechazar", protegerRuta, permitirRoles("administrador"), rechazarSolicitudLote);


module.exports = router;
