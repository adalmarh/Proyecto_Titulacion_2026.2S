const express = require("express");

const {
  obtenerSolicitudes,
  contarPendientes,
  aprobarSolicitud,
  rechazarSolicitud
} = require("../controllers/solicitudController");

const protegerRuta = require("../middleware/authMiddleware");
const permitirRoles = require("../middleware/rolesMiddleware");

const router = express.Router();


// ==========================================
// REVISIÓN DE SOLICITUDES DE CUENTA
// Solo el administrador (la empresa).
// (El envío de solicitudes es público y está
// en publicRoutes.)
// ==========================================

router.use(
  protegerRuta,
  permitirRoles("administrador")
);

router.get("/", obtenerSolicitudes);
router.get("/pendientes/total", contarPendientes);
router.patch("/:id/aprobar", aprobarSolicitud);
router.patch("/:id/rechazar", rechazarSolicitud);


module.exports = router;
