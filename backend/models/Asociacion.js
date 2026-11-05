const mongoose = require("mongoose");

const asociacionSchema = new mongoose.Schema(
{
nombre: {
type: String,
required: true,
trim: true
},

ruc: {
  type: String,
  required: true,
  unique: true,
  trim: true
},

direccion: {
  type: String,
  required: true
},

provincia: {
  type: String,
  required: true
},

canton: {
  type: String,
  required: true
},

telefono: {
  type: String
},

email: {
  type: String,
  trim: true,
  lowercase: true
},

representante: {
  type: String
},

activa: {
  type: Boolean,
  default: true
}

},
{
timestamps: true
}
);

module.exports = mongoose.model("Asociacion", asociacionSchema);
