const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const Usuario = require("../models/Usuario");
const Asociacion = require("../models/Asociacion");
const Productor = require("../models/Productor");


// ==========================================
// GESTIÓN DE USUARIOS (solo administrador)
// ------------------------------------------
// El administrador crea las cuentas y las
// vincula según su rol:
//  - asociacion: a una asociación.
//  - productor:  a un productor registrado.
//  - certificador y administrador: sin vínculo.
// ==========================================

const ROLES_VALIDOS = [
  "administrador",
  "asociacion",
  "productor",
  "certificador"
];

const LONGITUD_MINIMA_PASSWORD = 6;

const idValido = (id) =>
  mongoose.Types.ObjectId.isValid(id);


// Error de validación con su código HTTP
class ErrorValidacion extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje);
    this.status = status;
  }
}

const responderError = (res, error, mensajeGeneral) => {
  if (error instanceof ErrorValidacion) {
    return res.status(error.status).json({
      mensaje: error.message
    });
  }

  console.error(`${mensajeGeneral}:`, error);

  return res.status(500).json({
    mensaje: mensajeGeneral,
    error: error.message
  });
};


// Datos que se devuelven al frontend (sin contraseña)
const formatearUsuario = (usuario, productor) => ({
  _id: usuario._id,
  nombre: usuario.nombre,
  apellido: usuario.apellido,
  email: usuario.email,
  rol: usuario.rol,
  activo: usuario.activo,
  asociacion: usuario.asociacion || null,
  productor: productor
    ? {
      _id: productor._id,
      nombre: productor.nombre,
      apellido: productor.apellido,
      cedula: productor.cedula
    }
    : null,
  createdAt: usuario.createdAt,
  updatedAt: usuario.updatedAt
});


// ==========================================
// VALIDAR VÍNCULOS SEGÚN EL ROL
// Devuelve { asociacion, productor } listos
// para guardar.
// ==========================================

const validarVinculos = async ({
  rol,
  asociacion,
  productor,
  usuarioId
}) => {

  if (rol === "asociacion") {
    if (!asociacion || !idValido(asociacion)) {
      throw new ErrorValidacion(
        "Debe seleccionar la asociación del usuario"
      );
    }

    const existe = await Asociacion.findOne({
      _id: asociacion,
      activa: true
    });

    if (!existe) {
      throw new ErrorValidacion(
        "La asociación no existe o está desactivada",
        404
      );
    }

    return { asociacion: existe._id, productor: null };
  }

  if (rol === "productor") {
    if (!productor || !idValido(productor)) {
      throw new ErrorValidacion(
        "Debe seleccionar el productor al que pertenece la cuenta"
      );
    }

    const existe = await Productor.findOne({
      _id: productor,
      activo: true
    });

    if (!existe) {
      throw new ErrorValidacion(
        "El productor no existe o está desactivado",
        404
      );
    }

    // Un productor solo puede tener una cuenta
    if (
      existe.usuario &&
      String(existe.usuario) !== String(usuarioId)
    ) {
      throw new ErrorValidacion(
        "Ese productor ya tiene una cuenta de usuario"
      );
    }

    return { asociacion: null, productor: existe };
  }

  return { asociacion: null, productor: null };
};


// Deja vinculado el usuario solo al productor indicado
// (o a ninguno si productor es null).
const vincularProductor = async (usuarioId, productor) => {
  await Productor.updateMany(
    {
      usuario: usuarioId,
      ...(productor ? { _id: { $ne: productor._id } } : {})
    },
    { $unset: { usuario: "" } }
  );

  if (productor) {
    await Productor.updateOne(
      { _id: productor._id },
      { usuario: usuarioId }
    );
  }
};


// ==========================================
// LISTAR USUARIOS
// ==========================================

const obtenerUsuarios = async (req, res) => {
  try {
    const usuarios = await Usuario.find()
      .select("-password")
      .populate("asociacion", "nombre ruc")
      .sort({ createdAt: -1 });

    const productores = await Productor.find({
      usuario: { $in: usuarios.map((u) => u._id) }
    }).select("nombre apellido cedula usuario");

    const productorPorUsuario = new Map(
      productores.map((p) => [String(p.usuario), p])
    );

    return res.status(200).json({
      total: usuarios.length,
      usuarios: usuarios.map((u) =>
        formatearUsuario(u, productorPorUsuario.get(String(u._id)))
      )
    });

  } catch (error) {
    return responderError(res, error, "Error al obtener los usuarios");
  }
};


// ==========================================
// CREAR USUARIO
// ==========================================

const crearUsuario = async (req, res) => {
  try {
    const {
      nombre,
      apellido,
      email,
      password,
      rol,
      asociacion,
      productor
    } = req.body || {};

    if (!nombre || !apellido || !email || !password || !rol) {
      throw new ErrorValidacion(
        "Nombre, apellido, correo, contraseña y rol son obligatorios"
      );
    }

    if (!ROLES_VALIDOS.includes(rol)) {
      throw new ErrorValidacion("El rol seleccionado no es válido");
    }

    if (String(password).length < LONGITUD_MINIMA_PASSWORD) {
      throw new ErrorValidacion(
        `La contraseña debe tener al menos ${LONGITUD_MINIMA_PASSWORD} caracteres`
      );
    }

    const correo = String(email).trim().toLowerCase();

    if (await Usuario.exists({ email: correo })) {
      throw new ErrorValidacion("Ya existe un usuario con ese correo");
    }

    const vinculos = await validarVinculos({
      rol,
      asociacion,
      productor,
      usuarioId: null
    });

    const passwordCifrada = await bcrypt.hash(
      String(password),
      await bcrypt.genSalt(10)
    );

    const usuario = await Usuario.create({
      nombre,
      apellido,
      email: correo,
      password: passwordCifrada,
      rol,
      asociacion: vinculos.asociacion
    });

    await vincularProductor(usuario._id, vinculos.productor);

    await usuario.populate("asociacion", "nombre ruc");

    return res.status(201).json({
      mensaje: "Usuario creado correctamente",
      usuario: formatearUsuario(usuario, vinculos.productor)
    });

  } catch (error) {
    return responderError(res, error, "Error al crear el usuario");
  }
};


