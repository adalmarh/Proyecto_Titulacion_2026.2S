// ==========================================
// PERMITIR ROLES
// Debe usarse siempre después de protegerRuta.
// Ejemplo: permitirRoles("administrador", "asociacion")
// ==========================================

const permitirRoles = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({
        mensaje: "No autorizado"
      });
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({
        mensaje: "No tienes permisos para realizar esta acción"
      });
    }

    return next();
  };
};

module.exports = permitirRoles;
