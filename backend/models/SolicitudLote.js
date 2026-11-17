const mongoose = require("mongoose");


// ==========================================================
// SOLICITUD DE LOTE
// El productor pide al administrador que registre un lote
// nuevo de su cacao. El administrador la aprueba creando el
// lote (con el formulario de siempre, ya lleno con estos
// datos) o la rechaza indicando el motivo.
// ==========================================================

const solicitudLoteSchema = new mongoose.Schema(
  {
    productor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Productor",
      required: true
    },

    solicitadoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      required: true
    },

    // Cantidad aproximada, siempre en kg
    cantidadKg: {
      type: Number,
      required: true
    },

    estadoGrano: {
      type: String,
      enum: ["seco", "baba"],
      default: "seco"
    },

    fechaSiembra: {
      type: Date,
      default: null
    },

    fechaEstimadaCosecha: {
      type: Date,
      default: null
    },

    // Mensaje del productor (variedad, parcela, etc.)
    mensaje: {
      type: String,
      trim: true,
      default: ""
    },

    estado: {
      type: String,
      enum: ["pendiente", "aprobada", "rechazada", "cancelada"],
      default: "pendiente"
    },

    motivoRechazo: {
      type: String,
      trim: true,
      default: ""
    },

    // Lote que se creó al aprobarla
    lote: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lote",
      default: null
    },

    revisadoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      default: null
    },

    fechaRevision: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("SolicitudLote", solicitudLoteSchema);
