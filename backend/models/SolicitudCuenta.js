const mongoose = require("mongoose");


// ==========================================
// SOLICITUD DE CUENTA
// Una persona pide acceso desde la pantalla de
// inicio de sesión. La cuenta (Usuario) solo se
// crea cuando el administrador, o la asociación
// en el caso de sus productores, la aprueba.
// Solo se pueden pedir los roles "productor" y
// "asociacion"; nunca administrador ni certificador.
// ==========================================

const solicitudCuentaSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true
    },

    apellido: {
      type: String,
      required: true,
      trim: true
    },

    cedula: {
      type: String,
      required: true,
      trim: true
    },

    telefono: {
      type: String,
      trim: true
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },

    // Contraseña elegida por la persona, ya cifrada
    // con bcrypt. Pasa tal cual al Usuario al aprobar
    // y entonces se borra de la solicitud.
    password: {
      type: String
    },

    // Aceptación del aviso de privacidad al enviar
    consentimiento: {
      version: { type: String, default: "" },
      fecha: { type: Date, default: null }
    },

    rolSolicitado: {
      type: String,
      enum: ["productor", "asociacion"],
      required: true
    },

    // ---------- Ubicación para verificar en campo ----------
    // Productor: dónde está su finca. Asociación: su sede.
    provincia: {
      type: String,
      trim: true,
      default: ""
    },

    canton: {
      type: String,
      trim: true,
      default: ""
    },

    // Parroquia o recinto
    parroquia: {
      type: String,
      trim: true,
      default: ""
    },

    // Dirección o referencia para llegar
    direccion: {
      type: String,
      trim: true,
      default: ""
    },

    // Asociación a la que pertenece (productor) o
    // que quiere administrar (asociación)
    asociacion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Asociacion",
      default: null
    },

    // Si la asociación aún no está registrada
    nombreAsociacion: {
      type: String,
      trim: true,
      default: ""
    },

    mensaje: {
      type: String,
      trim: true,
      default: ""
    },

    estado: {
      type: String,
      enum: ["pendiente", "aprobada", "rechazada"],
      default: "pendiente"
    },

    motivoRechazo: {
      type: String,
      trim: true,
      default: ""
    },

    revisadoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      default: null
    },

    fechaRevision: {
      type: Date,
      default: null
    },

    usuarioCreado: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usuario",
      default: null
    }
  },
  {
    timestamps: true
  }
);

solicitudCuentaSchema.index({ email: 1, estado: 1 });
solicitudCuentaSchema.index({ asociacion: 1, estado: 1 });


module.exports = mongoose.model("SolicitudCuenta", solicitudCuentaSchema);
