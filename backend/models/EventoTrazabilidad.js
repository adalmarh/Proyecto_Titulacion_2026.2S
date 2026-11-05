const mongoose = require("mongoose");


// ==========================================
// MODELO DE EVENTO DE TRAZABILIDAD
// ==========================================

const eventoTrazabilidadSchema = new mongoose.Schema(
  {
    // ========================================
    // LOTE
    // ========================================

    lote: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lote",
      required: true
    },


    // ========================================
    // TIPO DE EVENTO
    // ========================================

    tipo: {
      type: String,

      enum: [

        // Producción agrícola
        "siembra",

        "riego",

        "fertilizacion",

        "fumigacion",

        "control_fitosanitario",


        // Cosecha y poscosecha
        "cosecha",

        "almacenamiento",

        "procesamiento",


        // Control
        "control_calidad",

        "certificacion",


        // Logística
        "transporte",

        "distribucion",


        // Otros
        "otro"

      ],

      required: true
    },


    // ========================================
    // DESCRIPCIÓN
    // ========================================

    descripcion: {
      type: String,
      required: true,
      trim: true
    },


    // ========================================
    // FECHA
    // ========================================

    fecha: {
      type: Date,
      default: Date.now
    },


    // ========================================
    // RESPONSABLE
    // ========================================

    responsable: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      required: true
    },


    // ========================================
    // UBICACIÓN
    // ========================================

    ubicacion: {
      type: String,
      trim: true
    },


    // ========================================
    // EVIDENCIA
    // ========================================

    evidencia: {
      type: String,
      trim: true
    }

  },

  {
    timestamps: true
  }
);


// ==========================================
// ÍNDICES
// ==========================================

eventoTrazabilidadSchema.index({
  lote: 1,
  fecha: -1
});

eventoTrazabilidadSchema.index({
  tipo: 1
});


// ==========================================
// EXPORTAR MODELO
// ==========================================

module.exports =
  mongoose.model(
    "EventoTrazabilidad",
    eventoTrazabilidadSchema
  );