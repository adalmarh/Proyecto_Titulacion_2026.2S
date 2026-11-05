const mongoose = require("mongoose");


// ==========================================
// ESQUEMA DE USUARIO
// ==========================================

const usuarioSchema = new mongoose.Schema(
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

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },

    // Contraseña cifrada con bcrypt.
    // La longitud mínima (6 caracteres) se valida
    // en el controlador ANTES de cifrarla.
    password: {
      type: String,
      required: true
    },

    rol: {
      type: String,
      enum: [
        "administrador",
        "asociacion",
        "productor",
        "certificador"
      ],
      default: "productor"
    },

    // ========================================
    // ASOCIACIÓN DEL USUARIO
    // Obligatoria cuando el rol es "asociacion":
    // limita lo que ve y gestiona a su asociación.
    // (El usuario con rol "productor" se vincula
    // mediante el campo Productor.usuario.)
    // ========================================

    asociacion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Asociacion",
      default: null
    },

    activo: {
      type: Boolean,
      default: true
    },

    // Celular de contacto (09XXXXXXXX). En el productor
    // se guarda también en su ficha de Productor.
    telefono: {
      type: String,
      trim: true,
      default: ""
    },

    // Fecha del último cambio de contraseña. Las sesiones
    // (tokens) emitidas antes de esta fecha dejan de valer.
    passwordCambiado: {
      type: Date,
      default: null
    },

    // ========================================
    // CONSENTIMIENTO DEL AVISO DE PRIVACIDAD
    // Versión aceptada y fecha (Ley Orgánica de
    // Protección de Datos Personales, art. 8).
    // ========================================

    consentimiento: {
      version: { type: String, default: "" },
      fecha: { type: Date, default: null }
    }
  },
  {
    timestamps: true
  }
);


module.exports = mongoose.model("Usuario", usuarioSchema);
