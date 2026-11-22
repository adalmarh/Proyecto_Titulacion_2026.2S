// ==========================================================
// CORREOS DE LA SOLICITUD DE CUENTA
// Avisan al solicitante que su solicitud fue aprobada (ya
// puede iniciar sesión) o rechazada (con el motivo).
// ==========================================================

const { enviarCorreo, html } = require("./correo");
const { datosEmpresa } = require("./empresa");

const direccionSistema = () =>
  (process.env.QR_FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");

// «S.A.» ya termina en punto: no agregar otro
const conPunto = (texto) => (String(texto).endsWith(".") ? texto : `${texto}.`);

// Plantilla común (estilos en línea: los lectores de correo
// no aplican hojas de estilo)
const plantilla = ({ titulo, color, cuerpo, boton, enlace }) => `<!doctype html>
<html lang="es"><body style="margin:0;background:#f4f1ec;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
        <tr><td style="background:#1f4d3a;padding:18px 24px;color:#ffffff;font-size:20px;font-weight:bold">RutaCacao</td></tr>
        <tr><td style="padding:24px">
          <h1 style="margin:0 0 12px;font-size:20px;color:${color}">${titulo}</h1>
          ${cuerpo}
          ${boton ? `<p style="margin:24px 0"><a href="${enlace}" style="background:#2f855a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;display:inline-block">${boton}</a></p>` : ""}
          <p style="margin:24px 0 0;font-size:12px;color:#6b7280">
            Este correo lo envió automáticamente el sistema RutaCacao de ${html(conPunto(datosEmpresa().nombre || "la empresa"))}
            Si no solicitaste una cuenta, puedes ignorarlo.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;


const correoAprobada = (solicitud) => ({
  asunto: "Tu cuenta de productor en RutaCacao fue aprobada",
  html: plantilla({
    titulo: "¡Tu cuenta fue aprobada!",
    color: "#22543d",
    cuerpo: `
      <p style="margin:0 0 12px;line-height:1.6">Hola ${html(solicitud.nombre)},</p>
      <p style="margin:0 0 12px;line-height:1.6">
        Tu solicitud de cuenta de productor en <strong>${html(datosEmpresa().nombre || "la empresa")}</strong> fue aprobada.
        Ya puedes iniciar sesión con tu correo <strong>${html(solicitud.email)}</strong> y la contraseña que elegiste al solicitarla.
      </p>
      <p style="margin:0;line-height:1.6">Desde tu cuenta podrás ver tus lotes, su trazabilidad y sus certificaciones.</p>`,
    boton: "Iniciar sesión",
    enlace: `${direccionSistema()}/`
  })
});


const correoRechazada = (solicitud) => ({
  asunto: "Tu solicitud de cuenta en RutaCacao fue revisada",
  html: plantilla({
    titulo: "Tu solicitud no fue aprobada",
    color: "#822727",
    cuerpo: `
      <p style="margin:0 0 12px;line-height:1.6">Hola ${html(solicitud.nombre)},</p>
      <p style="margin:0 0 12px;line-height:1.6">
        Revisamos tu solicitud de cuenta de productor y por ahora no pudo ser aprobada. El motivo es:
      </p>
      <p style="margin:0 0 12px;padding:12px 14px;background:#fff5f5;border-left:4px solid #c53030;line-height:1.6">${html(solicitud.motivoRechazo)}</p>
      <p style="margin:0;line-height:1.6">Si corriges esos datos, puedes enviar una nueva solicitud.</p>`,
    boton: "Enviar una nueva solicitud",
    enlace: `${direccionSistema()}/solicitar-cuenta`
  })
});


// Envía el aviso según el estado de la solicitud y devuelve
// lo que se guarda en solicitud.avisoCorreo
const avisarRevision = async (solicitud) => {
  const contenido = solicitud.estado === "aprobada" ? correoAprobada(solicitud) : correoRechazada(solicitud);
  const resultado = await enviarCorreo({
    para: solicitud.email,
    nombre: `${solicitud.nombre} ${solicitud.apellido}`.trim(),
    asunto: contenido.asunto,
    html: contenido.html
  });
  return { estado: resultado.estado, fecha: new Date() };
};


module.exports = {
  correoAprobada,
  correoRechazada,
  avisarRevision
};
