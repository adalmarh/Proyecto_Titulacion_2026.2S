const Usuario = require("../models/Usuario");
const Productor = require("../models/Productor");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { estadoSolicitudParaLogin } = require("./solicitudController");
const { VERSION_AVISO_PRIVACIDAD } = require("../utils/privacidad");
const { normalizarCelular, celularValido } = require("../utils/validaciones");

const LONGITUD_MINIMA_PASSWORD = 6;
const LONGITUD_MAXIMA_PASSWORD = 72; // límite de bcrypt


// =====================================
// GENERAR TOKEN JWT
// =====================================

const generarToken = (id, rol) => {
  return jwt.sign(
    {
      id,
      rol
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );
};


// =====================================
// DATOS PÚBLICOS DEL USUARIO
// Lo que el frontend necesita para decidir
// qué menú y qué páginas mostrar según el rol.
// Nunca incluye la contraseña.
// =====================================

const datosSesion = async (usuario) => {
  const datos = {
    id: usuario._id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    email: usuario.email,
    rol: usuario.rol,
    telefono: usuario.telefono || "",
    asociacion: null,
    productor: null,
    // Si es false, el frontend pide aceptar el aviso
    // de privacidad antes de dejar usar el sistema.
    consentimientoVigente:
      usuario.consentimiento?.version === VERSION_AVISO_PRIVACIDAD,
    consentimientoFecha: usuario.consentimiento?.fecha || null
  };

  if (usuario.rol === "asociacion" && usuario.asociacion) {
    await usuario.populate("asociacion", "nombre");
    datos.asociacion = usuario.asociacion
      ? {
        _id: usuario.asociacion._id,
        nombre: usuario.asociacion.nombre
      }
      : null;
  }

  if (usuario.rol === "productor") {
    const productor = await Productor.findOne({
      usuario: usuario._id
    })
      .select("nombre apellido telefono asociacion")
      .populate("asociacion", "nombre");

    if (productor) {
      datos.productor = {
        _id: productor._id,
        nombre: productor.nombre,
        apellido: productor.apellido
      };

      // El celular del productor vive en su ficha
      datos.telefono = productor.telefono || datos.telefono;

      datos.asociacion = productor.asociacion
        ? {
          _id: productor.asociacion._id,
          nombre: productor.asociacion.nombre
        }
        : null;
    }
  }

  return datos;
};


// =====================================
// LOGIN
// (El registro de usuarios ya no es público:
// lo hace el administrador desde /api/usuarios.)
// =====================================

const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    // Verificar campos
    if (!email || !password) {
      return res.status(400).json({
        mensaje: "Email y contraseña son obligatorios"
      });
    }

    // Buscar usuario (los correos se guardan en minúsculas)
    const usuario = await Usuario.findOne({
      email: String(email).trim().toLowerCase()
    });

    if (!usuario) {
      // ¿Tiene una solicitud de cuenta pendiente o rechazada?
      const avisoSolicitud = await estadoSolicitudParaLogin(email, password);

      if (avisoSolicitud) {
        return res.status(403).json({
          mensaje: avisoSolicitud
        });
      }

      return res.status(401).json({
        mensaje: "Credenciales incorrectas"
      });
    }

    // Verificar contraseña
    const passwordCorrecta = await bcrypt.compare(
      password,
      usuario.password
    );

    if (!passwordCorrecta) {
      return res.status(401).json({
        mensaje: "Credenciales incorrectas"
      });
    }

    // Verificar usuario activo
    if (!usuario.activo) {
      return res.status(403).json({
        mensaje: "Usuario desactivado"
      });
    }

    // Generar token
    const token = generarToken(usuario._id, usuario.rol);

    return res.status(200).json({
      mensaje: "Inicio de sesión correcto",
      usuario: await datosSesion(usuario),
      token
    });

  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al iniciar sesión",
      error: error.message
    });
  }
};


// =====================================
// PERFIL DEL USUARIO
// =====================================

const obtenerPerfil = async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.usuario._id)
      .select("-password");

    if (!usuario) {
      return res.status(404).json({
        mensaje: "Usuario no encontrado"
      });
    }

    return res.status(200).json(
      await datosSesion(usuario)
    );

  } catch (error) {
    return res.status(500).json({
      mensaje: "Error al obtener el perfil",
      error: error.message
    });
  }
};


