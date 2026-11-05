const Asociacion = require("../models/Asociacion");
const {
  filtroAsociaciones
} = require("../middleware/alcanceMiddleware");

// ==========================================
// CREAR ASOCIACIÓN
// ==========================================
const crearAsociacion = async (req, res) => {
try {
const {
nombre,
ruc,
direccion,
provincia,
canton,
telefono,
email,
representante
} = req.body;


if (!nombre || !ruc || !direccion || !provincia || !canton) {
  return res.status(400).json({
    mensaje: "Los campos obligatorios no están completos"
  });
}

const existe = await Asociacion.findOne({ ruc });

if (existe) {
  return res.status(400).json({
    mensaje: "Ya existe una asociación con ese RUC"
  });
}

const asociacion = await Asociacion.create({
  nombre,
  ruc,
  direccion,
  provincia,
  canton,
  telefono,
  email,
  representante
});

res.status(201).json({
  mensaje: "Asociación creada correctamente",
  asociacion
});

} catch (error) {
res.status(500).json({
mensaje: "Error al crear la asociación",
error: error.message
});
}
};

// ==========================================
// OBTENER TODAS LAS ASOCIACIONES
// ==========================================
const obtenerAsociaciones = async (req, res) => {
try {
// Cada rol ve solo las asociaciones de su alcance
const filtro = await filtroAsociaciones(req);
const asociaciones = await Asociacion.find(filtro)
.sort({ createdAt: -1 });


res.status(200).json(asociaciones);

} catch (error) {
res.status(500).json({
mensaje: "Error al obtener las asociaciones",
error: error.message
});
}
};

// ==========================================
// OBTENER UNA ASOCIACIÓN
// ==========================================
const obtenerAsociacion = async (req, res) => {
try {
const asociacion = await Asociacion.findOne({
  $and: [
    { _id: req.params.id },
    await filtroAsociaciones(req)
  ]
});

if (!asociacion) {
  return res.status(404).json({
    mensaje: "Asociación no encontrada"
  });
}

res.status(200).json(asociacion);

} catch (error) {
res.status(500).json({
mensaje: "Error al obtener la asociación",
error: error.message
});
}
};

// ==========================================
// ACTUALIZAR ASOCIACIÓN
// ==========================================
const actualizarAsociacion = async (req, res) => {
try {
const asociacion = await Asociacion.findByIdAndUpdate(
req.params.id,
req.body,
{
new: true,
runValidators: true
}
);

if (!asociacion) {
  return res.status(404).json({
    mensaje: "Asociación no encontrada"
  });
}

res.status(200).json({
  mensaje: "Asociación actualizada correctamente",
  asociacion
});


} catch (error) {
res.status(500).json({
mensaje: "Error al actualizar la asociación",
error: error.message
});
}
};

// ==========================================
// DESACTIVAR ASOCIACIÓN
// ==========================================
const desactivarAsociacion = async (req, res) => {
try {
const asociacion = await Asociacion.findByIdAndUpdate(
req.params.id,
{ activa: false },
{ new: true }
);

if (!asociacion) {
  return res.status(404).json({
    mensaje: "Asociación no encontrada"
  });
}

res.status(200).json({
  mensaje: "Asociación desactivada correctamente",
  asociacion
});

} catch (error) {
res.status(500).json({
mensaje: "Error al desactivar la asociación",
error: error.message
});
}
};

module.exports = {
crearAsociacion,
obtenerAsociaciones,
obtenerAsociacion,
actualizarAsociacion,
desactivarAsociacion
};
