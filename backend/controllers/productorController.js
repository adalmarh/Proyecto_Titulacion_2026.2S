const Productor = require("../models/Productor");
const {
  filtroProductores
} = require("../middleware/alcanceMiddleware");

// ==========================================
// CREAR PRODUCTOR
// ==========================================
const crearProductor = async (req, res) => {
try {
const {
nombre,
apellido,
cedula,
telefono,
email,
direccion,
ubicacion
} = req.body;

if (!nombre || !apellido || !cedula) {
  return res.status(400).json({
    mensaje: "Nombre, apellido y cédula son obligatorios"
  });
}

// Verificar cédula
const productorExiste = await Productor.findOne({ cedula });

if (productorExiste) {
  return res.status(400).json({
    mensaje: "Ya existe un productor con esa cédula"
  });
}

const productor = await Productor.create({
  nombre,
  apellido,
  cedula,
  telefono,
  email,
  direccion,
  ubicacion
  // La cuenta de acceso (campo "usuario") se vincula
  // desde la gestión de usuarios del administrador.
});

const productorCompleto = await Productor.findById(productor._id);

res.status(201).json({
  mensaje: "Productor registrado correctamente",
  productor: productorCompleto
});

} catch (error) {
res.status(500).json({
mensaje: "Error al registrar el productor",
error: error.message
});
}
};

// ==========================================
// OBTENER PRODUCTORES
// ==========================================
const obtenerProductores = async (req, res) => {
try {
// Cada rol ve solo los productores de su alcance
const filtro = await filtroProductores(req);
const productores = await Productor.find(filtro)
.sort({ createdAt: -1 });

res.status(200).json(productores);

} catch (error) {
res.status(500).json({
mensaje: "Error al obtener los productores",
error: error.message
});
}
};

// ==========================================
// OBTENER PRODUCTOR
// ==========================================
const obtenerProductor = async (req, res) => {
try {
const productor = await Productor.findOne({
$and: [
  { _id: req.params.id },
  await filtroProductores(req)
]
});

if (!productor) {
  return res.status(404).json({
    mensaje: "Productor no encontrado"
  });
}

res.status(200).json(productor);

} catch (error) {
res.status(500).json({
mensaje: "Error al obtener el productor",
error: error.message
});
}
};

// ==========================================
// ACTUALIZAR PRODUCTOR
// ==========================================
const actualizarProductor = async (req, res) => {
try {
// La cuenta de acceso se vincula solo desde
// la gestión de usuarios.
const { usuario, ...datosActualizacion } = req.body || {};
const productor = await Productor.findByIdAndUpdate(
req.params.id,
datosActualizacion,
{
new: true,
runValidators: true
}
);

if (!productor) {
  return res.status(404).json({
    mensaje: "Productor no encontrado"
  });
}

res.status(200).json({
  mensaje: "Productor actualizado correctamente",
  productor
});

} catch (error) {
res.status(500).json({
mensaje: "Error al actualizar el productor",
error: error.message
});
}
};

// ==========================================
// DESACTIVAR PRODUCTOR
// ==========================================
const desactivarProductor = async (req, res) => {
try {
const productor = await Productor.findByIdAndUpdate(
req.params.id,
{ activo: false },
{ new: true }
);

if (!productor) {
  return res.status(404).json({
    mensaje: "Productor no encontrado"
  });
}

res.status(200).json({
  mensaje: "Productor desactivado correctamente",
  productor
});

} catch (error) {
res.status(500).json({
mensaje: "Error al desactivar el productor",
error: error.message
});
}
};

module.exports = {
crearProductor,
obtenerProductores,
obtenerProductor,
actualizarProductor,
desactivarProductor
};