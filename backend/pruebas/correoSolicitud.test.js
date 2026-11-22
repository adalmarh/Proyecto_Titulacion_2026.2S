// ==========================================================
// PRUEBAS DEL AVISO POR CORREO DE LA SOLICITUD DE CUENTA
// y de la consulta pública del estado.
// Brevo y la base de datos están SIMULADOS: no se envían
// correos reales.
//
// Ejecutar, desde la carpeta backend:
//   npm test
// ==========================================================

const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");

const correo = require("../utils/correo");
const { correoAprobada, correoRechazada } = require("../utils/correosSolicitud");
const SolicitudCuenta = require("../models/SolicitudCuenta");
const Usuario = require("../models/Usuario");
const { rechazarSolicitud, consultarEstadoSolicitud } = require("../controllers/solicitudController");

const respuesta = () => {
  const res = { estado: 200 };
  res.status = (c) => { res.estado = c; return res; };
  res.json = (d) => { res.datos = d; return res; };
  return res;
};

const configurar = () => {
  process.env.BREVO_API_KEY = "clave-de-prueba";
  process.env.CORREO_REMITENTE = "avisos@finca.ec";
  process.env.QR_FRONTEND_URL = "https://rutacacao.onrender.com";
};
const desconfigurar = () => { delete process.env.BREVO_API_KEY; delete process.env.CORREO_REMITENTE; };


test("sin configurar Brevo no se envía nada y no hay error", async () => {
  desconfigurar();
  let llamado = false;
  correo.cliente.fetch = async () => { llamado = true; };
  const r = await correo.enviarCorreo({ para: "a@b.ec", asunto: "x", html: "<p>x</p>" });
  assert.equal(r.estado, "sin_configurar");
  assert.equal(llamado, false);
});

test("envía por la API de Brevo con la clave en la cabecera", async () => {
  configurar();
  let pedido;
  correo.cliente.fetch = async (url, op) => { pedido = { url, op, cuerpo: JSON.parse(op.body) }; return { ok: true, status: 201, json: async () => ({ messageId: "m1" }) }; };
  const r = await correo.enviarCorreo({ para: "rosa@finca.ec", nombre: "Rosa Vera", asunto: "Hola", html: "<p>Hola</p>" });
  assert.equal(r.estado, "enviado");
  assert.equal(pedido.url, "https://api.brevo.com/v3/smtp/email");
  assert.equal(pedido.op.headers["api-key"], "clave-de-prueba");
  assert.deepEqual(pedido.cuerpo.to, [{ email: "rosa@finca.ec", name: "Rosa Vera" }]);
  assert.equal(pedido.cuerpo.sender.email, "avisos@finca.ec");
  assert.ok(!pedido.url.includes("clave-de-prueba"), "la clave no va en la URL");
});

test("si Brevo falla o no hay internet, se registra «fallido» sin lanzar error", async () => {
  configurar();
  const original = console.error; console.error = () => {};
  correo.cliente.fetch = async () => ({ ok: false, status: 401, json: async () => ({ message: "Key not found" }) });
  assert.equal((await correo.enviarCorreo({ para: "a@b.ec", asunto: "x", html: "x" })).estado, "fallido");
  correo.cliente.fetch = async () => { throw new Error("ENOTFOUND"); };
  assert.equal((await correo.enviarCorreo({ para: "a@b.ec", asunto: "x", html: "x" })).estado, "fallido");
  console.error = original;
});

test("los correos escapan los datos del solicitante y enlazan al sistema", () => {
  configurar();
  const ok = correoAprobada({ nombre: "<script>alert(1)</script>", email: "rosa@finca.ec" });
  assert.ok(!ok.html.includes("<script>"), "sin código inyectado");
  assert.ok(ok.html.includes("&lt;script&gt;"));
  assert.ok(ok.html.includes('href="https://rutacacao.onrender.com/"'));

  const no = correoRechazada({ nombre: "Rosa", motivoRechazo: "Cédula <b>no</b> coincide" });
  assert.ok(no.html.includes("Cédula &lt;b&gt;no&lt;/b&gt; coincide"), "el motivo va en el correo");
  assert.ok(no.html.includes("/solicitar-cuenta"));
});

