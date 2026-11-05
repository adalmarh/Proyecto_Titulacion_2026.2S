const express = require("express");

const {
  generarCodigoQR,
  obtenerCodigoQRPorLote,
  regenerarCodigoQR,
  desactivarCodigoQR
} = require("../controllers/qrController");

const protegerRuta =
  require("../middleware/authMiddleware");

const permitirRoles =
  require("../middleware/rolesMiddleware");

const {
  accesoLote
} = require("../middleware/alcanceMiddleware");

const router =
  express.Router();

// Id del lote en la URL
const loteDeLaUrl = (req) => req.params.loteId;


// ==========================================
// GENERAR QR PARA UN LOTE
// Solo sobre lotes que el usuario gestiona.
// ==========================================

router.post(
  "/lote/:loteId",
  protegerRuta,
  permitirRoles(
    "administrador",
    "asociacion",
    "productor"
  ),
  accesoLote(loteDeLaUrl, "gestionar"),
  generarCodigoQR
);


// ==========================================
// OBTENER QR DE UN LOTE
// ==========================================

router.get(
  "/lote/:loteId",
  protegerRuta,
  accesoLote(loteDeLaUrl, "ver"),
  obtenerCodigoQRPorLote
);


// ==========================================
// REGENERAR QR
// ==========================================

router.patch(
  "/lote/:loteId/regenerar",
  protegerRuta,
  permitirRoles(
    "administrador",
    "asociacion"
  ),
  accesoLote(loteDeLaUrl, "gestionar"),
  regenerarCodigoQR
);


// ==========================================
// DESACTIVAR QR
// ==========================================

router.patch(
  "/lote/:loteId/desactivar",
  protegerRuta,
  permitirRoles(
    "administrador",
    "asociacion"
  ),
  accesoLote(loteDeLaUrl, "gestionar"),
  desactivarCodigoQR
);

module.exports =
  router;
