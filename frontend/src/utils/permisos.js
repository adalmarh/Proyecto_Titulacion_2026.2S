import { useContext } from "react";

import { AuthContext } from "../context/AuthContext";


// ==========================================
// ROLES DEL SISTEMA
// ==========================================

export const ROLES = {
  ADMIN: "administrador",
  ASOCIACION: "asociacion",
  PRODUCTOR: "productor",
  CERTIFICADOR: "certificador"
};

export const NOMBRE_ROL = {
  administrador: "Administrador",
  asociacion: "Asociación",
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
  gestionarLotes: es(rol, ROLES.ADMIN, ROLES.ASOCIACION),

  // Productores y asociaciones
  gestionarProductores: es(rol, ROLES.ADMIN, ROLES.ASOCIACION),
  gestionarAsociaciones: es(rol, ROLES.ADMIN),

  // Trazabilidad
  registrarEventos: es(rol, ROLES.ADMIN, ROLES.ASOCIACION, ROLES.PRODUCTOR),
  eliminarEventos: es(rol, ROLES.ADMIN, ROLES.ASOCIACION),

  // Certificaciones
  solicitarCertificacion: es(rol, ROLES.ADMIN, ROLES.ASOCIACION, ROLES.PRODUCTOR),
  asignarCertificador: es(rol, ROLES.ADMIN),
  resolverCertificacion: es(rol, ROLES.ADMIN, ROLES.CERTIFICADOR),

  // Códigos QR
  generarQR: es(rol, ROLES.ADMIN, ROLES.ASOCIACION, ROLES.PRODUCTOR),
  administrarQR: es(rol, ROLES.ADMIN, ROLES.ASOCIACION),

  // Usuarios y solicitudes de cuenta
  gestionarUsuarios: es(rol, ROLES.ADMIN),
  revisarSolicitudes: es(rol, ROLES.ADMIN, ROLES.ASOCIACION)
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
