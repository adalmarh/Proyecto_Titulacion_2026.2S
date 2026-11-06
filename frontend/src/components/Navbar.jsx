import { useContext } from "react";
import { Link } from "react-router-dom";

import {
  LuMenu,
  LuLogOut,
  LuUser
} from "react-icons/lu";

import { AuthContext } from "../context/AuthContext";
import { NOMBRE_ROL } from "../utils/permisos";

import "./Navbar.css";

const Navbar = ({
  abrirMenu
}) => {

  const {
    usuario,
    cerrarSesion
  } = useContext(AuthContext);


  return (
    <header className="navbar">

      {/* BOTÓN MENÚ PARA CELULAR */}
      <button
        className="menu-toggle"
        onClick={abrirMenu}
        aria-label="Abrir menú"
      >
        <LuMenu aria-hidden="true" />
      </button>


      {/* TÍTULO: la empresa a la que pertenecen los productores */}
      <div className="navbar-title">
        {usuario?.empresa?.nombre || "Sistema de Trazabilidad"}
      </div>


      {/* USUARIO Y ROL */}
      <div className="navbar-user">

        <Link to="/perfil" className="navbar-nombre" title="Mi perfil">
          <LuUser aria-hidden="true" />
          {usuario?.nombre}
        </Link>

        {usuario?.rol && (
          <span className={`navbar-rol rol-${usuario.rol}`}>
            {NOMBRE_ROL[usuario.rol]}
          </span>
        )}

        <button
          className="navbar-salir"
          onClick={cerrarSesion}
        >
          <LuLogOut aria-hidden="true" />
          <span>Cerrar sesión</span>
        </button>

      </div>

    </header>
  );
};

export default Navbar;
