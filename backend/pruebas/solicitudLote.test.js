// ==========================================================
// PRUEBAS DE LAS SOLICITUDES DE LOTE
// (el productor pide un lote nuevo al administrador)
// Base de datos SIMULADA.
//
// Ejecutar, desde la carpeta backend:
//   npm test
// ==========================================================

const test = require("node:test");
const assert = require("node:assert/strict");

const SolicitudLote = require("../models/SolicitudLote");
const Productor = require("../models/Productor");
const Lote = require("../models/Lote");
const S = require("../controllers/solicitudLoteController");
const { crearLote } = require("../controllers/loteController");

const respuesta = () => {
  const res = { estado: 200 };
  res.status = (c) => { res.estado = c; return res; };
  res.json = (d) => { res.datos = d; return res; };
  return res;
};

// Productor vinculado al usuario (lo usa obtenerProductorPropio)
const vincular = (id) => { Productor.findOne = () => ({ select: async () => (id ? { _id: id } : null) }); };
const consultaPoblada = (valor) => { const q = { populate: () => q, sort: () => q, limit: () => q, then: (ok) => ok(valor) }; return q; };

const valido = { cantidad: "15", unidad: "quintales", estadoGrano: "baba", fechaSiembra: "2016-04-01", fechaEstimadaCosecha: "2027-01-10", mensaje: "Parcela junto al río" };


test("datos de la solicitud: cantidad en kg, grano y fechas", () => {
  const r = S.validarSolicitudLote(valido);
  assert.equal(r.cantidadKg, 680.39);
  assert.equal(r.estadoGrano, "baba");
  assert.equal(r.fechaSiembra.toISOString().slice(0, 10), "2016-04-01");
  assert.equal(r.mensaje, "Parcela junto al río");

  assert.throws(() => S.validarSolicitudLote({ ...valido, cantidad: "" }), /cantidad aproximada/);
  assert.throws(() => S.validarSolicitudLote({ ...valido, cantidad: "0" }), /mayor que cero/);
  assert.throws(() => S.validarSolicitudLote({ ...valido, estadoGrano: "tostado" }), /seco.*baba/);
  assert.throws(() => S.validarSolicitudLote({ ...valido, fechaEstimadaCosecha: "2015-01-01" }), /posterior a la siembra/);
  assert.throws(() => S.validarSolicitudLote({ ...valido, mensaje: "x".repeat(501) }), /500 caracteres/);
});

test("el productor solicita un lote; máximo 3 pendientes", async () => {
  vincular("p1");
  let creada;
  SolicitudLote.countDocuments = async () => 0;
  SolicitudLote.create = async (d) => { creada = { _id: "s1", ...d }; return creada; };
  SolicitudLote.findById = () => consultaPoblada(creada);

  const req = { usuario: { _id: "u3", rol: "productor" }, body: valido };
  const res = respuesta();
  await S.crearSolicitudLote(req, res);
  assert.equal(res.estado, 201, res.datos?.mensaje);
  assert.equal(String(creada.productor), "p1", "el productor sale de la sesión, no del formulario");
  assert.equal(creada.cantidadKg, 680.39);

  SolicitudLote.countDocuments = async () => 3;
  const lleno = respuesta();
  await S.crearSolicitudLote({ usuario: { _id: "u3", rol: "productor" }, body: valido }, lleno);
  assert.equal(lleno.estado, 400);
  assert.match(lleno.datos.mensaje, /3 solicitudes de lote pendientes/);

  vincular(null);
  const sinFicha = respuesta();
  await S.crearSolicitudLote({ usuario: { _id: "u9", rol: "productor" }, body: valido }, sinFicha);
  assert.equal(sinFicha.estado, 403);
});

test("el productor solo ve y cancela sus solicitudes pendientes", async () => {
  vincular("p1");
  let filtroUsado;
  SolicitudLote.find = (f) => { filtroUsado = f; return consultaPoblada([]); };
  await S.listarSolicitudesLote({ usuario: { _id: "u3", rol: "productor" }, query: {} }, respuesta());
  assert.equal(String(filtroUsado.productor), "p1");

  const sol = { _id: "s1", productor: "p1", estado: "pendiente", save: async () => {} };
  SolicitudLote.findById = async () => sol;
  const ok = respuesta();
  await S.cancelarSolicitudLote({ params: { id: "s1" }, usuario: { _id: "u3", rol: "productor" } }, ok);
  assert.equal(ok.estado, 200);
  assert.equal(sol.estado, "cancelada");

  const ajena = { _id: "s2", productor: "p2", estado: "pendiente", save: async () => {} };
  SolicitudLote.findById = async () => ajena;
  const prohibido = respuesta();
  await S.cancelarSolicitudLote({ params: { id: "s2" }, usuario: { _id: "u3", rol: "productor" } }, prohibido);
  assert.equal(prohibido.estado, 403);
});

test("el administrador rechaza con un motivo", async () => {
  const sol = { _id: "s1", productor: "p1", estado: "pendiente", save: async () => {} };
  SolicitudLote.findById = async () => sol;
  const corto = respuesta();
  await S.rechazarSolicitudLote({ params: { id: "s1" }, usuario: { _id: "u1" }, body: { motivo: "no" } }, corto);
  assert.equal(corto.estado, 400);

  const ok = respuesta();
  await S.rechazarSolicitudLote({ params: { id: "s1" }, usuario: { _id: "u1" }, body: { motivo: "La cosecha aún no está lista" } }, ok);
  assert.equal(ok.estado, 200);
  assert.equal(sol.estado, "rechazada");
  assert.equal(sol.motivoRechazo, "La cosecha aún no está lista");

  const otraVez = respuesta();
  await S.rechazarSolicitudLote({ params: { id: "s1" }, usuario: { _id: "u1" }, body: { motivo: "Otra vez rechazo" } }, otraVez);
  assert.equal(otraVez.estado, 400, "ya revisada");
});

test("al crear el lote desde la solicitud, la solicitud queda aprobada con el lote", async () => {
  const sol = { _id: "s1", productor: "p1", estado: "pendiente", save: async () => {} };
  SolicitudLote.findById = async () => sol;
  Productor.findById = (id) => {
    const r = { _id: id, activo: true };
    return { select: async () => r, then: (ok) => ok(r) };
  };
  let creado;
  Lote.create = async (d) => { creado = { _id: "l9", ...d }; return creado; };
  Lote.findById = () => consultaPoblada(creado);

  const otro = respuesta();
  await crearLote({ usuario: { _id: "u1", rol: "administrador" }, body: { productor: "p2", cantidad: 500, solicitudLote: "s1" } }, otro);
  assert.equal(otro.estado, 400, "otro productor");
  assert.equal(creado, undefined, "no se creó ningún lote");

  const ok = respuesta();
  await crearLote({ usuario: { _id: "u1", rol: "administrador" }, body: { productor: "p1", cantidad: 680.39, estadoGrano: "baba", solicitudLote: "s1" } }, ok);
  assert.equal(ok.estado, 201, ok.datos?.mensaje);
  assert.equal(sol.estado, "aprobada");
  assert.equal(sol.lote, "l9");
  assert.equal(sol.revisadoPor, "u1");

  creado = undefined;
  const repetida = respuesta();
  await crearLote({ usuario: { _id: "u1", rol: "administrador" }, body: { productor: "p1", cantidad: 100, solicitudLote: "s1" } }, repetida);
  assert.equal(repetida.estado, 400, "una solicitud aprobada no crea otro lote");
  assert.equal(creado, undefined);
});
