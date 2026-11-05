import { useContext, useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

import {
  LuLayoutDashboard,
  LuPackage,
  LuTractor,
  LuBuilding2,
  LuUserCog,
  LuRoute,
  LuBadgeCheck,
  LuQrCode,
  LuSprout,
  LuInbox
} from "react-icons/lu";

import api from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { ROLES } from "../utils/permisos";

import "./Sidebar.css";


const { ADMIN, ASOCIACION, PRODUCTOR, CERTIFICADOR } = ROLES;


// ==========================================
// MENÚ SEGÚN EL ROL
// "roles" indica quién ve cada opción.
// "titulos" permite cambiar el texto por rol.
// ==========================================

const OPCIONES_MENU = [
  {
    ruta: "/dashboard",
    icono: LuLayoutDashboard,
    texto: "Dashboard",
    titulos: { productor: "Mi panel", certificador: "Mi panel" },
    roles: [ADMIN, ASOCIACION, PRODUCTOR, CERTIFICADOR]
  },
  {
    ruta: "/lotes",
    icono: LuPackage,
    texto: "Lotes",
    titulos: { productor: "Mis lotes" },
    roles: [ADMIN, ASOCIACION, PRODUCTOR]
  },
  {
    ruta: "/productores",
    icono: LuTractor,
    texto: "Productores",
    roles: [ADMIN, ASOCIACION]
  },
  {
    ruta: "/asociaciones",
    icono: LuBuilding2,
    texto: "Asociaciones",
    roles: [ADMIN]
  },
  {
    ruta: "/trazabilidad",
    icono: LuRoute,
    texto: "Trazabilidad",
    roles: [ADMIN, ASOCIACION, PRODUCTOR, CERTIFICADOR]
  },
  {
    ruta: "/certificaciones",
    icono: LuBadgeCheck,
    texto: "Certificaciones",
    titulos: { certificador: "Mis certificaciones" },
    roles: [ADMIN, ASOCIACION, PRODUCTOR, CERTIFICADOR]
  },
  {
    ruta: "/qr",
    icono: LuQrCode,
    texto: "Códigos QR",
    roles: [ADMIN, ASOCIACION, PRODUCTOR]
  },
  {
    ruta: "/usuarios",
    icono: LuUserCog,
    texto: "Usuarios",
    roles: [ADMIN]
  },
  {
    ruta: "/solicitudes",
    icono: LuInbox,
    texto: "Solicitudes",
    contador: true,
    roles: [ADMIN, ASOCIACION]
  }
];


const Sidebar = ({
  menuAbierto,
  cerrarMenu
}) => {

  const { usuario } = useContext(AuthContext);
  const rol = usuario?.rol;

  const opciones = OPCIONES_MENU.filter(
    (opcion) => opcion.roles.includes(rol)
  );

  // Solicitudes de cuenta pendientes (administrador y asociación).
  // Se actualiza al cambiar de página y cuando se revisa una.
  const { pathname } = useLocation();
  const [pendientes, setPendientes] = useState(0);
  const revisaSolicitudes = rol === ADMIN || rol === ASOCIACION;

  useEffect(() => {
    if (!revisaSolicitudes) return undefined;

    let activo = true;
    const consultar = () =>
      api.get("/solicitudes/pendientes/total")
        .then((r) => activo && setPendientes(r.data.total || 0))
        .catch(() => {});

    consultar();
    window.addEventListener("solicitudes-cambio", consultar);

    return () => {
      activo = false;
      window.removeEventListener("solicitudes-cambio", consultar);
    };
  }, [revisaSolicitudes, pathname]);


  return (
    <>
      {/* FONDO OSCURO PARA CELULARES */}
      {menuAbierto && (
        <div
          className="sidebar-overlay"
          onClick={cerrarMenu}
        ></div>
      )}


      <aside
        className={`sidebar ${
          menuAbierto
            ? "sidebar-abierto"
            : ""
        }`}
      >

        {/* LOGO */}
        <div className="sidebar-logo">
          <LuSprout aria-hidden="true" />
          <span>RutaCacao</span>
        </div>


        {/* NAVEGACIÓN */}
        <nav aria-label="Menú principal">

          {opciones.map((opcion) => {
            const Icono = opcion.icono;

            return (
              <NavLink
                key={opcion.ruta}
                to={opcion.ruta}
                onClick={cerrarMenu}
                className="sidebar-enlace"
              >
                <Icono
                  className="sidebar-icono"
                  aria-hidden="true"
                />
                <span>
                  {opcion.titulos?.[rol] || opcion.texto}
                </span>
                {opcion.contador && pendientes > 0 && (
                  <span
                    className="sidebar-contador"
                    aria-label={`${pendientes} pendientes`}
                  >
                    {pendientes}
                  </span>
                )}
              </NavLink>
            );
          })}

        </nav>

      </aside>
    </>
  );
};

export default Sidebar;
