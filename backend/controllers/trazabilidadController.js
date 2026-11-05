const EventoTrazabilidad =
  require("../models/EventoTrazabilidad");

const Lote =
  require("../models/Lote");

const {
  filtroEventos
} = require("../middleware/alcanceMiddleware");


// ==========================================
// OBTENER TODOS LOS EVENTOS
// ==========================================

const obtenerEventos = async (
  req,
  res
) => {

  try {

    // Cada rol ve solo los eventos de sus lotes
    const filtro =
      await filtroEventos(req);


    const eventos =
      await EventoTrazabilidad
        .find(filtro)
        .populate(
          "lote",
          "codigo producto"
        )
        .populate(
          "responsable",
          "nombre apellido email rol"
        )
        .sort({
          fecha: -1
        });


    return res.status(200).json({

      total:
        eventos.length,

      eventos

    });


  } catch (error) {

    console.error(
      "Error al obtener eventos:",
      error
    );


    return res.status(500).json({

      mensaje:
        "Error al obtener los eventos de trazabilidad",

      error:
        error.message

    });

  }

};


// ==========================================
// OBTENER EVENTOS DE UN LOTE
// ==========================================

const obtenerEventosPorLote =
  async (
    req,
    res
  ) => {

    try {

      const {
        loteId
      } = req.params;


      // ======================================
      // VERIFICAR LOTE
      // ======================================

      const lote =
        await Lote.findById(
          loteId
        );


      if (!lote) {

        return res.status(404).json({

          mensaje:
            "El lote no existe"

        });

      }


      // ======================================
      // BUSCAR EVENTOS
      // ======================================

      const eventos =
        await EventoTrazabilidad
          .find({
            lote: loteId
          })
          .populate(
            "responsable",
            "nombre apellido email rol"
          )
          .sort({
            fecha: 1
          });


      return res.status(200).json({

        lote: {

          _id:
            lote._id,

          codigo:
            lote.codigo,

          producto:
            lote.producto

        },

        total:
          eventos.length,

        eventos

      });


    } catch (error) {

      console.error(
        "Error al obtener eventos del lote:",
        error
      );


      return res.status(500).json({

        mensaje:
          "Error al obtener la trazabilidad del lote",

        error:
          error.message

      });

    }

  };


// ==========================================
// CREAR EVENTO
// ==========================================

const crearEvento = async (
  req,
  res
) => {

  try {

    const {
      lote,
      tipo,
      descripcion,
      fecha,
      ubicacion,
      evidencia
    } = req.body;


    // ======================================
    // VALIDACIONES
    // ======================================

    if (
      !lote ||
      !tipo ||
      !descripcion
    ) {

      return res.status(400).json({

        mensaje:
          "Lote, tipo y descripción son obligatorios"

      });

    }


    // ======================================
    // VERIFICAR LOTE
    // ======================================

    const loteExiste =
      await Lote.findById(
        lote
      );


    if (!loteExiste) {

      return res.status(404).json({

        mensaje:
          "El lote seleccionado no existe"

      });

    }


    // ======================================
    // CREAR EVENTO
    // ======================================

    const nuevoEvento =
      await EventoTrazabilidad.create({

        lote,

        tipo,

        descripcion,

        fecha:
          fecha || new Date(),

        responsable:
          req.usuario._id,

        ubicacion,

        evidencia

      });


    // ======================================
    // OBTENER EVENTO COMPLETO
    // ======================================

    const eventoCreado =
      await EventoTrazabilidad
        .findById(
          nuevoEvento._id
        )
        .populate(
          "lote",
          "codigo producto"
        )
        .populate(
          "responsable",
          "nombre apellido email rol"
        );


    return res.status(201).json({

      mensaje:
        "Evento de trazabilidad registrado correctamente",

      evento:
        eventoCreado

    });


  } catch (error) {

    console.error(
      "Error al crear evento:",
      error
    );


    return res.status(500).json({

      mensaje:
        "Error al registrar el evento de trazabilidad",

      error:
        error.message

    });

  }

};


// ==========================================
// OBTENER UN EVENTO
// ==========================================

const obtenerEvento = async (
  req,
  res
) => {

  try {

    const evento =
      await EventoTrazabilidad
        .findById(req.params.id)
        .populate(
          "lote",
          "codigo producto"
        )
        .populate(
          "responsable",
          "nombre apellido email rol"
        );


    if (!evento) {

      return res.status(404).json({

        mensaje:
          "El evento no existe"

      });

    }


    return res.status(200).json(evento);


  } catch (error) {

    return res.status(500).json({

      mensaje:
        "Error al obtener el evento",

      error:
        error.message

    });

  }

};


// ==========================================
// ACTUALIZAR EVENTO
// ==========================================

const actualizarEvento = async (
  req,
  res
) => {

  try {

    const {
      lote,
      responsable,
      ...datosActualizacion
    } = req.body;


    const evento =
      await EventoTrazabilidad
        .findByIdAndUpdate(
          req.params.id,
          datosActualizacion,
          {
            new: true,
            runValidators: true
          }
        )
        .populate(
          "lote",
          "codigo producto"
        )
        .populate(
          "responsable",
          "nombre apellido email rol"
        );


    if (!evento) {

      return res.status(404).json({

        mensaje:
          "El evento no existe"

      });

    }


    return res.status(200).json({

      mensaje:
        "Evento actualizado correctamente",

      evento

    });


  } catch (error) {

    return res.status(500).json({

      mensaje:
        "Error al actualizar el evento",

      error:
        error.message

    });

  }

};


// ==========================================
// ELIMINAR EVENTO
// ==========================================

const eliminarEvento = async (
  req,
  res
) => {

  try {

    const {
      id
    } = req.params;


    const evento =
      await EventoTrazabilidad.findById(
        id
      );


    if (!evento) {

      return res.status(404).json({

        mensaje:
          "El evento no existe"

      });

    }


    await EventoTrazabilidad.findByIdAndDelete(
      id
    );


    return res.status(200).json({

      mensaje:
        "Evento eliminado correctamente"

    });


  } catch (error) {

    console.error(
      "Error al eliminar evento:",
      error
    );


    return res.status(500).json({

      mensaje:
        "Error al eliminar el evento",

      error:
        error.message

    });

  }

};


module.exports = {

  obtenerEventos,

  obtenerEventosPorLote,

  obtenerEvento,

  crearEvento,

  actualizarEvento,

  eliminarEvento

};