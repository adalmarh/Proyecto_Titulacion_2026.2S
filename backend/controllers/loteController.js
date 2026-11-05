const Lote =
  require("../models/Lote");

const Productor =
  require("../models/Productor");

const Asociacion =
  require("../models/Asociacion");

const {
  filtroLotes
} = require("../middleware/alcanceMiddleware");


// ==========================================
// PRODUCTO ÚNICO DEL SISTEMA
// ==========================================

const PRODUCTO_CACAO =
  "Cacao fino de aroma";


// ==========================================
// CREAR LOTE
// ==========================================

const crearLote = async (
  req,
  res
) => {

  try {

    const {
      producto,
      descripcion,
      productor,
      asociacion,
      ubicacion,
      fechaSiembra,
      fechaEstimadaCosecha,
      cantidad,
      unidad
    } = req.body;


    // ========================================
    // VALIDAR CAMPOS OBLIGATORIOS
    // ========================================

    if (
      !productor ||
      !asociacion ||
      cantidad === undefined
    ) {

      return res.status(400).json({
        mensaje:
          "Productor, asociación y cantidad son obligatorios"
      });

    }


    // ========================================
    // VALIDAR PRODUCTO
    // ========================================

    if (
      producto &&
      producto !== PRODUCTO_CACAO
    ) {

      return res.status(400).json({
        mensaje:
          `El sistema está delimitado exclusivamente al producto "${PRODUCTO_CACAO}"`
      });

    }


    // ========================================
    // VERIFICAR PRODUCTOR
    // ========================================

    const productorExiste =
      await Productor.findById(
        productor
      );


    if (!productorExiste) {

      return res.status(404).json({
        mensaje:
          "El productor no existe"
      });

    }


    // ========================================
    // VERIFICAR ASOCIACIÓN
    // ========================================

    const asociacionExiste =
      await Asociacion.findById(
        asociacion
      );


    if (!asociacionExiste) {

      return res.status(404).json({
        mensaje:
          "La asociación no existe"
      });

    }


    // ========================================
    // VERIFICAR RELACIÓN
    // PRODUCTOR - ASOCIACIÓN
    // ========================================

    if (
      productorExiste.asociacion.toString() !==
      asociacion
    ) {

      return res.status(400).json({
        mensaje:
          "El productor no pertenece a la asociación seleccionada"
      });

    }


    // ========================================
    // CREAR LOTE
    // ========================================

    const lote =
      await Lote.create({

        producto:
          PRODUCTO_CACAO,

        descripcion,

        productor,

        asociacion,

        ubicacion,

        fechaSiembra,

        fechaEstimadaCosecha,

        cantidad,

        unidad

      });


    // ========================================
    // OBTENER LOTE COMPLETO
    // ========================================

    const loteCompleto =
      await Lote
        .findById(
          lote._id
        )
        .populate(
          "productor",
          "nombre apellido cedula"
        )
        .populate(
          "asociacion",
          "nombre ruc"
        );


    // ========================================
    // RESPUESTA
    // ========================================

    return res.status(201).json({

      mensaje:
        "Lote de cacao fino de aroma creado correctamente",

      lote:
        loteCompleto

    });

  } catch (error) {

    console.error(
      "Error al crear el lote:",
      error
    );

    return res.status(500).json({

      mensaje:
        "Error al crear el lote",

      error:
        error.message

    });

  }

};


// ==========================================
// OBTENER TODOS LOS LOTES
// ==========================================

const obtenerLotes = async (
  req,
  res
) => {

  try {

    // Cada rol ve solo los lotes de su alcance
    const filtro =
      await filtroLotes(req);


    const lotes =
      await Lote
        .find(filtro)
        .populate(
          "productor",
          "nombre apellido cedula"
        )
        .populate(
          "asociacion",
          "nombre ruc"
        )
        .sort({
          createdAt: -1
        });


    return res.status(200).json(
      lotes
    );

  } catch (error) {

    console.error(
      "Error al obtener los lotes:",
      error
    );

    return res.status(500).json({

      mensaje:
        "Error al obtener los lotes",

      error:
        error.message

    });

  }

};


// ==========================================
// OBTENER LOTE POR ID
// ==========================================

const obtenerLote = async (
  req,
  res
) => {

  try {

    const lote =
      await Lote
        .findById(
          req.params.id
        )
        .populate(
          "productor",
          "nombre apellido cedula telefono email"
        )
        .populate(
          "asociacion",
          "nombre ruc provincia canton"
        );


    if (!lote) {

      return res.status(404).json({

        mensaje:
          "Lote no encontrado"

      });

    }


    return res.status(200).json(
      lote
    );

  } catch (error) {

    console.error(
      "Error al obtener el lote:",
      error
    );

    return res.status(500).json({

      mensaje:
        "Error al obtener el lote",

      error:
        error.message

    });

  }

};


