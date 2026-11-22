// ==========================================================
// ENVÍO DE CORREOS (Brevo, API por HTTPS)
// ----------------------------------------------------------
// Se usa la API HTTP de Brevo y no SMTP porque el plan
// gratuito de Render bloquea los puertos SMTP (25, 465, 587).
// Plan gratuito de Brevo: 300 correos al día, sin tarjeta.
//
// Configuración (backend/.env y Render → Environment):
//   BREVO_API_KEY=xkeysib-...         clave de API de Brevo
//   CORREO_REMITENTE=tu@correo.com     remitente verificado en Brevo
//   CORREO_REMITENTE_NOMBRE=RutaCacao  (opcional; por defecto, la empresa)
//
// Sin configuración el sistema funciona igual: el correo no
// se envía y queda registrado como «sin_configurar».
// Un correo que falla NUNCA detiene la operación (aprobar,
// rechazar, etc.): solo se registra el resultado.
// ==========================================================

const { datosEmpresa } = require("./empresa");

const URL_BREVO = "https://api.brevo.com/v3/smtp/email";
const ESPERA_MS = 10000;

// Se puede reemplazar en las pruebas
const cliente = { fetch: (...args) => globalThis.fetch(...args) };

const correoConfigurado = () =>
  Boolean(process.env.BREVO_API_KEY && process.env.CORREO_REMITENTE);


// Envía un correo. Devuelve { estado, detalle }:
//   enviado | sin_configurar | fallido
const enviarCorreo = async ({ para, nombre, asunto, html }) => {
  if (!correoConfigurado()) {
    return { estado: "sin_configurar", detalle: "Falta BREVO_API_KEY o CORREO_REMITENTE" };
  }

  try {
    const respuesta = await cliente.fetch(URL_BREVO, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": process.env.BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: {
          name: process.env.CORREO_REMITENTE_NOMBRE || datosEmpresa().nombre || "RutaCacao",
          email: process.env.CORREO_REMITENTE
        },
        to: [{ email: para, name: nombre || para }],
        subject: asunto,
        htmlContent: html
      }),
      signal: AbortSignal.timeout(ESPERA_MS)
    });

    if (!respuesta.ok) {
      let detalle = "";
      try { detalle = (await respuesta.json())?.message || ""; } catch { /* sin cuerpo */ }
      console.error(`Correo: Brevo respondió ${respuesta.status}: ${detalle}`);
      return { estado: "fallido", detalle: `Brevo respondió ${respuesta.status}` };
    }

    return { estado: "enviado", detalle: "" };

  } catch (error) {
    console.error("Correo: no se pudo enviar:", error.message);
    return { estado: "fallido", detalle: "No se pudo conectar con el servicio de correo" };
  }
};


// Escapa texto para insertarlo en el HTML del correo
const html = (texto) =>
  String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");


module.exports = {
  cliente,
  correoConfigurado,
  enviarCorreo,
  html
};