test("al rechazar se envía el aviso y su resultado va en la respuesta", async () => {
  configurar();
  const sol = { _id: "507f1f77bcf86cd799439011", nombre: "Rosa", apellido: "Vera", email: "rosa@finca.ec", estado: "pendiente", save: async () => {}, toObject() { return { ...this }; } };
  SolicitudCuenta.findById = async () => sol;
  let guardado;
  SolicitudCuenta.updateOne = async (_f, cambio) => { guardado = cambio.$set.avisoCorreo; };
  let destinatario;
  correo.cliente.fetch = async (_u, op) => { destinatario = JSON.parse(op.body).to[0].email; return { ok: true, status: 201, json: async () => ({}) }; };

  const res = respuesta();
  await rechazarSolicitud({ params: { id: sol._id }, usuario: { _id: "u1", rol: "administrador" }, body: { motivo: "La cédula no coincide" } }, res);
  assert.equal(res.estado, 200, res.datos?.mensaje);
  assert.equal(destinatario, "rosa@finca.ec");
  assert.equal(res.datos.avisoCorreo.estado, "enviado");
  assert.equal(guardado.estado, "enviado");
});

test("un correo fallido no impide rechazar la solicitud", async () => {
  configurar();
  const original = console.error; console.error = () => {};
  const sol = { _id: "507f1f77bcf86cd799439012", nombre: "Ana", apellido: "Paz", email: "ana@finca.ec", estado: "pendiente", save: async () => {}, toObject() { return { ...this }; } };
  SolicitudCuenta.findById = async () => sol;
  SolicitudCuenta.updateOne = async () => {};
  correo.cliente.fetch = async () => { throw new Error("sin internet"); };
  const res = respuesta();
  await rechazarSolicitud({ params: { id: sol._id }, usuario: { _id: "u1", rol: "administrador" }, body: { motivo: "Datos incompletos" } }, res);
  assert.equal(res.estado, 200);
  assert.equal(sol.estado, "rechazada");
  assert.equal(res.datos.avisoCorreo.estado, "fallido");
  console.error = original;
});

test("consultar el estado: solo con el correo y la contraseña correctos", async () => {
  const hash = await bcrypt.hash("cacao123", 4);
  Usuario.findOne = () => ({ select: async () => null });
  const pendiente = { estado: "pendiente", password: hash, createdAt: new Date() };
  SolicitudCuenta.findOne = () => ({ sort: async () => pendiente });
  const consultar = async (body) => { const res = respuesta(); await consultarEstadoSolicitud({ body }, res); return res; };

  assert.equal((await consultar({ email: "rosa@finca.ec" })).estado, 400);
  assert.equal((await consultar({ email: "rosa@finca.ec", password: "otra" })).estado, 404);

  const ok = await consultar({ email: "Rosa@Finca.ec ", password: "cacao123" });
  assert.equal(ok.estado, 200);
  assert.equal(ok.datos.estado, "pendiente");
  assert.equal(ok.datos.password, undefined);

  Object.assign(pendiente, { estado: "rechazada", motivoRechazo: "La cédula no coincide" });
  const rechazada = await consultar({ email: "rosa@finca.ec", password: "cacao123" });
  assert.equal(rechazada.datos.motivoRechazo, "La cédula no coincide");

  // Ya aprobada: la contraseña está en la cuenta
  Usuario.findOne = () => ({ select: async () => ({ password: hash }) });
  SolicitudCuenta.findOne = () => ({ sort: () => ({ select: async () => ({ createdAt: new Date(), fechaRevision: new Date() }) }) });
  const aprobada = await consultar({ email: "rosa@finca.ec", password: "cacao123" });
  assert.equal(aprobada.datos.estado, "aprobada");
  assert.equal((await consultar({ email: "rosa@finca.ec", password: "mala" })).estado, 404);
});
