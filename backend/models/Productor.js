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

// Ubicación de la finca (la misma forma que en el lote).
// Al registrar un lote nuevo se copia automáticamente.
ubicacion: {
  provincia: { type: String, trim: true, default: "" },
  canton: { type: String, trim: true, default: "" },
  parroquia: { type: String, trim: true, default: "" },
  // Referencia para llegar a la finca
  descripcion: { type: String, trim: true, default: "" }
},

// Producción estimada (utils/produccionEstimada.js). Viene de
// la solicitud de cuenta y el administrador la puede corregir.
// Al registrar un lote nuevo llena la cantidad y las fechas.
produccion: {
  cantidadEstimadaKg: { type: Number, default: null },
  estadoGrano: { type: String, enum: ["seco", "baba", null], default: null },
  fechaSiembra: { type: Date, default: null },
  fechaEstimadaCosecha: { type: Date, default: null }
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
