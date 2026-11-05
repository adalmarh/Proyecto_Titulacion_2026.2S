const mongoose = require("mongoose");

const productorSchema = new mongoose.Schema(
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
  unique: true,
  trim: true
},

telefono: {
  type: String
},

email: {
  type: String,
  lowercase: true,
  trim: true
},

direccion: {
  type: String
},

asociacion: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Asociacion",
  required: true
},

usuario: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Usuario"
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

module.exports = mongoose.model("Productor", productorSchema);