// ==========================================
// ACTUALIZAR USUARIO
// La contraseña solo se cambia si se envía.
// ==========================================

const actualizarUsuario = async (req, res) => {
  try {
    if (!idValido(req.params.id)) {
      throw new ErrorValidacion("El identificador no es válido");
    }

    const usuario = await Usuario.findById(req.params.id);

    if (!usuario) {
      throw new ErrorValidacion("Usuario no encontrado", 404);
    }

    const {
      nombre,
      apellido,
      email,
      password,
      rol,
      asociacion,
      productor
    } = req.body || {};

    const nuevoRol = rol || usuario.rol;

    if (!ROLES_VALIDOS.includes(nuevoRol)) {
      throw new ErrorValidacion("El rol seleccionado no es válido");
    }

    // El administrador no puede quitarse a sí mismo
    // el rol de administrador.
    if (
      String(usuario._id) === String(req.usuario._id) &&
      nuevoRol !== "administrador"
    ) {
      throw new ErrorValidacion(
        "No puedes quitarte el rol de administrador"
      );
    }

    if (email) {
      const correo = String(email).trim().toLowerCase();

      const repetido = await Usuario.exists({
        email: correo,
        _id: { $ne: usuario._id }
      });

      if (repetido) {
        throw new ErrorValidacion("Ya existe un usuario con ese correo");
      }

      usuario.email = correo;
    }

    if (password) {
      if (String(password).length < LONGITUD_MINIMA_PASSWORD) {
        throw new ErrorValidacion(
          `La contraseña debe tener al menos ${LONGITUD_MINIMA_PASSWORD} caracteres`
        );
      }

      usuario.password = await bcrypt.hash(
        String(password),
        await bcrypt.genSalt(10)
      );
      // Cierra las sesiones abiertas con la contraseña anterior
      usuario.passwordCambiado = new Date();
    }

    // Si no se envía un vínculo nuevo, se conserva el actual
    let productorActual = null;

    if (nuevoRol === "productor" && !productor) {
      productorActual = await Productor.findOne({ usuario: usuario._id });
    }

    const vinculos = await validarVinculos({
      rol: nuevoRol,
      asociacion: asociacion || usuario.asociacion,
      productor: productor || (productorActual && productorActual._id),
      usuarioId: usuario._id
    });

    if (nombre) usuario.nombre = nombre;
    if (apellido) usuario.apellido = apellido;

    usuario.rol = nuevoRol;
    usuario.asociacion = vinculos.asociacion;

    await usuario.save();

    await vincularProductor(usuario._id, vinculos.productor);

    await usuario.populate("asociacion", "nombre ruc");

    return res.status(200).json({
      mensaje: "Usuario actualizado correctamente",
      usuario: formatearUsuario(usuario, vinculos.productor)
    });

  } catch (error) {
    return responderError(res, error, "Error al actualizar el usuario");
  }
};


// ==========================================
// ACTIVAR / DESACTIVAR USUARIO
// Body: { "activo": true | false }
// ==========================================

const cambiarEstadoUsuario = async (req, res) => {
  try {
    if (!idValido(req.params.id)) {
      throw new ErrorValidacion("El identificador no es válido");
    }

    const { activo } = req.body || {};

    if (typeof activo !== "boolean") {
      throw new ErrorValidacion(
        "Debe indicar el estado (activo: true o false)"
      );
    }

    if (
      String(req.params.id) === String(req.usuario._id) &&
      activo === false
    ) {
      throw new ErrorValidacion("No puedes desactivar tu propia cuenta");
    }

    const usuario = await Usuario.findByIdAndUpdate(
      req.params.id,
      { activo },
      { new: true }
    )
      .select("-password")
      .populate("asociacion", "nombre ruc");

    if (!usuario) {
      throw new ErrorValidacion("Usuario no encontrado", 404);
    }

    const productor = await Productor.findOne({ usuario: usuario._id })
      .select("nombre apellido cedula");

    return res.status(200).json({
      mensaje: activo
        ? "Usuario activado correctamente"
        : "Usuario desactivado correctamente",
      usuario: formatearUsuario(usuario, productor)
    });

  } catch (error) {
    return responderError(res, error, "Error al cambiar el estado del usuario");
  }
};


// ==========================================
// OBTENER USUARIOS CERTIFICADORES ACTIVOS
// (para asignarlos a una certificación)
// ==========================================

const obtenerCertificadores = async (req, res) => {
  try {
    const certificadores = await Usuario.find({
      rol: "certificador",
      activo: true
    }).select(
      "nombre apellido email rol"
    );

    return res.status(200).json({
      total: certificadores.length,
      certificadores
    });

  } catch (error) {
    return responderError(res, error, "Error al obtener los certificadores");
  }
};


module.exports = {
  obtenerUsuarios,
  crearUsuario,
  actualizarUsuario,
  cambiarEstadoUsuario,
  obtenerCertificadores
};
