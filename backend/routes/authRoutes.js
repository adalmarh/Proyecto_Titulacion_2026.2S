const express = require("express");

const {
  login,
  obtenerPerfil,
  aceptarPrivacidad,
  actualizarPerfil,
  cambiarPassword
} = require("../controllers/authController");

const {
  crearUsuario
} = require("../controllers/usuarioController");

const protegerRuta = require("../middleware/authMiddleware");
const permitirRoles = require("../middleware/rolesMiddleware");

const router = express.Router();


// Registro: ya NO es público.
// Solo el administrador crea cuentas (equivale a POST /api/usuarios).
router.post(
  "/registro",
  protegerRuta,
  permitirRoles("administrador"),
  crearUsuario
);

// Login
router.post("/login", login);

// Perfil del usuario que inició sesión
router.get("/perfil", protegerRuta, obtenerPerfil);

// Mi perfil: celular y contraseña
router.patch("/perfil", protegerRuta, actualizarPerfil);
router.put("/password", protegerRuta, cambiarPassword);

// Aceptar el aviso de privacidad vigente
router.post("/privacidad", protegerRuta, aceptarPrivacidad);

module.exports = router;
