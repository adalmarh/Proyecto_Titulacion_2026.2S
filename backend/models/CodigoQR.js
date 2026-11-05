const mongoose = require("mongoose");


const codigoQRSchema = new mongoose.Schema(
  {
    // Lote al que pertenece el código QR
    lote: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lote",
      required: true,
      unique: true
    },


    // Token único utilizado en la URL pública
    token: {
      type: String,
      required: true,
      unique: true,
      index: true
    },


    // URL que contiene el código QR
    urlPublica: {
      type: String,
      required: true
    },


    // Indica si el código QR está activo
    activo: {
      type: Boolean,
      default: true
    },


    // Número de veces que se ha consultado
    totalEscaneos: {
      type: Number,
      default: 0
    },


    // Fecha del último escaneo
    ultimoEscaneo: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);


module.exports = mongoose.model(
  "CodigoQR",
  codigoQRSchema
);