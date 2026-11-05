const mongoose = require("mongoose");


// ==========================================
// CERTIFICADO PDF FIRMADO ELECTRÓNICAMENTE
// Guarda el PDF que el certificador firmó con
// su certificado (FirmaEC u otro firmador) y
// subió al sistema. Se guarda en MongoDB, no en
// el disco del servidor, para que no se pierda
// al publicar el sistema en un servicio en la
// nube. Un documento por certificación.
// ==========================================

const certificadoFirmadoSchema = new mongoose.Schema(
  {
    certificacion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Certificacion",
      required: true,
      unique: true
    },

    pdf: {
      type: Buffer,
      required: true
    },

    // Huella SHA-256 del archivo, para comprobar copias
    sha256: {
      type: String,
      required: true
    },

    tamano: {
      type: Number,
      required: true
    },

    subidoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario"
    }
  },
  {
    timestamps: true
  }
);


module.exports = mongoose.model("CertificadoFirmado", certificadoFirmadoSchema);
