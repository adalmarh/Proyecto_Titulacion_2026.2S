// ==========================================================
// PRUEBAS DEL CONTROL DE ACCESO POR ROL
// ----------------------------------------------------------
// Usan una base de datos SIMULADA en memoria: no necesitan
// MongoDB ni modifican tus datos reales.
//
// Ejecutar, desde la carpeta backend:
//   npm test
// ==========================================================
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");

const BACKEND = path.join(__dirname, "..");
const req_ = (m) => require(path.join(BACKEND, m));

const mongoose = req_("node_modules/mongoose");
const express = req_("node_modules/express");
const Lote = req_("models/Lote");
const Productor = req_("models/Productor");
const Certificacion = req_("models/Certificacion");
const EventoTrazabilidad = req_("models/EventoTrazabilidad");

const oid = () => new mongoose.Types.ObjectId();

// ---------------- datos de ejemplo ----------------
// Todos los productores pertenecen a la misma empresa.
const U = {
  admin: { _id: oid(), rol: "administrador" },
  prod1: { _id: oid(), rol: "productor" },
  prodSin: { _id: oid(), rol: "productor" },
  cert1: { _id: oid(), rol: "certificador" },
  cert2: { _id: oid(), rol: "certificador" },
  // Cuenta que quedó con el rol eliminado: no debe ver nada
  viejaAsoc: { _id: oid(), rol: "asociacion" }
};
const P1 = { _id: oid(), usuario: U.prod1._id, activo: true };
const P2 = { _id: oid(), usuario: null, activo: true };
const P3 = { _id: oid(), usuario: null, activo: true };
const L1 = { _id: oid(), productor: P1._id };
const L2 = { _id: oid(), productor: P2._id };
const L3 = { _id: oid(), productor: P3._id };
const C1 = { _id: oid(), lote: L1._id, certificador: U.cert1._id, activo: true };
const C2 = { _id: oid(), lote: L3._id, certificador: null, activo: true };
const E1 = { _id: oid(), lote: L1._id, responsable: U.prod1._id };
const E2 = { _id: oid(), lote: L1._id, responsable: U.admin._id };
const E3 = { _id: oid(), lote: L3._id, responsable: U.admin._id };

const DB = {
  Lote: [L1, L2, L3],
  Productor: [P1, P2, P3],
  Certificacion: [C1, C2],
  EventoTrazabilidad: [E1, E2, E3]
};

// ------------- mini evaluador de filtros Mongo -------------
const igual = (a, b) => (a == null || b == null ? a == b : String(a) === String(b));
const coincide = (doc, filtro) => Object.entries(filtro).every(([k, v]) => {
  if (k === "$and") return v.every((f) => coincide(doc, f));
  const valor = doc[k];
  if (v && typeof v === "object" && !(v instanceof mongoose.Types.ObjectId)) {
    if ("$in" in v) return v.$in.some((x) => igual(x, valor));
    if ("$ne" in v) return !igual(valor, v.$ne);
  }
  return igual(valor, v);
});

const consulta = (resultado) => {
  const q = {
    select: () => q, populate: () => q, sort: () => q, limit: () => q,
    then: (ok, mal) => Promise.resolve(resultado).then(ok, mal)
  };
  return q;
};

const instalar = (Modelo, filas) => {
  Modelo.findOne = (f) => consulta(filas.find((d) => coincide(d, f)) || null);
  Modelo.findById = (id) => consulta(filas.find((d) => igual(d._id, id)) || null);
  Modelo.find = (f = {}) => consulta(filas.filter((d) => coincide(d, f)));
  Modelo.exists = async (f) => (filas.find((d) => coincide(d, f)) ? { _id: 1 } : null);
  Modelo.distinct = async (campo, f = {}) =>
    [...new Set(filas.filter((d) => coincide(d, f)).map((d) => d[campo]).filter((x) => x != null).map(String))]
      .map((s) => new mongoose.Types.ObjectId(s));
};
instalar(Lote, DB.Lote);
instalar(Productor, DB.Productor);
instalar(Certificacion, DB.Certificacion);
instalar(EventoTrazabilidad, DB.EventoTrazabilidad);

const alcance = req_("middleware/alcanceMiddleware");

const ids = (filas) => filas.map((d) => String(d._id)).sort();
const ver = async (fn, usuario, filas) => {
  const filtro = await fn({ usuario });
  return ids(filas.filter((d) => coincide(d, filtro)));
};

