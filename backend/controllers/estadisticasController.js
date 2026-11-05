const Lote = require("../models/Lote");
const Productor = require("../models/Productor");
const Asociacion = require("../models/Asociacion");
const EventoTrazabilidad = require(
  "../models/EventoTrazabilidad"
);
const Certificacion = require(
  "../models/Certificacion"
);
const CodigoQR = require("../models/CodigoQR");

const {
  ROLES,
  filtroLotes,
  filtroProductores,
  filtroAsociaciones,
  filtroEventos,
  filtroCertificaciones
} = require("../middleware/alcanceMiddleware");


// Combina el filtro del rol con una condición extra
const y = (filtro, extra = {}) => ({
  $and: [filtro, extra]
});


// ==========================================
// OBTENER ESTADÍSTICAS DEL DASHBOARD
// Cada rol obtiene estadísticas solo de los
// datos que le corresponden.
// ==========================================

const obtenerEstadisticasDashboard =
  async (req, res) => {

    try {

      // ==========================================
      // ALCANCE DEL USUARIO
      // ==========================================

      const fLotes =
        await filtroLotes(req);

      const fProductores =
        await filtroProductores(req);

      const fAsociaciones =
        await filtroAsociaciones(req);

      const fEventos =
        await filtroEventos(req);

      const fCertificaciones =
        await filtroCertificaciones(req);

      const fQR =
        req.usuario.rol === ROLES.ADMIN
          ? {}
          : {
            lote: {
              $in: await Lote.distinct("_id", fLotes)
            }
          };


      // ==========================================
      // CONTADORES PRINCIPALES
      // ==========================================

      const totalLotes =
        await Lote.countDocuments(fLotes);

      const lotesActivos =
        await Lote.countDocuments(
          y(fLotes, { activo: true })
        );

      const totalProductores =
        await Productor.countDocuments(fProductores);

      const productoresActivos =
        await Productor.countDocuments(
          y(fProductores, { activo: true })
        );

      const totalAsociaciones =
        await Asociacion.countDocuments(fAsociaciones);

      // En el modelo Asociacion el campo
      // se llama "activa" (no "activo")
      const asociacionesActivas =
        await Asociacion.countDocuments(
          y(fAsociaciones, { activa: true })
        );

      const totalEventos =
        await EventoTrazabilidad.countDocuments(fEventos);

      const certificacionesAprobadas =
        await Certificacion.countDocuments(
          y(fCertificaciones, {
            estado: "aprobada",
            activo: true
          })
        );


      // ==========================================
      // ESTADÍSTICAS QR
      // ==========================================

      const estadisticasQR =
        await CodigoQR.aggregate([
          { $match: fQR },
          {
            $group: {
              _id: null,
              totalEscaneos: {
                $sum: "$totalEscaneos"
              },
              totalCodigosQR: {
                $sum: 1
              }
            }
          }
        ]);

      const totalEscaneos =
        estadisticasQR.length > 0
          ? estadisticasQR[0].totalEscaneos
          : 0;

      const totalCodigosQR =
        estadisticasQR.length > 0
          ? estadisticasQR[0].totalCodigosQR
          : 0;


      // ==========================================
      // LOTES POR ESTADO
      // ==========================================

      const lotesPorEstado =
        await Lote.aggregate([
          { $match: fLotes },
          {
            $group: {
              _id: "$estado",
              cantidad: { $sum: 1 }
            }
          },
          {
            $sort: { cantidad: -1 }
          }
        ]);


      // ==========================================
      // CERTIFICACIONES POR ESTADO
      // ==========================================

      const certificacionesPorEstado =
        await Certificacion.aggregate([
          {
            $match: y(fCertificaciones, { activo: true })
          },
          {
            $group: {
              _id: "$estado",
              cantidad: { $sum: 1 }
            }
          },
          {
            $sort: { cantidad: -1 }
          }
        ]);


      // ==========================================
      // ÚLTIMOS LOTES
      // ==========================================

      const ultimosLotes =
        await Lote.find(fLotes)
          .populate(
            "productor",
            "nombre apellido"
          )
          .populate(
            "asociacion",
            "nombre"
          )
          .sort({ createdAt: -1 })
          .limit(5);


      // ==========================================
      // ÚLTIMOS EVENTOS
      // ==========================================

      const ultimosEventos =
        await EventoTrazabilidad
          .find(fEventos)
          .populate(
            "lote",
            "codigo producto"
          )
          .populate(
            "responsable",
            "nombre apellido rol"
          )
          .sort({ fecha: -1 })
          .limit(5);


      // ==========================================
      // RESPUESTA FINAL
      // ==========================================

      return res.status(200).json({

        resumen: {
          totalLotes,
          lotesActivos,
          totalProductores,
          productoresActivos,
          totalAsociaciones,
          asociacionesActivas,
          totalEventos,
          certificacionesAprobadas,
          totalCodigosQR,
          totalEscaneos
        },

        lotesPorEstado,
        certificacionesPorEstado,
        ultimosLotes,
        ultimosEventos

      });

    } catch (error) {

      console.error(
        "Error al obtener estadísticas:",
        error
      );

      return res.status(500).json({
        mensaje:
          "Error al obtener las estadísticas del dashboard",
        error:
          error.message
      });

    }

  };


// ==========================================
// EXPORTAR FUNCIONES
// ==========================================

module.exports = {
  obtenerEstadisticasDashboard
};
