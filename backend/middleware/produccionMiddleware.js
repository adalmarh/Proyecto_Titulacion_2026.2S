// ==========================================================
// AJUSTES PARA EL SISTEMA PUBLICADO (producción)
// ----------------------------------------------------------
// 1. origenesPermitidos: CORS solo para la dirección del
//    frontend. Se configura con CORS_ORIGINS (una o varias
//    direcciones separadas por comas). Sin esa variable se
//    permite cualquier origen, como en desarrollo.
//
// 2. ocultarErroresInternos: en producción
//    (NODE_ENV=production), las respuestas de error 500 no
//    envían al navegador el detalle técnico del error
//    (campo «error»); el detalle queda en el registro del
//    servidor. Así no se filtran nombres de colecciones,
//    rutas de archivos ni mensajes de MongoDB.
// ==========================================================

const origenesPermitidos = () => {
  const lista = String(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  if (lista.length === 0) {
    return {};
  }

  return {
    origin: (origen, listo) => {
      // Sin origen: Postman, el ping de salud o el mismo servidor
      if (!origen || lista.includes(origen)) {
        return listo(null, true);
      }
      return listo(null, false);
    }
  };
};


const ocultarErroresInternos = (req, res, next) => {
  if (process.env.NODE_ENV !== "production") {
    return next();
  }

  const responder = res.json.bind(res);

  res.json = (cuerpo) => {
    if (res.statusCode >= 500 && cuerpo && typeof cuerpo === "object" && "error" in cuerpo) {
      const { error, ...resto } = cuerpo;
      console.error(`[${req.method} ${req.originalUrl}] ${resto.mensaje || "Error interno"}:`, error);
      return responder(resto);
    }
    return responder(cuerpo);
  };

  next();
};


module.exports = {
  origenesPermitidos,
  ocultarErroresInternos
};