// Ejecuta un middleware y devuelve el código HTTP (200 = pasó a next)
const ejecutar = (mw, usuario, { params = {}, body } = {}) => new Promise((resolve) => {
  const req = { usuario, params, body };
  const res = {
    status(code) { this.code = code; return this; },
    json(datos) { resolve({ code: this.code, datos, body: req.body }); }
  };
  Promise.resolve(mw(req, res, () => resolve({ code: 200, body: req.body })));
});

// ---------------- pruebas ----------------
test("lotes visibles por rol", async () => {
  const f = alcance.filtroLotes;
  assert.deepEqual(await ver(f, U.admin, DB.Lote), ids([L1, L2, L3]));
  assert.deepEqual(await ver(f, U.prod1, DB.Lote), ids([L1]));
  assert.deepEqual(await ver(f, U.prodSin, DB.Lote), []);
  assert.deepEqual(await ver(f, U.cert1, DB.Lote), ids([L1]));
  assert.deepEqual(await ver(f, U.cert2, DB.Lote), []);
});

test("una cuenta con el rol asociación eliminado no ve nada", async () => {
  assert.deepEqual(await ver(alcance.filtroLotes, U.viejaAsoc, DB.Lote), []);
  assert.deepEqual(await ver(alcance.filtroProductores, U.viejaAsoc, DB.Productor), []);
  assert.deepEqual(await ver(alcance.filtroCertificaciones, U.viejaAsoc, DB.Certificacion), []);
  const { code } = await ejecutar(alcance.accesoLote((r) => r.params.id, "gestionar"), U.viejaAsoc, { params: { id: String(L1._id) } });
  assert.equal(code, 403);
});

test("productores visibles por rol", async () => {
  assert.deepEqual(await ver(alcance.filtroProductores, U.admin, DB.Productor), ids([P1, P2, P3]));
  assert.deepEqual(await ver(alcance.filtroProductores, U.prod1, DB.Productor), ids([P1]));
  assert.deepEqual(await ver(alcance.filtroProductores, U.cert1, DB.Productor), ids([P1]));
  assert.deepEqual(await ver(alcance.filtroProductores, U.cert2, DB.Productor), []);
});

test("eventos y certificaciones visibles por rol", async () => {
  assert.deepEqual(await ver(alcance.filtroEventos, U.prod1, DB.EventoTrazabilidad), ids([E1, E2]));
  assert.deepEqual(await ver(alcance.filtroEventos, U.admin, DB.EventoTrazabilidad), ids([E1, E2, E3]));
  assert.deepEqual(await ver(alcance.filtroCertificaciones, U.cert1, DB.Certificacion), ids([C1]));
  assert.deepEqual(await ver(alcance.filtroCertificaciones, U.cert2, DB.Certificacion), []);
  assert.deepEqual(await ver(alcance.filtroCertificaciones, U.prod1, DB.Certificacion), ids([C1]));
  assert.deepEqual(await ver(alcance.filtroCertificaciones, U.admin, DB.Certificacion), ids([C1, C2]));
});

test("acceso a un lote: ver y gestionar", async () => {
  const verL = () => alcance.accesoLote((r) => r.params.id, "ver");
  const gesL = () => alcance.accesoLote((r) => r.params.id, "gestionar");
  const casos = [
    ["admin", L3, "gestionar", 200], ["prod1", L1, "gestionar", 200], ["prod1", L2, "gestionar", 403],
    ["prod1", L2, "ver", 403], ["cert1", L1, "ver", 200], ["cert1", L1, "gestionar", 403],
    ["cert1", L2, "ver", 403], ["prodSin", L1, "ver", 403]
  ];
  for (const [u, lote, modo, esperado] of casos) {
    const mw = modo === "ver" ? verL() : gesL();
    const { code } = await ejecutar(mw, U[u], { params: { id: String(lote._id) } });
    assert.equal(code, esperado, `${u} ${modo} lote -> ${code}`);
  }
  assert.equal((await ejecutar(verL(), U.admin, { params: { id: "abc" } })).code, 400);
  assert.equal((await ejecutar(verL(), U.admin, { params: { id: String(oid()) } })).code, 404);
  assert.equal((await ejecutar(alcance.accesoLote((r) => r.body && r.body.lote), U.admin, {})).code, 400);
});

