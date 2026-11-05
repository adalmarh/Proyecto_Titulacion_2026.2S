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
  accesoProductor,
  forzarAsociacionPropia,
  soloAdminPuedeCambiar
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
// Asociación: solo los de su asociación, y no
// puede cambiarlos de asociación.
// ==========================================

router.post(
  "/",
  protegerRuta,
  permitirRoles("administrador", "asociacion"),
  forzarAsociacionPropia,
  crearProductor
);

router.put(
  "/:id",
  protegerRuta,
  permitirRoles("administrador", "asociacion"),
  accesoProductor(),
  soloAdminPuedeCambiar("asociacion"),
  actualizarProductor
);

router.patch(
  "/:id/desactivar",
  protegerRuta,
  permitirRoles("administrador", "asociacion"),
  accesoProductor(),
  desactivarProductor
);

module.exports = router;
