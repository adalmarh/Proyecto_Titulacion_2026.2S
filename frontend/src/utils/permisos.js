import { useContext } from "react";

import { AuthContext } from "../context/AuthContext";


// ==========================================
// ROLES DEL SISTEMA
// ==========================================

export const ROLES = {
  ADMIN: "administrador",
  PRODUCTOR: "productor",
  CERTIFICADOR: "certificador"
};

export const NOMBRE_ROL = {
  administrador: "Administrador",
  productor: "Productor",
  certificador: "Certificador"
};


// ==========================================
// PERMISOS POR ROL
// ------------------------------------------
// Solo deciden QUÉ BOTONES Y PÁGINAS se
// muestran. La seguridad real está en el
// backend (alcanceMiddleware), que rechaza
// cualquier acción no permitida aunque se
// haga desde Postman.
// ==========================================

const es = (rol, ...roles) => roles.includes(rol);

export const obtenerPermisos = (rol) => ({
  // Lotes
  gestionarLotes: es(rol, ROLES.ADMIN),

  // Productores
  gestionarProductores: es(rol, ROLES.ADMIN),

  // Trazabilidad
  registrarEventos: es(rol, ROLES.ADMIN, ROLES.PRODUCTOR),
  eliminarEventos: es(rol, ROLES.ADMIN),

  // Certificaciones
  solicitarCertificacion: es(rol, ROLES.ADMIN, ROLES.PRODUCTOR),
  asignarCertificador: es(rol, ROLES.ADMIN),
  resolverCertificacion: es(rol, ROLES.ADMIN, ROLES.CERTIFICADOR),

  // Códigos QR
  generarQR: es(rol, ROLES.ADMIN, ROLES.PRODUCTOR),
  administrarQR: es(rol, ROLES.ADMIN),

  // Usuarios y solicitudes de cuenta
  gestionarUsuarios: es(rol, ROLES.ADMIN),
  revisarSolicitudes: es(rol, ROLES.ADMIN)
});


// Hook para usar en los componentes:
// const permisos = usePermisos();
// {permisos.gestionarLotes && <button>...}
export const usePermisos = () => {
  const { usuario } = useContext(AuthContext);

  return {
    rol: usuario?.rol,
    ...obtenerPermisos(usuario?.rol)
  };
};