// =====================================
// ACEPTAR EL AVISO DE PRIVACIDAD
// body: { version }  (la que el usuario leyó)
// =====================================

const aceptarPrivacidad = async (req, res) => {
  try {
    const { version } = req.body || {};

    if (version !== VERSION_AVISO_PRIVACIDAD) {
      return res.status(400).json({
        mensaje: "El aviso de privacidad cambió. Recarga la página y léelo de nuevo."
      });
    }

    await Usuario.updateOne(
      { _id: req.usuario._id },
      { consentimiento: { version: VERSION_AVISO_PRIVACIDAD, fecha: new Date() } }
    );

    const usuario = await Usuario.findById(req.usuario._id).select("-password");

    return res.status(200).json({
      mensaje: "Aviso de privacidad aceptado",
      usuario: await datosSesion(usuario)
    });

  } catch (error) {
    console.error("Error al registrar el consentimiento:", error);
    return res.status(500).json({
      mensaje: "Error al registrar la aceptación del aviso de privacidad"
    });
  }
};


// =====================================
// MI PERFIL: ACTUALIZAR EL CELULAR
// body: { telefono }  (09XXXXXXXX; vacío lo borra)
// Nombre, correo y rol los cambia el administrador:
// son los datos con los que se verificó la cuenta.
// =====================================

const actualizarPerfil = async (req, res) => {
  try {
    const telefono = normalizarCelular(req.body?.telefono);

    if (telefono && !celularValido(telefono)) {
      return res.status(400).json({
        mensaje: "El celular debe tener 10 dígitos y empezar con 09"
      });
    }

    await Usuario.updateOne({ _id: req.usuario._id }, { telefono });

    if (req.usuario.rol === "productor") {
      await Productor.updateOne({ usuario: req.usuario._id }, { telefono });
    }

    const usuario = await Usuario.findById(req.usuario._id).select("-password");

    return res.status(200).json({
      mensaje: "Datos actualizados",
      usuario: await datosSesion(usuario)
    });

  } catch (error) {
    console.error("Error al actualizar el perfil:", error);
    return res.status(500).json({ mensaje: "Error al actualizar el perfil" });
  }
};


// =====================================
// MI PERFIL: CAMBIAR LA CONTRASEÑA
// body: { actual, nueva }
// Cierra las demás sesiones abiertas y devuelve
// un token nuevo para seguir en este dispositivo.
// =====================================

const cambiarPassword = async (req, res) => {
  try {
    const actual = String(req.body?.actual ?? "");
    const nueva = String(req.body?.nueva ?? "");

    if (!actual || !nueva) {
      return res.status(400).json({
        mensaje: "Escribe tu contraseña actual y la nueva"
      });
    }

    if (nueva.length < LONGITUD_MINIMA_PASSWORD || nueva.length > LONGITUD_MAXIMA_PASSWORD) {
      return res.status(400).json({
        mensaje: `La nueva contraseña debe tener entre ${LONGITUD_MINIMA_PASSWORD} y ${LONGITUD_MAXIMA_PASSWORD} caracteres`
      });
    }

    const usuario = await Usuario.findById(req.usuario._id);

    if (!usuario || !(await bcrypt.compare(actual, usuario.password))) {
      return res.status(400).json({
        mensaje: "La contraseña actual no es correcta"
      });
    }

    if (await bcrypt.compare(nueva, usuario.password)) {
      return res.status(400).json({
        mensaje: "La nueva contraseña debe ser distinta de la actual"
      });
    }

    usuario.password = await bcrypt.hash(nueva, await bcrypt.genSalt(10));
    // Un segundo atrás: el token nuevo (emitido ahora) sigue valiendo
    usuario.passwordCambiado = new Date(Math.floor(Date.now() / 1000) * 1000);
    await usuario.save();

    return res.status(200).json({
      mensaje: "Contraseña cambiada. Se cerraron las sesiones abiertas en otros dispositivos.",
      token: generarToken(usuario._id, usuario.rol)
    });

  } catch (error) {
    console.error("Error al cambiar la contraseña:", error);
    return res.status(500).json({ mensaje: "Error al cambiar la contraseña" });
  }
};


module.exports = {
  login,
  obtenerPerfil,
  aceptarPrivacidad,
  actualizarPerfil,
  cambiarPassword,
  datosSesion
};
