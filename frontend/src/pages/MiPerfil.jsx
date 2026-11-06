import { useContext, useState } from "react";
import { Link } from "react-router-dom";

import {
  LuUserCog,
  LuUserRound,
  LuKeyRound,
  LuPhone,
  LuEye,
  LuEyeOff,
  LuSave,
  LuCircleCheck,
  LuTriangleAlert
} from "react-icons/lu";

import api from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { NOMBRE_ROL } from "../utils/permisos";
import { formatearFecha } from "../utils/formatos";


// ==========================================================
// MI PERFIL (todos los roles)
// - Ver los datos de la cuenta.
// - Actualizar el celular de contacto.
// - Cambiar la contraseña (cierra las sesiones abiertas
//   en otros dispositivos).
// Nombre, correo y rol los cambia el administrador.
// ==========================================================

const LONGITUD_MINIMA = 6;

const Aviso = ({ tipo, children }) => (
  <div className={`gs-alerta ${tipo === "exito" ? "gs-alerta-exito" : "gs-alerta-error"}`}>
    {tipo === "exito" ? <LuCircleCheck aria-hidden="true" /> : <LuTriangleAlert aria-hidden="true" />}
    {children}
  </div>
);


const MiPerfil = () => {

  const { usuario, actualizarUsuario } = useContext(AuthContext);

  // ---------- Celular ----------
  const [telefono, setTelefono] = useState(usuario?.telefono || "");
  const [avisoTel, setAvisoTel] = useState(null);
  const [guardandoTel, setGuardandoTel] = useState(false);

  // ---------- Contraseña ----------
  const vacio = { actual: "", nueva: "", confirmar: "" };
  const [claves, setClaves] = useState(vacio);
  const [ver, setVer] = useState(false);
  const [avisoClave, setAvisoClave] = useState(null);
  const [guardandoClave, setGuardandoClave] = useState(false);


  const guardarTelefono = async (evento) => {
    evento.preventDefault();
    setAvisoTel(null);

    const limpio = telefono.replace(/[\s-]/g, "");
    if (limpio && !/^09\d{8}$/.test(limpio)) {
      setAvisoTel({ tipo: "error", texto: "El celular debe tener 10 dígitos y empezar con 09." });
      return;
    }

    try {
      setGuardandoTel(true);
      const { data } = await api.patch("/auth/perfil", { telefono: limpio });
      actualizarUsuario(data.usuario);
      setTelefono(data.usuario.telefono || "");
      setAvisoTel({ tipo: "exito", texto: "Celular actualizado." });
    } catch (err) {
      setAvisoTel({ tipo: "error", texto: err.response?.data?.mensaje || "No se pudo guardar el celular." });
    } finally {
      setGuardandoTel(false);
    }
  };

  const cambiarCampo = (evento) =>
    setClaves({ ...claves, [evento.target.name]: evento.target.value });

  const cambiarClave = async (evento) => {
    evento.preventDefault();
    setAvisoClave(null);

    if (claves.nueva.length < LONGITUD_MINIMA) {
      setAvisoClave({ tipo: "error", texto: `La nueva contraseña debe tener al menos ${LONGITUD_MINIMA} caracteres.` });
      return;
    }
    if (claves.nueva !== claves.confirmar) {
      setAvisoClave({ tipo: "error", texto: "La confirmación no coincide con la nueva contraseña." });
      return;
    }

    try {
      setGuardandoClave(true);
      const { data } = await api.put("/auth/password", { actual: claves.actual, nueva: claves.nueva });
      // Token nuevo: esta sesión sigue abierta; las demás se cierran
      localStorage.setItem("token", data.token);
      setClaves(vacio);
      setAvisoClave({ tipo: "exito", texto: data.mensaje });
    } catch (err) {
      setAvisoClave({ tipo: "error", texto: err.response?.data?.mensaje || "No se pudo cambiar la contraseña." });
    } finally {
      setGuardandoClave(false);
    }
  };


  const nombre = `${usuario?.nombre || ""} ${usuario?.apellido || ""}`.trim();
  const tipoClave = ver ? "text" : "password";

  return (
    <div className="gs-pagina">

      <div className="gs-encabezado">
        <div>
          <h1>
            <LuUserCog aria-hidden="true" />
            Mi perfil
          </h1>
          <p>Revisa los datos de tu cuenta, actualiza tu celular y cambia tu contraseña.</p>
        </div>
      </div>

      <div className="gs-cuadricula mp-cuadricula">

        {/* ---------- DATOS DE LA CUENTA ---------- */}
        <section className="gs-panel">
          <div className="gs-panel-cabecera">
            <div>
              <h2><LuUserRound aria-hidden="true" />Mis datos</h2>
              <p>Para cambiar tu nombre o tu correo, pídeselo al administrador.</p>
            </div>
          </div>

          <div className="gs-panel-cuerpo">
            <dl className="gs-ficha">
              <dt>Nombre</dt>
              <dd>{nombre || "—"}</dd>
              <dt>Correo</dt>
              <dd>{usuario?.email}</dd>
              <dt>Rol</dt>
              <dd>{NOMBRE_ROL[usuario?.rol] || usuario?.rol}</dd>
              {usuario?.empresa?.nombre && (
                <>
                  <dt>Empresa</dt>
                  <dd>{usuario.empresa.nombre}</dd>
                </>
              )}
              <dt>Privacidad</dt>
              <dd>
                {usuario?.consentimientoFecha
                  ? `Aceptaste el aviso el ${formatearFecha(usuario.consentimientoFecha)}`
                  : "—"}
                {" · "}
                <Link to="/privacidad" target="_blank" className="mp-enlace">Ver aviso</Link>
              </dd>
            </dl>

            <form className="gs-formulario mp-telefono" onSubmit={guardarTelefono}>
              {avisoTel && <Aviso tipo={avisoTel.tipo}>{avisoTel.texto}</Aviso>}
              <div className="gs-campo">
                <label htmlFor="mp-telefono">
                  <LuPhone aria-hidden="true" /> Celular
                </label>
                <input
                  id="mp-telefono"
                  type="tel"
                  inputMode="numeric"
                  placeholder="09XXXXXXXX"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  maxLength={14}
                />
                <span className="gs-ayuda">
                  Se usa para coordinar las visitas de verificación.
                </span>
              </div>
              <div className="gs-botones-modal">
                <button type="submit" className="gs-btn gs-btn-principal" disabled={guardandoTel}>
                  <LuSave aria-hidden="true" />
                  {guardandoTel ? "Guardando..." : "Guardar celular"}
                </button>
              </div>
            </form>
          </div>
        </section>


        {/* ---------- CONTRASEÑA ---------- */}
        <section className="gs-panel">
          <div className="gs-panel-cabecera">
            <div>
              <h2><LuKeyRound aria-hidden="true" />Cambiar contraseña</h2>
              <p>Al cambiarla se cierran las sesiones abiertas en otros dispositivos.</p>
            </div>
          </div>

          <form className="gs-formulario gs-panel-cuerpo" onSubmit={cambiarClave}>
            {avisoClave && <Aviso tipo={avisoClave.tipo}>{avisoClave.texto}</Aviso>}

            <div className="mp-campos">
            <div className="gs-campo">
              <label htmlFor="mp-actual">Contraseña actual</label>
              <input id="mp-actual" name="actual" type={tipoClave} autoComplete="current-password"
                value={claves.actual} onChange={cambiarCampo} required />
            </div>

            <div className="gs-campo">
              <label htmlFor="mp-nueva">Nueva contraseña</label>
              <input id="mp-nueva" name="nueva" type={tipoClave} autoComplete="new-password"
                value={claves.nueva} onChange={cambiarCampo} minLength={LONGITUD_MINIMA} maxLength={72} required />
              <span className="gs-ayuda">Mínimo {LONGITUD_MINIMA} caracteres.</span>
            </div>

            <div className="gs-campo">
              <label htmlFor="mp-confirmar">Confirmar la nueva contraseña</label>
              <input id="mp-confirmar" name="confirmar" type={tipoClave} autoComplete="new-password"
                value={claves.confirmar} onChange={cambiarCampo} required />
            </div>
            </div>

            <button type="button" className="mp-ver" onClick={() => setVer(!ver)}>
              {ver ? <LuEyeOff aria-hidden="true" /> : <LuEye aria-hidden="true" />}
              {ver ? "Ocultar contraseñas" : "Mostrar contraseñas"}
            </button>

            <div className="gs-botones-modal">
              <button type="submit" className="gs-btn gs-btn-principal" disabled={guardandoClave}>
                <LuKeyRound aria-hidden="true" />
                {guardandoClave ? "Cambiando..." : "Cambiar contraseña"}
              </button>
            </div>
          </form>
        </section>

      </div>
    </div>
  );
};

export default MiPerfil;
