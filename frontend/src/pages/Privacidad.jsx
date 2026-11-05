import { useContext } from "react";
import { Link } from "react-router-dom";

import {
  LuSprout,
  LuShieldCheck,
  LuArrowLeft,
  LuTriangleAlert
} from "react-icons/lu";

import { AuthContext } from "../context/AuthContext";
import {
  FECHA_AVISO_PRIVACIDAD,
  RESPONSABLE_DATOS,
  CORREO_DATOS,
  DIAS_CONSERVAR_RECHAZADAS
} from "../utils/privacidad";

import "./Privacidad.css";


// ==========================================================
// AVISO DE PRIVACIDAD (página pública)
// Cumple el derecho a ser informado de la Ley Orgánica de
// Protección de Datos Personales del Ecuador (art. 12).
// Si cambia el contenido de forma importante, sube la
// versión en utils/privacidad.js y en el backend.
// ==========================================================

const Contacto = () =>
  CORREO_DATOS ? (
    <a href={`mailto:${CORREO_DATOS}`}>{CORREO_DATOS}</a>
  ) : (
    <span className="pv-pendiente">
      correo pendiente de configurar (VITE_PRIVACIDAD_CORREO)
    </span>
  );


const Privacidad = () => {

  const { usuario } = useContext(AuthContext);

  return (
    <div className="pv">

      <header className="pv-cabecera">
        <div className="pv-ancho">
          <Link to={usuario ? "/dashboard" : "/"} className="pv-marca">
            <LuSprout aria-hidden="true" />
            RutaCacao
          </Link>
        </div>
      </header>

      <main className="pv-ancho pv-contenido">

        <Link to={usuario ? "/dashboard" : "/"} className="pv-volver">
          <LuArrowLeft aria-hidden="true" />
          {usuario ? "Volver al sistema" : "Volver al inicio de sesión"}
        </Link>

        <h1>
          <LuShieldCheck aria-hidden="true" />
          Aviso de privacidad
        </h1>
        <p className="pv-fecha">Vigente desde el {FECHA_AVISO_PRIVACIDAD}</p>

        <p className="pv-resumen">
          RutaCacao registra la trazabilidad de lotes de cacao fino de aroma.
          Usamos tus datos para crear tu cuenta, comprobar que eres productor o
          representante de una asociación y mostrar al consumidor el origen de
          cada lote. Tu cédula, celular, correo y dirección nunca se publican.
        </p>

        {!CORREO_DATOS && (
          <p className="pv-alerta">
            <LuTriangleAlert aria-hidden="true" />
            Falta configurar el correo de contacto para protección de datos.
          </p>
        )}

        <section>
          <h2>1. Responsable del tratamiento</h2>
          <p>
            {RESPONSABLE_DATOS}. Contacto para todo lo relacionado con tus datos
            personales: <Contacto />.
          </p>
        </section>

        <section>
          <h2>2. Qué datos recogemos</h2>
          <table className="pv-tabla">
            <thead>
              <tr>
                <th>Tipo de dato</th>
                <th>Ejemplos</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Identificación</td>
                <td>Nombres, apellidos y número de cédula</td>
              </tr>
              <tr>
                <td>Contacto</td>
                <td>Correo electrónico y número de celular</td>
              </tr>
              <tr>
                <td>Ubicación</td>
                <td>Provincia, cantón, parroquia o recinto y referencia para llegar a la finca o a la sede</td>
              </tr>
              <tr>
                <td>Cuenta</td>
                <td>Rol en el sistema y contraseña (se guarda cifrada; nadie puede leerla)</td>
              </tr>
              <tr>
                <td>Producción</td>
                <td>Lotes, actividades de trazabilidad, certificaciones y códigos QR que registras o que se registran sobre tus lotes</td>
              </tr>
            </tbody>
          </table>
          <p>
            Los datos los entregas tú en el formulario de solicitud de cuenta.
            Si eres productor y tu asociación ya te había registrado, parte de
            ellos provienen de tu asociación.
          </p>
        </section>

        <section>
          <h2>3. Para qué los usamos</h2>
          <ul>
            <li>Crear y administrar tu cuenta e identificarte al iniciar sesión.</li>
            <li>Comprobar, antes de aprobar tu cuenta, que perteneces a la asociación que indicaste; para eso tu asociación o el administrador pueden llamarte o visitar tu finca.</li>
            <li>Registrar el historial de cada lote y gestionar sus certificaciones.</li>
            <li>Mostrar al consumidor, al escanear el código QR, el origen y el recorrido del lote.</li>
          </ul>
          <p>
            No usamos tus datos para publicidad, no los vendemos y no se toman
            decisiones automáticas sobre ti: cada solicitud y cada certificación
            la revisa una persona.
          </p>
        </section>

        <section>
          <h2>4. Base legal</h2>
          <p>
            Tratamos tus datos con tu consentimiento, que das al marcar la
            casilla de aceptación del formulario o al aceptar este aviso al
            iniciar sesión. Puedes retirarlo en cualquier momento (sección 8).
          </p>
        </section>

        <section>
          <h2>5. Quién puede ver tus datos</h2>
          <table className="pv-tabla">
            <thead>
              <tr>
                <th>Quién</th>
                <th>Qué ve</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Administrador del sistema</td>
                <td>Todos los datos, para gestionar cuentas y certificaciones</td>
              </tr>
              <tr>
                <td>Tu asociación</td>
                <td>Los datos de sus productores y de sus lotes</td>
              </tr>
              <tr>
                <td>Certificador asignado</td>
                <td>Los datos del lote que revisa y su historial</td>
              </tr>
              <tr>
                <td>Cualquier persona que escanee el QR</td>
                <td>
                  Nombre y apellido del productor; nombre, provincia y cantón de la
                  asociación; ubicación del lote; actividades registradas (con el
                  nombre y rol de quien las registró) y certificaciones vigentes.
                  <strong> Nunca</strong> la cédula, el celular, el correo ni tu dirección.
                </td>
              </tr>
            </tbody>
          </table>
          <p>
            Los datos se guardan en los servidores del servicio de alojamiento
            del sistema, que pueden estar ubicados fuera del Ecuador.
          </p>
        </section>

        <section>
          <h2>6. Cuánto tiempo los conservamos</h2>
          <ul>
            <li>Solicitudes rechazadas: se eliminan automáticamente {DIAS_CONSERVAR_RECHAZADAS} días después del rechazo.</li>
            <li>Datos de la cuenta: mientras la cuenta esté activa, o hasta que pidas eliminarlos.</li>
            <li>Historial de los lotes: mientras el lote exista, porque es el respaldo de su trazabilidad y de sus certificaciones.</li>
          </ul>
        </section>

        <section>
          <h2>7. Si no entregas tus datos o son incorrectos</h2>
          <p>
            Sin los datos obligatorios del formulario no podemos crear tu
            cuenta. Si los datos son falsos o no se pueden comprobar, la
            solicitud puede ser rechazada, y la información de tus lotes podría
            no ser confiable para obtener una certificación.
          </p>
        </section>

        <section>
          <h2>8. Tus derechos</h2>
          <p>
            Según la Ley Orgánica de Protección de Datos Personales puedes
            pedir, sin costo:
          </p>
          <ul>
            <li><strong>Acceso:</strong> saber qué datos tuyos tenemos.</li>
            <li><strong>Rectificación y actualización:</strong> corregir datos inexactos o incompletos.</li>
            <li><strong>Eliminación:</strong> que borremos tus datos cuando ya no sean necesarios.</li>
            <li><strong>Oposición</strong> y <strong>suspensión</strong> del tratamiento.</li>
            <li><strong>Portabilidad:</strong> recibir tus datos en un formato que puedas llevar a otro servicio.</li>
            <li><strong>Retirar tu consentimiento</strong> en cualquier momento, sin afectar lo tratado antes.</li>
          </ul>
          <p>
            Escribe a <Contacto /> desde el correo de tu cuenta. Responderemos
            en un plazo máximo de 15 días. Si no estás conforme con la
            respuesta, puedes presentar un reclamo ante la Superintendencia de
            Protección de Datos Personales.
          </p>
        </section>

        <section>
          <h2>9. Seguridad</h2>
          <p>
            Las contraseñas se guardan cifradas, cada rol ve solo la
            información que le corresponde y las comunicaciones con el
            sistema publicado viajan cifradas (HTTPS). Para mantener tu
            sesión abierta, el navegador guarda un código de acceso; no
            usamos cookies de publicidad ni de seguimiento.
          </p>
        </section>

        <section>
          <h2>10. Cambios en este aviso</h2>
          <p>
            Si cambiamos este aviso de forma importante, te pediremos que lo
            leas y lo aceptes de nuevo la próxima vez que inicies sesión.
          </p>
        </section>
      </main>

    </div>
  );
};

export default Privacidad;
