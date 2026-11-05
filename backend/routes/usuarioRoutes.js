const express = require("express");

const {
  obtenerUsuarios,
  crearUsuario,
  actualizarUsuario,
  cambiarEstadoUsuario,
  obtenerCertificadores
} = require("../controllers/usuarioController");

const protegerRuta = require("../middleware/authMiddleware");
const permitirRoles = require("../middleware/rolesMiddleware");

const router = express.Router();


// ==========================================
// TODAS LAS RUTAS: solo administrador
// ==========================================

router.use(
  protegerRuta,
  permitirRoles("administrador")
);


// Certificadores activos (para asignar certificaciones).
// Va antes de "/:id" para que no se confunda con un id.
router.get("/certificadores", obtenerCertificadores);

router.get("/", obtenerUsuarios);

router.post("/", crearUsuario);

router.put("/:id", actualizarUsuario);

router.patch("/:id/estado", cambiarEstadoUsuario);


module.exports = router;