// ==========================================
// OBTENER LOTES POR PRODUCTOR
// ==========================================

const obtenerLotesPorProductor =
  async (
    req,
    res
  ) => {

    try {

      const productor =
        await Productor.findById(
          req.params.productorId
        );


      if (!productor) {

        return res.status(404).json({

          mensaje:
            "Productor no encontrado"

        });

      }


      const lotes =
        await Lote
          .find({
            $and: [
              {
                productor:
                  req.params.productorId
              },
              await filtroLotes(req)
            ]
          })
          .populate(
            "asociacion",
            "nombre ruc"
          )
          .sort({
            createdAt: -1
          });


      return res.status(200).json(
        lotes
      );

    } catch (error) {

      console.error(
        "Error al obtener los lotes del productor:",
        error
      );

      return res.status(500).json({

        mensaje:
          "Error al obtener los lotes del productor",

        error:
          error.message

      });

    }

  };


// ==========================================
// ACTUALIZAR LOTE
// ==========================================

const actualizarLote = async (
  req,
  res
) => {

  try {

    // ========================================
    // NO PERMITIR CAMBIAR:
    // código, productor, asociación
    // ========================================

    const {
      codigo,
      productor,
      asociacion,
      producto,
      ...datosActualizacion
    } = req.body;


    // ========================================
    // VALIDAR PRODUCTO
    // ========================================

    if (
      producto &&
      producto !== PRODUCTO_CACAO
    ) {

      return res.status(400).json({

        mensaje:
          `El sistema está delimitado exclusivamente al producto "${PRODUCTO_CACAO}"`

      });

    }


    // ========================================
    // FORZAR PRODUCTO
    // ========================================

    datosActualizacion.producto =
      PRODUCTO_CACAO;


    // ========================================
    // ACTUALIZAR
    // ========================================

    const lote =
      await Lote.findByIdAndUpdate(

        req.params.id,

        datosActualizacion,

        {
          new: true,
          runValidators: true
        }

      )
        .populate(
          "productor",
          "nombre apellido cedula"
        )
        .populate(
          "asociacion",
          "nombre ruc"
        );


    if (!lote) {

      return res.status(404).json({

        mensaje:
          "Lote no encontrado"

      });

    }


    return res.status(200).json({

      mensaje:
        "Lote de cacao fino de aroma actualizado correctamente",

      lote

    });

  } catch (error) {

    console.error(
      "Error al actualizar el lote:",
      error
    );

    return res.status(500).json({

      mensaje:
        "Error al actualizar el lote",

      error:
        error.message

    });

  }

};


// ==========================================
// ACTUALIZAR ESTADO DEL LOTE
// ==========================================

const actualizarEstadoLote =
  async (
    req,
    res
  ) => {

    try {

      const {
        estado
      } = req.body;


      if (!estado) {

        return res.status(400).json({

          mensaje:
            "El estado es obligatorio"

        });

      }


      const lote =
        await Lote.findById(
          req.params.id
        );


      if (!lote) {

        return res.status(404).json({

          mensaje:
            "Lote no encontrado"

        });

      }


      lote.estado =
        estado;


      await lote.save();


      return res.status(200).json({

        mensaje:
          "Estado del lote actualizado correctamente",

        lote

      });

    } catch (error) {

      console.error(
        "Error al actualizar el estado:",
        error
      );

      return res.status(500).json({

        mensaje:
          "Error al actualizar el estado",

        error:
          error.message

      });

    }

  };


// ==========================================
// DESACTIVAR LOTE
// ==========================================

const desactivarLote =
  async (
    req,
    res
  ) => {

    try {

      const lote =
        await Lote.findByIdAndUpdate(

          req.params.id,

          {
            activo: false
          },

          {
            new: true
          }

        );


      if (!lote) {

        return res.status(404).json({

          mensaje:
            "Lote no encontrado"

        });

      }


      return res.status(200).json({

        mensaje:
          "Lote desactivado correctamente",

        lote

      });

    } catch (error) {

      console.error(
        "Error al desactivar el lote:",
        error
      );

      return res.status(500).json({

        mensaje:
          "Error al desactivar el lote",

        error:
          error.message

      });

    }

  };


// ==========================================
// EXPORTACIONES
// ==========================================

module.exports = {

  crearLote,

  obtenerLotes,

  obtenerLote,

  obtenerLotesPorProductor,

  actualizarLote,

  actualizarEstadoLote,

  desactivarLote

};