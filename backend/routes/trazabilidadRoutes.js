const express = require("express");

const {
  obtenerEventos,
  crearEvento,
  obtenerEventosPorLote,
  obtenerEvento,
  actualizarEvento,
  eliminarEvento
} = require(
  "../controllers/trazabilidadController"
);

const protegerRuta =
  require("../middleware/authMiddleware");

const permitirRoles =
  require("../middleware/rolesMiddleware");

const {
  accesoLote,
  accesoEvento
} = require("../middleware/alcanceMiddleware");

const router =
  express.Router();


// ==========================================
// CONSULTAS
// Cada rol ve solo los eventos de los lotes
// de su alcance.
// ==========================================

router.get(
  "/",
  protegerRuta,
  obtenerEventos
);

router.get(
  "/lote/:loteId",
  protegerRuta,
  accesoLote((req) => req.params.loteId, "ver"),
  obtenerEventosPorLote
);

router.get(
  "/:id",
  protegerRuta,
  accesoEvento("ver"),
  obtenerEvento
);


// ==========================================
// REGISTRAR EVENTO
// Solo en lotes que el usuario gestiona
// (el productor, únicamente en sus lotes).
// ==========================================

router.post(
  "/",
  protegerRuta,
  permitirRoles(
    "administrador",
    "productor"
  ),
  accesoLote((req) => req.body && req.body.lote, "gestionar"),
  crearEvento
);


// ==========================================
// ACTUALIZAR EVENTO
// El productor solo edita los eventos que
// él mismo registró.
// ==========================================

router.put(
  "/:id",
  protegerRuta,
  permitirRoles(
    "administrador",
    "productor"
  ),
  accesoEvento("gestionar"),
  actualizarEvento
);


// ==========================================
// ELIMINAR EVENTO
// ==========================================

router.delete(
  "/:id",
  protegerRuta,
  permitirRoles(
    "administrador"
  ),
  accesoEvento("gestionar"),
  eliminarEvento
);

module.exports =
  router;
