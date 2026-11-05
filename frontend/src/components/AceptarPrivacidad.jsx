import { useContext, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { LuShieldCheck, LuTriangleAlert } from "react-icons/lu";

import api from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { VERSION_AVISO_PRIVACIDAD } from "../utils/privacidad";


// ==========================================================
// ACEPTAR EL AVISO DE PRIVACIDAD
// Aparece después de iniciar sesión cuando la cuenta no ha
// aceptado la versión vigente del aviso (por ejemplo, las
// cuentas que crea el administrador o cuando el aviso
// cambia). No se puede usar el sistema sin aceptarlo; quien
// no acepta cierra su sesión.
// ==========================================================

const AceptarPrivacidad = () => {

  const { usuario, actualizarUsuario, cerrarSesion } = useContext(AuthContext);

  const [marcado, setMarcado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const caja = useRef(null);

  useEffect(() => {
    caja.current?.focus();
  }, []);

  if (!usuario || usuario.consentimientoVigente !== false) {
    return null;
  }

  const aceptar = async () => {
    try {
      setEnviando(true);
      setError("");
      const r = await api.post("/auth/privacidad", { version: VERSION_AVISO_PRIVACIDAD });
      actualizarUsuario(r.data.usuario);
    } catch (err) {
      setError(err.response?.data?.mensaje || "No se pudo registrar la aceptación. Inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="gs-modal-fondo">
      <div
        ref={caja}
        tabIndex={-1}
        className="gs-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ap-titulo"
      >
        <div className="gs-modal-cabecera">
          <div>
            <h2 id="ap-titulo">
              <LuShieldCheck aria-hidden="true" style={{ width: 22, height: 22, marginRight: 8, verticalAlign: -4, color: "#2f855a" }} />
              Aviso de privacidad
            </h2>
            <p>Antes de continuar, {usuario.nombre}, revisa cómo usamos tus datos.</p>
          </div>
        </div>

        <div className="gs-formulario">
          {error && (
            <div className="gs-alerta gs-alerta-error">
              <LuTriangleAlert aria-hidden="true" />
              {error}
            </div>
          )}

          <ul className="ap-puntos">
            <li>Usamos tus datos para identificarte, gestionar tus lotes y certificaciones, y verificar la información en campo.</li>
            <li>Al escanear un QR solo se publica el nombre del productor y el origen del lote; nunca tu cédula, celular, correo ni dirección.</li>
            <li>Puedes pedir acceso, corrección o eliminación de tus datos, y retirar este consentimiento cuando quieras.</li>
          </ul>

          <p>
            <Link to="/privacidad" target="_blank" rel="noreferrer" className="gs-enlace">
              Leer el aviso de privacidad completo
            </Link>{" "}
            (se abre en otra pestaña).
          </p>

          <label className="gs-casilla ap-casilla">
            <input
              type="checkbox"
              checked={marcado}
              onChange={(e) => setMarcado(e.target.checked)}
            />
            He leído el aviso de privacidad y acepto el tratamiento de mis datos personales.
          </label>

          <div className="gs-botones-modal">
            <button type="button" className="gs-btn gs-btn-secundario" onClick={cerrarSesion} disabled={enviando}>
              No acepto, cerrar sesión
            </button>
            <button type="button" className="gs-btn gs-btn-principal" onClick={aceptar} disabled={!marcado || enviando}>
              {enviando ? "Guardando..." : "Aceptar y continuar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AceptarPrivacidad;
