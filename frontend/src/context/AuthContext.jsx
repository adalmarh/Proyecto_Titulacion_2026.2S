import { createContext, useEffect, useState } from "react";

import api from "../services/api";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [avisoSesion, setAvisoSesion] = useState("");


  // ========================================
  // CERRAR SESIÓN
  // ========================================

  const cerrarSesion = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    setUsuario(null);
  };


  // ========================================
  // RECUPERAR LA SESIÓN AL CARGAR LA PÁGINA
  // Primero se usa lo guardado (para no hacer
  // esperar al usuario) y luego se confirma con
  // el backend que el token sigue siendo válido
  // y que el rol no ha cambiado.
  // ========================================

  useEffect(() => {
    const token = localStorage.getItem("token");
    const usuarioGuardado = localStorage.getItem("usuario");

    if (!token || !usuarioGuardado) {
      setCargando(false);
      return;
    }

    try {
      setUsuario(JSON.parse(usuarioGuardado));
    } catch (error) {
      console.error("Error al recuperar usuario:", error);
      cerrarSesion();
      setCargando(false);
      return;
    }

    api.get("/auth/perfil")
      .then((respuesta) => {
        localStorage.setItem("usuario", JSON.stringify(respuesta.data));
        setUsuario(respuesta.data);
      })
      .catch((error) => {
        // Token inválido o expirado: el interceptor
        // de api.js ya avisó para cerrar la sesión.
        if (!error.response) {
          console.error("No se pudo verificar la sesión:", error);
        }
      })
      .finally(() => setCargando(false));
  }, []);


  // ========================================
  // ESCUCHAR "SESIÓN EXPIRADA" (desde api.js)
  // ========================================

  useEffect(() => {
    const alExpirar = (evento) => {
      setAvisoSesion(evento.detail);
      cerrarSesion();
    };

    window.addEventListener("sesion-expirada", alExpirar);

    return () => window.removeEventListener("sesion-expirada", alExpirar);
  }, []);


  // ========================================
  // INICIAR SESIÓN
  // ========================================

  const iniciarSesion = (token, datosUsuario) => {
    localStorage.setItem("token", token);
    localStorage.setItem("usuario", JSON.stringify(datosUsuario));
    setAvisoSesion("");
    setUsuario(datosUsuario);
  };


  // ========================================
  // ACTUALIZAR LOS DATOS DE LA SESIÓN
  // (por ejemplo, después de aceptar el aviso
  // de privacidad)
  // ========================================

  const actualizarUsuario = (datosUsuario) => {
    localStorage.setItem("usuario", JSON.stringify(datosUsuario));
    setUsuario(datosUsuario);
  };


  return (
    <AuthContext.Provider
      value={{
        usuario,
        cargando,
        avisoSesion,
        iniciarSesion,
        cerrarSesion,
        actualizarUsuario
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