test("acceso a eventos: el productor solo edita los suyos", async () => {
  const g = alcance.accesoEvento("gestionar");
  assert.equal((await ejecutar(g, U.prod1, { params: { id: String(E1._id) } })).code, 200);
  assert.equal((await ejecutar(g, U.prod1, { params: { id: String(E2._id) } })).code, 403);
  assert.equal((await ejecutar(g, U.admin, { params: { id: String(E2._id) } })).code, 200);
  assert.equal((await ejecutar(alcance.accesoEvento("ver"), U.cert1, { params: { id: String(E1._id) } })).code, 200);
  assert.equal((await ejecutar(g, U.cert1, { params: { id: String(E1._id) } })).code, 403);
});

test("acceso a certificaciones", async () => {
  const c = alcance.accesoCertificacion();
  assert.equal((await ejecutar(c, U.cert1, { params: { id: String(C1._id) } })).code, 200);
  assert.equal((await ejecutar(c, U.cert2, { params: { id: String(C1._id) } })).code, 403);
  assert.equal((await ejecutar(c, U.prod1, { params: { id: String(C1._id) } })).code, 200);
  assert.equal((await ejecutar(c, U.prod1, { params: { id: String(C2._id) } })).code, 403);
  assert.equal((await ejecutar(c, U.admin, { params: { id: String(C2._id) } })).code, 200);
  assert.equal((await ejecutar(c, U.admin, { params: { id: String(oid()) } })).code, 404);
});

test("solo el administrador gestiona productores", async () => {
  const p = alcance.accesoProductor();
  assert.equal((await ejecutar(p, U.admin, { params: { id: String(P3._id) } })).code, 200);
  assert.equal((await ejecutar(p, U.prod1, { params: { id: String(P1._id) } })).code, 403);
  assert.equal((await ejecutar(p, U.cert1, { params: { id: String(P1._id) } })).code, 403);
  const s = await ejecutar(alcance.soloAdminPuedeCambiar("usuario"), U.prod1, { body: { usuario: "x", nombre: "n" } });
  assert.deepEqual(s.body, { nombre: "n" });
});

test("los listados de los controladores aplican el filtro", async () => {
  const { obtenerLotes } = req_("controllers/loteController");
  const { obtenerCertificaciones } = req_("controllers/certificacionController");
  const respuesta = () => {
    const r = { status(c) { r.code = c; return r; }, json(d) { r.datos = d; return r; } };
    return r;
  };
  let r = respuesta();
  await obtenerLotes({ usuario: U.prod1 }, r);
  assert.equal(r.code, 200);
  assert.deepEqual(ids(r.datos), ids([L1]));
  r = respuesta();
  await obtenerCertificaciones({ usuario: U.cert2 }, r);
  assert.equal(r.datos.total, 0);
  r = respuesta();
  await obtenerCertificaciones({ usuario: U.cert1 }, r);
  assert.deepEqual(ids(r.datos.certificaciones), ids([C1]));
});

test("rutas de usuarios y registro exigen administrador", async () => {
  const jwt = req_("node_modules/jsonwebtoken");
  const Usuario = req_("models/Usuario");
  process.env.JWT_SECRET = "prueba";
  const cuentas = [{ ...U.admin, activo: true }, { ...U.prod1, activo: true }];
  Usuario.findById = (id) => consulta(cuentas.find((c) => igual(c._id, id)) || null);
  Usuario.find = () => consulta([]);

  const app = express();
  app.use(express.json());
  app.use("/api/usuarios", req_("routes/usuarioRoutes"));
  app.use("/api/auth", req_("routes/authRoutes"));
  const servidor = app.listen(0);
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const token = (u) => jwt.sign({ id: u._id, rol: u.rol }, "prueba");
  const pedir = (ruta, metodo = "GET", u) => fetch(base + ruta, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...(u ? { Authorization: `Bearer ${token(u)}` } : {}) },
    body: metodo === "GET" ? undefined : JSON.stringify({ nombre: "x" })
  }).then((x) => x.status);

  try {
    assert.equal(await pedir("/api/usuarios/certificadores"), 401);
    assert.equal(await pedir("/api/usuarios/certificadores", "GET", U.prod1), 403);
    assert.equal(await pedir("/api/usuarios/certificadores", "GET", U.admin), 200);
    assert.equal(await pedir("/api/auth/registro", "POST"), 401);
    assert.equal(await pedir("/api/auth/registro", "POST", U.prod1), 403);
    assert.equal(await pedir("/api/auth/registro", "POST", U.admin), 400); // faltan campos
    assert.equal(await pedir("/api/usuarios", "POST", U.admin), 400);
  } finally {
    servidor.close();
  }
});
