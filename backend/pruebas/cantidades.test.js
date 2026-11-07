// ==========================================================
// PRUEBAS DE LA CANTIDAD DEL LOTE (kg, quintales y grano)
// (base de datos SIMULADA)
//
// Ejecutar, desde la carpeta backend:
//   npm test
// ==========================================================

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  KG_POR_QUINTAL,
  aKilogramos,
  aQuintales,
  estadoGranoValido
} = require("../utils/cantidades");

const Lote = require("../models/Lote");
const Productor = require("../models/Productor");
const { crearLote, actualizarLote } = require("../controllers/loteController");

const respuesta = () => {
  const res = { estado: 200 };
  res.status = (c) => { res.estado = c; return res; };
  res.json = (d) => { res.datos = d; return res; };
  return res;
};


test("convierte quintales a kg y redondea a 2 decimales", () => {
  assert.equal(KG_POR_QUINTAL, 45.3592);
  assert.equal(aKilogramos(1200, "kg"), 1200);
  assert.equal(aKilogramos(10, "quintales"), 453.59);
  assert.equal(aKilogramos("2,5".replace(",", "."), "qq"), 113.4);
  assert.equal(aKilogramos(1.5, "toneladas"), 1500, "lotes antiguos en toneladas");
  assert.equal(aKilogramos(500, undefined), 500, "sin unidad = kg");
});

test("rechaza cantidades vacías, cero, negativas o unidades raras", () => {
  for (const valor of [0, -5, "", null, "abc"]) {
    assert.throws(() => aKilogramos(valor, "kg"), /mayor que cero/);
  }
  assert.throws(() => aKilogramos(10, "libras"), /kg o quintales/);
});

test("quintales equivalentes para mostrar", () => {
  assert.equal(aQuintales(1200), 26.5);
  assert.equal(aQuintales(45.3592), 1);
});

test("estado del grano: seco por defecto, seco o baba", () => {
  assert.equal(estadoGranoValido(undefined), "seco");
  assert.equal(estadoGranoValido("Baba"), "baba");
  assert.throws(() => estadoGranoValido("tostado"), /seco.*baba/);
});

test("al registrar un lote en quintales se guarda en kg", async () => {
  let creado;
  Productor.findById = async () => ({ _id: "p1", activo: true });
  Lote.create = async (datos) => { creado = { _id: "l1", ...datos }; return creado; };
  Lote.findById = () => {
    const q = { populate: () => q, then: (ok) => ok(creado) };
    return q;
  };

  const res = respuesta();
  await crearLote({ usuario: { rol: "administrador" }, body: { productor: "p1", cantidad: 20, unidad: "quintales", estadoGrano: "baba" } }, res);

  assert.equal(res.estado, 201, res.datos?.mensaje);
  assert.equal(creado.cantidad, 907.18);
  assert.equal(creado.unidad, "kg");
  assert.equal(creado.estadoGrano, "baba");

  const malo = respuesta();
  await crearLote({ usuario: { rol: "administrador" }, body: { productor: "p1", cantidad: 0 } }, malo);
  assert.equal(malo.estado, 400);
});

test("al editar, la cantidad también queda en kg", async () => {
  let cambios;
  Lote.findByIdAndUpdate = (_id, datos) => {
    cambios = datos;
    const q = { populate: () => q, then: (ok) => ok({ _id: "l1", ...datos }) };
    return q;
  };

  const res = respuesta();
  await actualizarLote({ params: { id: "l1" }, usuario: { rol: "administrador" }, body: { cantidad: 3, unidad: "quintales" } }, res);
  assert.equal(res.estado, 200, res.datos?.mensaje);
  assert.equal(cambios.cantidad, 136.08);
  assert.equal(cambios.unidad, "kg");

  const malo = respuesta();
  await actualizarLote({ params: { id: "l1" }, usuario: { rol: "administrador" }, body: { estadoGrano: "tostado" } }, malo);
  assert.equal(malo.estado, 400);
});
