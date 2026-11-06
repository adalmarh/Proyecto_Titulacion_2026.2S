const express = require("express");

const {
  crearProductor,
  obtenerProductores,
  obtenerProductor,
  actualizarProductor,
  desactivarProductor
} = require("../controllers/productorController");

const protegerRuta = require("../middleware/authMiddleware");
const permitirRoles = require("../middleware/rolesMiddleware");

const {
  accesoProductor

} = require("../middleware/alcanceMiddleware");

const router = express.Router();


// ==========================================
// CONSULTAS
// Cada rol recibe solo los productores de su
// alcance (el filtro se aplica en el controlador).
// ==========================================

router.get(
  "/",
  protegerRuta,
  obtenerProductores
);

router.get(
  "/:id",
  protegerRuta,
  obtenerProductor
);


// ==========================================
// GESTIÓN
// Administrador: cualquier productor.
// ==========================================

router.post(
  "/",
  protegerRuta,
  permitirRoles("administrador"),
  crearProductor
);

router.put(
  "/:id",
  protegerRuta,
  permitirRoles("administrador"),
  accesoProductor(),
  actualizarProductor
);

router.patch(
  "/:id/desactivar",
  protegerRuta,
  permitirRoles("administrador"),
  accesoProductor(),
  desactivarProductor
);

module.exports = router;
