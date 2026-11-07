// ==========================================================
// PRUEBAS DEL LÍMITE DE INTENTOS AL INICIAR SESIÓN
// Usa un reloj simulado para no esperar 15 minutos reales.
//
// Ejecutar, desde la carpeta backend:
//   npm test
// ==========================================================

const test = require("node:test");
const assert = require("node:assert/strict");

const { crearControlIntentos } = require("../utils/intentosLogin");

const MIN = 60 * 1000;

const nuevoControl = (opciones = {}) => {
  let ahora = 1_000_000;
  const control = crearControlIntentos({ reloj: () => ahora, ...opciones });
  return { control, avanzar: (ms) => { ahora += ms; } };
};


test("cuenta los intentos que quedan y bloquea al quinto fallo", () => {
  const { control } = nuevoControl();
  const ip = "10.0.0.1";

  assert.equal(control.fallo(ip, "ana@finca.ec").restantes, 4);
  assert.equal(control.fallo(ip, "ana@finca.ec").restantes, 3);
  assert.equal(control.fallo(ip, "ana@finca.ec").restantes, 2);
  assert.equal(control.fallo(ip, "ana@finca.ec").restantes, 1);

  const quinto = control.fallo(ip, "ana@finca.ec");
  assert.equal(quinto.bloqueado, true);
  assert.equal(quinto.minutos, 15);
  assert.equal(control.revisar(ip, "ana@finca.ec").bloqueado, true);
});

test("el bloqueo termina a los 15 minutos", () => {
  const { control, avanzar } = nuevoControl();
  for (let i = 0; i < 5; i++) control.fallo("10.0.0.1", "ana@finca.ec");

  avanzar(14 * MIN);
  assert.deepEqual(control.revisar("10.0.0.1", "ana@finca.ec"), { bloqueado: true, minutos: 1 });

  avanzar(1 * MIN + 1);
  assert.equal(control.revisar("10.0.0.1", "ana@finca.ec").bloqueado, false);
});

test("los fallos viejos (más de 15 minutos) ya no cuentan", () => {
  const { control, avanzar } = nuevoControl();
  for (let i = 0; i < 4; i++) control.fallo("10.0.0.1", "ana@finca.ec");
  avanzar(16 * MIN);
  assert.equal(control.fallo("10.0.0.1", "ana@finca.ec").restantes, 4, "empieza de nuevo");
});

test("un inicio de sesión correcto borra los fallos de la cuenta", () => {
  const { control } = nuevoControl();
  for (let i = 0; i < 4; i++) control.fallo("10.0.0.1", "ana@finca.ec");
  control.exito("10.0.0.1", "ana@finca.ec");
  assert.equal(control.fallo("10.0.0.1", "ana@finca.ec").restantes, 4);
});

test("el correo no distingue mayúsculas ni espacios", () => {
  const { control } = nuevoControl();
  for (let i = 0; i < 4; i++) control.fallo("10.0.0.1", "Ana@Finca.ec ");
  assert.equal(control.fallo("10.0.0.1", "ana@finca.ec").bloqueado, true);
});

test("el bloqueo de una cuenta no afecta a otras redes ni a otras cuentas", () => {
  const { control } = nuevoControl();
  for (let i = 0; i < 5; i++) control.fallo("10.0.0.1", "ana@finca.ec");

  assert.equal(control.revisar("10.0.0.2", "ana@finca.ec").bloqueado, false, "el dueño entra desde su red");
  assert.equal(control.revisar("10.0.0.1", "pedro@finca.ec").bloqueado, false, "otra cuenta en la misma red");
});

test("muchos fallos desde una red, con correos distintos, bloquean esa red", () => {
  const { control } = nuevoControl({ maximoPorRed: 20 });
  let ultimo;
  for (let i = 0; i < 20; i++) ultimo = control.fallo("10.0.0.9", `persona${i}@finca.ec`);

  assert.equal(ultimo.bloqueado, true);
  assert.equal(control.revisar("10.0.0.9", "otra@finca.ec").bloqueado, true);
  assert.equal(control.revisar("10.0.0.8", "otra@finca.ec").bloqueado, false);
});


test("el inicio de sesión responde 401 con aviso y luego 429", async () => {
  const bcrypt = require("bcryptjs");
  process.env.JWT_SECRET = process.env.JWT_SECRET || "secreto-de-prueba";
  const Usuario = require("../models/Usuario");
  const SolicitudCuenta = require("../models/SolicitudCuenta");
  const { login } = require("../controllers/authController");

  const usuario = {
    _id: "64b0000000000000000000c9", rol: "certificador", activo: true,
    nombre: "Carla", apellido: "M", email: "carla@prueba.ec",
    password: await bcrypt.hash("correcta", 4), consentimiento: {}
  };
  Usuario.findOne = async ({ email }) => (email === "carla@prueba.ec" ? usuario : null);
  SolicitudCuenta.findOne = () => ({ sort: async () => null, then: (ok) => ok(null) });

  const pedir = async (password, ip = "10.1.1.1") => {
    const res = { estado: 200 };
    res.status = (c) => { res.estado = c; return res; };
    res.json = (d) => { res.datos = d; return res; };
    await login({ ip, body: { email: "carla@prueba.ec", password } }, res);
    return res;
  };

  assert.equal((await pedir("mala")).estado, 401);
  assert.equal((await pedir("mala")).estado, 401);
  const tercero = await pedir("mala");
  assert.equal(tercero.estado, 401);
  assert.match(tercero.datos.mensaje, /quedan 2 intentos/);
  assert.match((await pedir("mala")).datos.mensaje, /queda 1 intento/);

  const quinto = await pedir("mala");
  assert.equal(quinto.estado, 429);
  assert.match(quinto.datos.mensaje, /espera 15 minutos/);

  assert.equal((await pedir("correcta")).estado, 429, "bloqueada aunque la contraseña sea correcta");
  assert.equal((await pedir("correcta", "10.1.1.2")).estado, 200, "desde otra red sí entra");
});
