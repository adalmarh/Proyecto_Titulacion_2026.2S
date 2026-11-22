import { useContext, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import {
  LuSprout,
  LuArrowLeft,
  LuMail,
  LuKeyRound,
  LuSearch,
  LuClock,
  LuCircleCheck,
  LuCircleX,
  LuTriangleAlert,
  LuMailCheck
} from "react-icons/lu";

import api from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { formatearFecha } from "../utils/formatos";
import fondoLogin from "../assets/fondo-login.jpg";


// ==========================================================
// CONSULTAR MI SOLICITUD DE CUENTA (página pública)
// La persona escribe el correo y la contraseña que eligió al
// solicitar la cuenta y ve si su solicitud está pendiente,
// aprobada o rechazada (con el motivo). Complementa el aviso
// por correo, por si ese correo llegó a spam o no llegó.
// ==========================================================

const ESTADOS = {
  pendiente: { icono: LuClock, titulo: "Tu solicitud está pendiente", clase: "cs-pendiente" },
  aprobada: { icono: LuCircleCheck, titulo: "¡Tu cuenta fue aprobada!", clase: "cs-aprobada" },
  rechazada: { icono: LuCircleX, titulo: "Tu solicitud fue rechazada", clase: "cs-rechazada" }
};


const ConsultarSolicitud = () => {

  const { usuario } = useContext(AuthContext);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consultando, setConsultando] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState(null);

  if (usuario) {
    return <Navigate to="/dashboard" replace />;
  }

  const consultar = async (evento) => {
    evento.preventDefault();
    setError("");
    setResultado(null);

    try {
      setConsultando(true);
      const r = await api.post("/public/solicitudes/estado", { email, password });
      setResultado(r.data);
      setPassword("");
    } catch (err) {
      setError(err.response?.data?.mensaje || "No se pudo consultar la solicitud. Intenta de nuevo.");
    } finally {
      setConsultando(false);
    }
  };

  const E = resultado ? ESTADOS[resultado.estado] : null;

  return (
    <div className="login login-con-fondo" style={{ "--fondo-login": `url(${fondoLogin})` }}>

      <section className="login-portada">
        <div className="login-marca">
          <LuSprout aria-hidden="true" />
          RutaCacao
        </div>

        <div>
          <h1>Consulta tu solicitud</h1>
          <p>
            Cuando la empresa revise tu solicitud te enviaremos un correo. Si no lo encuentras
            (revisa también la carpeta de spam), puedes ver aquí cómo va.
          </p>
        </div>

        <p className="login-pie">
          Universidad Estatal de Milagro · Ingeniería en Software
        </p>
      </section>

      <section className="login-formulario">
        <div className="login-caja">

          <Link to="/" className="registro-atras">
            <LuArrowLeft aria-hidden="true" />
            Volver al inicio de sesión
          </Link>

          <h2>Consultar mi solicitud</h2>
          <p>Escribe el correo y la contraseña que usaste al solicitar tu cuenta.</p>

          {error && (
            <div className="login-error" role="alert">
              <LuTriangleAlert aria-hidden="true" />
              {error}
            </div>
          )}

          {resultado && E && (
            <div className={`cs-resultado ${E.clase}`} role="status">
              <E.icono aria-hidden="true" />
              <div>
                <strong>{E.titulo}</strong>
                <span>
                  Enviada el {formatearFecha(resultado.fechaSolicitud)}
                  {resultado.fechaRevision && ` · revisada el ${formatearFecha(resultado.fechaRevision)}`}
                </span>
                {resultado.estado === "rechazada" && resultado.motivoRechazo && (
                  <p className="cs-motivo">Motivo: {resultado.motivoRechazo}</p>
                )}
                {resultado.estado === "pendiente" && (
                  <p>La empresa aún no la revisa. Te avisaremos por correo.</p>
                )}
                {resultado.estado === "aprobada" && (
                  <Link to="/" className="login-boton cs-accion">Iniciar sesión</Link>
                )}
                {resultado.estado === "rechazada" && (
                  <Link to="/solicitar-cuenta" className="login-boton cs-accion">Enviar una nueva solicitud</Link>
                )}
              </div>
            </div>
          )}

          <form onSubmit={consultar}>
            <div className="login-campo">
              <label htmlFor="cs-email">Correo</label>
              <div className="login-entrada">
                <LuMail aria-hidden="true" />
                <input
                  id="cs-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="login-campo">
              <label htmlFor="cs-password">Contraseña</label>
              <div className="login-entrada">
                <LuKeyRound aria-hidden="true" />
                <input
                  id="cs-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <button type="submit" className="login-boton" disabled={consultando}>
              <LuSearch aria-hidden="true" />
              {consultando ? "Consultando..." : "Consultar"}
            </button>
          </form>

          <p className="login-alternativa">
            <LuMailCheck aria-hidden="true" className="cs-icono-pie" />
            Por seguridad pedimos la contraseña: así nadie más puede ver tu solicitud.
          </p>
        </div>
      </section>
    </div>
  );
};

export default ConsultarSolicitud;
