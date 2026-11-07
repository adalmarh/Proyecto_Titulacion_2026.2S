const mongoose = require("mongoose");


// ==========================================
// ESQUEMA DE LOTE
// ==========================================

const loteSchema = new mongoose.Schema(
  {
    codigo: {
      type: String,
      unique: true,
      trim: true
    },

    // ========================================
    // PRODUCTO
    // ========================================

    producto: {
      type: String,
      required: true,
      enum: ["Cacao fino de aroma"],
      default: "Cacao fino de aroma",
      trim: true
    },

    descripcion: {
      type: String,
      trim: true
    },

    productor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Productor",
      required: true
    },

    ubicacion: {
      provincia: String,
      canton: String,
      parroquia: String,
      descripcion: String
    },

    fechaSiembra: {
      type: Date
    },

    fechaEstimadaCosecha: {
      type: Date
    },

    fechaCosecha: {
      type: Date
    },

    cantidad: {
      type: Number,
      required: true,
      min: 0
    },

    // Siempre "kg": si se escribe en quintales, el
    // backend la convierte (utils/cantidades.js)
    unidad: {
      type: String,
      default: "kg"
    },

    // Estado del grano: seco (fermentado y secado)
    // o en baba (fresco)
    estadoGrano: {
      type: String,
      enum: ["seco", "baba"],
      default: "seco"
    },

    estado: {
      type: String,
      enum: [
        "activo",
        "en_produccion",
        "cosechado",
        "almacenado",
        "transportado",
        "distribuido",
        "finalizado"
      ],
      default: "activo"
    },

    activo: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);


// ==========================================
// GENERAR CÓDIGO AUTOMÁTICO DEL LOTE
// ==========================================

loteSchema.pre("save", async function () {

  if (this.codigo) {
    return;
  }

  const año =
    new Date().getFullYear();

  const ultimoLote =
    await mongoose
      .model("Lote")
      .findOne()
      .sort({
        createdAt: -1
      });

  let numero = 1;

  if (
    ultimoLote &&
    ultimoLote.codigo
  ) {

    const partes =
      ultimoLote.codigo.split("-");

    if (partes.length === 3) {

      const ultimoNumero =
        parseInt(
          partes[2],
          10
        );

      if (
        !isNaN(
          ultimoNumero
        )
      ) {
        numero =
          ultimoNumero + 1;
      }
    }
  }

  this.codigo =
    `LOT-${año}-${String(numero).padStart(4, "0")}`;
});


module.exports =
  mongoose.model(
    "Lote",
    loteSchema
  );