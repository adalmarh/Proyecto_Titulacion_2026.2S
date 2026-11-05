// ==========================================================
// PRUEBAS DE "MI PERFIL" (base de datos SIMULADA)
// Cambiar el celular y la contraseña, y que las sesiones
// abiertas con la contraseña anterior dejen de valer.
//
// Ejecutar, desde la carpeta backend:
//   npm test
// ==========================================================

const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = process.env.JWT_SECRET || "secreto-de-prueba";

const Usuario = require("../models/Usuario");
const Productor = require("../models/Productor");
const { actualizarPerfil, cambiarPassword } = require("../controllers/authController");
const protegerRuta = require("../middleware/authMiddleware");

const ID = "64b0000000000000000000a1";
let guardado;
let fichaProductor;

const nuevoUsuario = async (rol = "productor") => ({
  _id: ID,
  nombre: "Rosa",
  apellido: "Mendoza",
  email: "rosa@finca.ec",
  rol,
  activo: true,
  telefono: "",
  password: await bcrypt.hash("clave123", 4),
  passwordCambiado: null,
  consentimiento: {},
  async save() { return this; },
  async populate() { return this; }
});

const consulta = (valor) => {
  const q = {
    select: () => q,
    populate: () => q,
    then: (ok, mal) => Promise.resolve(valor()).then(ok, mal)
  };
  return q;
};

Usuario.findById = () => consulta(() => guardado);
Usuario.updateOne = async (_f, cambios) => { Object.assign(guardado, cambios); return {}; };
Productor.findOne = () => consulta(() => fichaProductor);
Productor.updateOne = async (_f, cambios) => { Object.assign(fichaProductor, cambios); return {}; };

const respuesta = () => {
  const res = { estado: 200 };
  res.status = (c) => { res.estado = c; return res; };
  res.json = (d) => { res.datos = d; return res; };
  return res;
};

const pedir = async (fn, body, rol = "productor") => {
  const res = respuesta();
  await fn({ usuario: { _id: ID, rol }, body }, res);
  return res;
};


test("cambiar el celular: valida el formato y lo copia a la ficha del productor", async () => {
  guardado = await nuevoUsuario();
  fichaProductor = { _id: "p1", nombre: "Rosa", apellido: "Mendoza", telefono: "0990000000", asociacion: null };

  const malo = await pedir(actualizarPerfil, { telefono: "12345" });
  assert.equal(malo.estado, 400);

  const bien = await pedir(actualizarPerfil, { telefono: "099 123 4567" });
  assert.equal(bien.estado, 200, bien.datos?.mensaje);
  assert.equal(guardado.telefono, "0991234567");
  assert.equal(fichaProductor.telefono, "0991234567");
  assert.equal(bien.datos.usuario.telefono, "0991234567");
  assert.ok(!("password" in bien.datos.usuario), "no devuelve la contraseña");
});

test("el celular de otros roles se guarda solo en la cuenta", async () => {
  guardado = await nuevoUsuario("certificador");
  fichaProductor = { telefono: "sin cambios" };
  const r = await pedir(actualizarPerfil, { telefono: "0987654321" }, "certificador");
  assert.equal(r.estado, 200);
  assert.equal(guardado.telefono, "0987654321");
  assert.equal(fichaProductor.telefono, "sin cambios");
});

test("cambiar la contraseña: exige la actual y una nueva válida y distinta", async () => {
  guardado = await nuevoUsuario();

  assert.equal((await pedir(cambiarPassword, { actual: "otra", nueva: "nueva123" })).estado, 400);
  assert.equal((await pedir(cambiarPassword, { actual: "clave123", nueva: "123" })).estado, 400);
  assert.equal((await pedir(cambiarPassword, { actual: "clave123", nueva: "clave123" })).estado, 400);

  const r = await pedir(cambiarPassword, { actual: "clave123", nueva: "nueva123" });
  assert.equal(r.estado, 200, r.datos?.mensaje);
  assert.ok(await bcrypt.compare("nueva123", guardado.password));
  assert.ok(guardado.passwordCambiado instanceof Date);
  assert.ok(r.datos.token, "devuelve un token nuevo");
});

test("tras cambiar la contraseña, el token viejo deja de valer y el nuevo sí", async () => {
  guardado = await nuevoUsuario();
  const viejo = jwt.sign({ id: ID, rol: "productor", iat: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET);

  const r = await pedir(cambiarPassword, { actual: "clave123", nueva: "nueva123" });
  const nuevo = r.datos.token;

  const probar = async (token) => {
    const res = respuesta();
    let paso = false;
    await protegerRuta({ headers: { authorization: `Bearer ${token}` } }, res, () => { paso = true; });
    return paso ? 200 : res.estado;
  };

  assert.equal(await probar(viejo), 401);
  assert.equal(await probar(nuevo), 200);
});
