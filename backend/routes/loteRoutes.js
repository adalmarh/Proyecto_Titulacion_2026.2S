const express = require("express");

const {
  crearLote,
  obtenerLotes,
  obtenerLote,
  obtenerLotesPorProductor,
  actualizarLote,
  actualizarEstadoLote,
  desactivarLote
} = require("../controllers/loteController");

const protegerRuta = require("../middleware/authMiddleware");
const permitirRoles = require("../middleware/rolesMiddleware");

const {
  accesoLote

} = require("../middleware/alcanceMiddleware");

const router = express.Router();

// Id del lote en la URL
const loteDeLaUrl = (req) => req.params.id;


// ==========================================
// CONSULTAS
// Cada rol recibe solo los lotes de su alcance
// (el filtro se aplica en el controlador).
// ==========================================

router.get("/", protegerRuta, obtenerLotes);

router.get(
  "/productor/:productorId",
  protegerRuta,
  obtenerLotesPorProductor
);

router.get(
  "/:id",
  protegerRuta,
  accesoLote(loteDeLaUrl, "ver"),
  obtenerLote
);


// ==========================================
// GESTIÓN
// Administrador: cualquier lote.
// ==========================================

router.post(
  "/",
  protegerRuta,
  permitirRoles("administrador"),
  crearLote
);

router.put(
  "/:id",
  protegerRuta,
  permitirRoles("administrador"),
  accesoLote(loteDeLaUrl, "gestionar"),
  actualizarLote
);

router.patch(
  "/:id/estado",
  protegerRuta,
  permitirRoles("administrador"),
  accesoLote(loteDeLaUrl, "gestionar"),
  actualizarEstadoLote
);

router.patch(
  "/:id/desactivar",
  protegerRuta,
  permitirRoles("administrador"),
  accesoLote(loteDeLaUrl, "gestionar"),
  desactivarLote
);

module.exports = router;
