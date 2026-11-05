const jwt = require("jsonwebtoken");
const Usuario = require("../models/Usuario");

// ==========================================
// PROTEGER RUTA
// Verifica el token JWT y que el usuario
// exista y esté activo.
// ==========================================

const protegerRuta = async (req, res, next) => {
  const encabezado = req.headers.authorization;

  // 1. Verificar que se envió el token
  if (!encabezado || !encabezado.startsWith("Bearer ")) {
    return res.status(401).json({
      mensaje: "No autorizado. Token no proporcionado"
    });
  }

  const token = encabezado.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      mensaje: "No autorizado. Token no proporcionado"
    });
  }

  // 2. Verificar firma y expiración del token
  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({
      mensaje: "Token no válido o expirado"
    });
  }

  // 3. Verificar que el usuario existe y está activo
  try {
    const usuario = await Usuario.findById(decoded.id)
      .select("-password");

    if (!usuario) {
      return res.status(401).json({
        mensaje: "Usuario no encontrado"
      });
    }

    if (!usuario.activo) {
      return res.status(403).json({
        mensaje: "Usuario desactivado"
      });
    }

    // 4. Si la contraseña cambió después de emitir el
    //    token, esa sesión ya no vale (otro dispositivo).
    if (
      usuario.passwordCambiado &&
      decoded.iat < Math.floor(usuario.passwordCambiado.getTime() / 1000)
    ) {
      return res.status(401).json({
        mensaje: "La contraseña de la cuenta cambió. Inicia sesión de nuevo."
      });
    }

    req.usuario = usuario;

    return next();

  } catch (error) {
    console.error("Error en protegerRuta:", error);

    return res.status(500).json({
      mensaje: "Error al verificar la sesión"
    });
  }
};

module.exports = protegerRuta;