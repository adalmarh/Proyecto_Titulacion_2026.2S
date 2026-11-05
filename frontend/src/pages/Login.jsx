import { useContext, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import {
  LuSprout,
  LuMail,
  LuKeyRound,
  LuTriangleAlert,
  LuRoute,
  LuQrCode,
  LuBadgeCheck
} from "react-icons/lu";

import api from "../services/api";
import { AuthContext } from "../context/AuthContext";


// ==========================================
// INICIO DE SESIÓN
// Estilos en index.css (sección "Inicio de sesión")
// ==========================================

const Login = () => {

  const navigate = useNavigate();

  const {
    usuario,
    avisoSesion,
    iniciarSesion
  } = useContext(AuthContext);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);


  const manejarLogin = async (evento) => {
    evento.preventDefault();
    setMensaje("");
    setCargando(true);

    try {
      const respuesta = await api.post("/auth/login", {
        email,
        password
      });

      const { token, usuario: datosUsuario } = respuesta.data;

      iniciarSesion(token, datosUsuario);
      navigate("/dashboard");

    } catch (error) {
      setMensaje(
        error.response?.data?.mensaje ||
        "No se pudo conectar con el servidor. Comprueba que el backend esté en ejecución."
      );
    } finally {
      setCargando(false);
    }
  };


  // Si ya hay una sesión abierta, ir al inicio
  if (usuario) {
    return <Navigate to="/dashboard" replace />;
  }


  return (
    <div className="login">

      {/* PORTADA */}
      <section className="login-portada">
        <div className="login-marca">
          <LuSprout aria-hidden="true" />
          RutaCacao
        </div>

        <div>
          <h1>Trazabilidad del cacao fino de aroma</h1>
          <p>
            Registra cada lote desde la finca, documenta su recorrido y
            comparte su origen con un código QR.
          </p>
        </div>

        <ul className="login-puntos">
          <li>
            <LuRoute aria-hidden="true" />
            Historial de actividades de cada lote
          </li>
          <li>
            <LuBadgeCheck aria-hidden="true" />
            Solicitud y revisión de certificaciones
          </li>
          <li>
            <LuQrCode aria-hidden="true" />
            Consulta pública con códigos QR dinámicos
          </li>
        </ul>

        <p className="login-pie">
          Universidad Estatal de Milagro · Ingeniería en Software
        </p>
      </section>


      {/* FORMULARIO */}
      <section className="login-formulario">
        <div className="login-caja">
          <h2>Iniciar sesión</h2>
          <p>Ingresa con tu correo y tu contraseña.</p>

          {avisoSesion && !mensaje && (
            <div className="login-error" role="alert">
              <LuTriangleAlert aria-hidden="true" />
              <span>{avisoSesion}. Vuelve a iniciar sesión.</span>
            </div>
          )}

          {mensaje && (
            <div className="login-error" role="alert">
              <LuTriangleAlert aria-hidden="true" />
              <span>{mensaje}</span>
            </div>
          )}

          <form onSubmit={manejarLogin}>
            <div className="login-campo">
              <label htmlFor="login-email">Correo electrónico</label>
              <div className="login-entrada">
                <LuMail aria-hidden="true" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="login-campo">
              <label htmlFor="login-password">Contraseña</label>
              <div className="login-entrada">
                <LuKeyRound aria-hidden="true" />
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="login-boton"
              disabled={cargando}
            >
              {cargando ? "Ingresando..." : "Iniciar sesión"}
            </button>
          </form>

          <p className="login-alternativa">
            ¿Aún no tienes cuenta?{" "}
            <Link to="/solicitar-cuenta">Solicitar acceso</Link>
          </p>

          <p className="login-legal">
            <Link to="/privacidad">Aviso de privacidad</Link>
          </p>
        </div>
      </section>

    </div>
  );
};

export default Login;
