const express = require("express");

const {
  crearAsociacion,
  obtenerAsociaciones,
  obtenerAsociacion,
  actualizarAsociacion,
  desactivarAsociacion
} = require("../controllers/asociacionController");

const protegerRuta = require("../middleware/authMiddleware");
const permitirRoles = require("../middleware/rolesMiddleware");

const router = express.Router();


// ==========================================
// CONSULTAS
// Cada rol recibe solo las asociaciones de su
// alcance (el filtro se aplica en el controlador).
// ==========================================

router.get(
  "/",
  protegerRuta,
  obtenerAsociaciones
);

router.get(
  "/:id",
  protegerRuta,
  obtenerAsociacion
);


// ==========================================
// GESTIÓN: solo el administrador
// ==========================================

router.post(
  "/",
  protegerRuta,
  permitirRoles("administrador"),
  crearAsociacion
);

router.put(
  "/:id",
  protegerRuta,
  permitirRoles("administrador"),
  actualizarAsociacion
);

router.patch(
  "/:id/desactivar",
  protegerRuta,
  permitirRoles("administrador"),
  desactivarAsociacion
);

module.exports = router;
