import { useContext, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import {
  LuSprout,
  LuTractor,
  LuUser,
  LuIdCard,
  LuPhone,
  LuMail,
  LuKeyRound,
  LuTriangleAlert,
  LuCircleCheck,
  LuSend,
  LuClipboardCheck,
  LuLogIn,
  LuArrowLeft,
  LuMapPin,
  LuMap
} from "react-icons/lu";

import api from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { PROVINCIAS_ECUADOR } from "../utils/formatos";
import fondoLogin from "../assets/fondo-login.jpg";


// ==========================================================
// SOLICITAR CUENTA (página pública)
// Los productores de la empresa piden acceso. La cuenta se
// crea cuando el administrador aprueba la solicitud.
// Estilos en index.css (secciones "Inicio de sesión" y
// "Solicitud de cuenta").
// ==========================================================

const formularioVacio = {
  nombre: "",
  apellido: "",
  cedula: "",
  telefono: "",
  provincia: "",
  canton: "",
  parroquia: "",
  direccion: "",
  email: "",
  password: "",
  confirmar: "",
  mensaje: "",
  aceptaPrivacidad: false,
  sitioWeb: ""   // campo trampa para programas automáticos
};


const Campo = ({ id, etiqueta, icono: Icono, ancho, children, ayuda }) => (
  <div className={`login-campo${ancho ? " registro-ancho" : ""}`}>
    <label htmlFor={id}>{etiqueta}</label>
    <div className={Icono ? "login-entrada" : "login-entrada login-entrada-simple"}>
      {Icono && <Icono aria-hidden="true" />}
      {children}
    </div>
    {ayuda && <span className="registro-ayuda">{ayuda}</span>}
  </div>
);


const SolicitarCuenta = () => {

  const { usuario } = useContext(AuthContext);

  const [formulario, setFormulario] = useState(formularioVacio);
  const [empresa, setEmpresa] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [enviada, setEnviada] = useState(false);

  useEffect(() => {
    api.get("/public/empresa")
      .then((r) => setEmpresa(r.data?.nombre || ""))
      .catch(() => setEmpresa(""));
  }, []);

  if (usuario) {
    return <Navigate to="/dashboard" replace />;
  }

  const cambiar = (evento) => {
    const { name, value, type, checked } = evento.target;
    setFormulario((anterior) => ({ ...anterior, [name]: type === "checkbox" ? checked : value }));
  };

  const enviar = async (evento) => {
    evento.preventDefault();
    setError("");

    if (!/^\d{10}$/.test(formulario.cedula)) {
      setError("La cédula debe tener 10 dígitos.");
      return;
    }

    if (!/^09\d{8}$/.test(formulario.telefono.replace(/[\s-]/g, ""))) {
      setError("El celular debe tener 10 dígitos y empezar con 09.");
      return;
    }

    if (formulario.direccion.trim().length < 10) {
      setError("Describe cómo llegar a tu finca (al menos 10 caracteres).");
      return;
    }

    if (formulario.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (formulario.password !== formulario.confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    if (!formulario.aceptaPrivacidad) {
      setError("Para enviar la solicitud debes leer y aceptar el aviso de privacidad.");
      return;
    }

    try {
      setEnviando(true);

      await api.post("/public/solicitudes", {
        rolSolicitado: "productor",
        nombre: formulario.nombre,
        apellido: formulario.apellido,
        cedula: formulario.cedula,
        telefono: formulario.telefono,
        provincia: formulario.provincia,
        canton: formulario.canton,
        parroquia: formulario.parroquia,
        direccion: formulario.direccion,
        email: formulario.email,
        password: formulario.password,
        mensaje: formulario.mensaje,
        aceptaPrivacidad: formulario.aceptaPrivacidad,
        sitioWeb: formulario.sitioWeb
      });

      setEnviada(true);

    } catch (err) {
      setError(
        err.response?.data?.mensaje ||
        "No se pudo conectar con el servidor. Inténtalo de nuevo en unos minutos."
      );
    } finally {
      setEnviando(false);
    }
  };


  return (
    <div className="login login-con-fondo" style={{ "--fondo-login": `url(${fondoLogin})` }}>

      {/* PORTADA */}
      <section className="login-portada">
        <div className="login-marca">
          <LuSprout aria-hidden="true" />
          RutaCacao
        </div>

        <div>
          <h1>Solicita tu cuenta</h1>
          <p>
            Para los productores de cacao fino de aroma{empresa ? ` de ${empresa}` : ""} que
            quieren registrar la trazabilidad de sus lotes.
          </p>
        </div>

        <ol className="login-puntos registro-pasos">
          <li>
            <LuSend aria-hidden="true" />
            Envía tus datos con este formulario
          </li>
          <li>
            <LuClipboardCheck aria-hidden="true" />
            El administrador de la empresa revisa la solicitud
          </li>
          <li>
            <LuLogIn aria-hidden="true" />
            Entras con el correo y la contraseña que elegiste
          </li>
        </ol>

        <p className="login-pie">
          Universidad Estatal de Milagro · Ingeniería en Software
        </p>
      </section>


      {/* FORMULARIO */}
      <section className="login-formulario">
        <div className="login-caja registro-caja">

          {enviada ? (
            <div className="registro-exito" role="status">
              <LuCircleCheck aria-hidden="true" />
              <h2>Solicitud enviada</h2>
              <p>
                El administrador revisará tus datos.{" "}
                Cuando la aprueben podrás iniciar sesión con{" "}
                <strong>{formulario.email}</strong> y la contraseña que elegiste.
              </p>
              <p>
                Si intentas entrar antes, el sistema te dirá si tu solicitud
                sigue pendiente.
              </p>
              <Link to="/" className="login-boton registro-volver">
                Ir al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              <Link to="/" className="registro-atras">
                <LuArrowLeft aria-hidden="true" />
                Volver al inicio de sesión
              </Link>

              <h2>Solicitar cuenta</h2>
              <p>Todos los campos con * son obligatorios.</p>

              {error && (
                <div className="login-error" role="alert">
                  <LuTriangleAlert aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={enviar} noValidate={false}>

                {/* EMPRESA: todas las cuentas son de productor */}
                <div className="registro-empresa">
                  <LuTractor aria-hidden="true" />
                  <span>
                    <strong>Cuenta de productor</strong>
                    <small>
                      {empresa ? `Productores de cacao de ${empresa}` : "Productores de cacao fino de aroma"}
                    </small>
                  </span>
                </div>

                <div className="registro-campos">

                  <Campo id="s-nombre" etiqueta="Nombres *" icono={LuUser}>
                    <input id="s-nombre" name="nombre" value={formulario.nombre} onChange={cambiar} autoComplete="given-name" maxLength={60} required />
                  </Campo>

                  <Campo id="s-apellido" etiqueta="Apellidos *" icono={LuUser}>
                    <input id="s-apellido" name="apellido" value={formulario.apellido} onChange={cambiar} autoComplete="family-name" maxLength={60} required />
                  </Campo>

                  <Campo id="s-cedula" etiqueta="Cédula *" icono={LuIdCard}>
                    <input
                      id="s-cedula"
                      name="cedula"
                      value={formulario.cedula}
                      onChange={cambiar}
                      inputMode="numeric"
                      pattern="\d{10}"
                      maxLength={10}
                      title="10 dígitos"
                      required
                    />
                  </Campo>

                  <Campo id="s-telefono" etiqueta="Celular *" icono={LuPhone}>
                    <input
                      id="s-telefono"
                      name="telefono"
                      type="tel"
                      inputMode="numeric"
                      value={formulario.telefono}
                      onChange={cambiar}
                      autoComplete="tel"
                      placeholder="09XXXXXXXX"
                      maxLength={12}
                      required
                    />
                  </Campo>

                  {/* UBICACIÓN: permite verificar la finca o la sede en campo */}
                  <p className="registro-subtitulo registro-ancho">
                    Ubicación de tu finca
                    <span>Sirve para que la empresa o un técnico puedan visitarte y verificar tu producción.</span>
                  </p>

                  <Campo id="s-provincia" etiqueta="Provincia *" icono={LuMap}>
                    <select id="s-provincia" name="provincia" value={formulario.provincia} onChange={cambiar} required>
                      <option value="">Selecciona</option>
                      {PROVINCIAS_ECUADOR.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </Campo>

                  <Campo id="s-canton" etiqueta="Cantón *" icono={LuMapPin}>
                    <input id="s-canton" name="canton" value={formulario.canton} onChange={cambiar} maxLength={60} required />
                  </Campo>

                  <Campo
                    id="s-parroquia"
                    etiqueta="Parroquia o recinto *"
                    icono={LuMapPin}
                    ancho
                  >
                    <input
                      id="s-parroquia"
                      name="parroquia"
                      value={formulario.parroquia}
                      onChange={cambiar}
                      maxLength={60}
                      placeholder="Ej.: Recinto Los Monos"
                      required
                    />
                  </Campo>

                  <Campo
                    id="s-direccion"
                    etiqueta="Cómo llegar a tu finca *"
                    ancho
                  >
                    <textarea
                      id="s-direccion"
                      name="direccion"
                      rows={2}
                      minLength={10}
                      maxLength={200}
                      value={formulario.direccion}
                      onChange={cambiar}
                      placeholder="Ej.: Finca La Ceiba, km 5 vía a Naranjito, junto a la escuela"
                      required
                    />
                  </Campo>

                  <p className="registro-subtitulo registro-ancho">Datos de acceso</p>

                  <Campo id="s-email" etiqueta="Correo electrónico *" icono={LuMail} ancho>
                    <input id="s-email" name="email" type="email" value={formulario.email} onChange={cambiar} autoComplete="email" required />
                  </Campo>

                  <Campo id="s-password" etiqueta="Contraseña *" icono={LuKeyRound} ayuda="Mínimo 6 caracteres.">
                    <input id="s-password" name="password" type="password" value={formulario.password} onChange={cambiar} autoComplete="new-password" minLength={6} required />
                  </Campo>

                  <Campo id="s-confirmar" etiqueta="Repite la contraseña *" icono={LuKeyRound}>
                    <input id="s-confirmar" name="confirmar" type="password" value={formulario.confirmar} onChange={cambiar} autoComplete="new-password" minLength={6} required />
                  </Campo>

                  <Campo id="s-mensaje" etiqueta="Mensaje para quien revisa (opcional)" ancho>
                    <textarea
                      id="s-mensaje"
                      name="mensaje"
                      rows={3}
                      maxLength={500}
                      value={formulario.mensaje}
                      onChange={cambiar}
                      placeholder="Ej.: Entrego cacao a la empresa desde 2019, finca en el recinto San Pedro"
                    />
                  </Campo>

                  {/* Campo trampa: oculto para las personas */}
                  <div className="registro-trampa" aria-hidden="true">
                    <label htmlFor="s-sitio">Sitio web</label>
                    <input id="s-sitio" name="sitioWeb" tabIndex={-1} autoComplete="off" value={formulario.sitioWeb} onChange={cambiar} />
                  </div>
                </div>

                <label className="registro-consentimiento">
                  <input
                    type="checkbox"
                    name="aceptaPrivacidad"
                    checked={formulario.aceptaPrivacidad}
                    onChange={cambiar}
                    required
                  />
                  <span>
                    He leído el{" "}
                    <Link to="/privacidad" target="_blank" rel="noreferrer">aviso de privacidad</Link>{" "}
                    y acepto que mis datos se usen para revisar mi solicitud,
                    verificar mi producción y gestionar mi cuenta. *
                  </span>
                </label>

                <button type="submit" className="login-boton" disabled={enviando}>
                  {enviando ? "Enviando..." : "Enviar solicitud"}
                </button>
              </form>
            </>
          )}
        </div>
      </section>

    </div>
  );
};

export default SolicitarCuenta;
