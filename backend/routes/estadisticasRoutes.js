const express = require("express");

const {

  obtenerEstadisticasDashboard

} = require(
  "../controllers/estadisticasController"
);


const protegerRuta =
  require(
    "../middleware/authMiddleware"
  );


const router =
  express.Router();


// ==========================================
// ESTADÍSTICAS DEL DASHBOARD
// ==========================================

router.get(

  "/dashboard",

  protegerRuta,

  obtenerEstadisticasDashboard

);


module.exports =
  router;