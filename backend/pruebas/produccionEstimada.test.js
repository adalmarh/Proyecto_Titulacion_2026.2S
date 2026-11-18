// ==========================================================
// PRUEBAS DE LA PRODUCCIÓN ESTIMADA DEL PRODUCTOR
// (cantidad aproximada y fechas de siembra y cosecha)
//
// Ejecutar, desde la carpeta backend:
//   npm test
// ==========================================================

const test = require("node:test");
const assert = require("node:assert/strict");

const { validarProduccion } = require("../utils/produccionEstimada");
const Productor = require("../models/Productor");
const { actualizarProductor } = require("../controllers/productorController");

const HOY = new Date("2026-11-16T12:00:00Z");
const valida = { cantidadEstimada: "1200", unidadEstimada: "kg", estadoGrano: "baba", fechaSiembra: "2018-05-01", fechaEstimadaCosecha: "2027-01-20" };

const respuesta = () => {
  const res = { estado: 200 };
  res.status = (c) => { res.estado = c; return res; };
  res.json = (d) => { res.datos = d; return res; };
  return res;
};


test("datos válidos: cantidad en kg y fechas", () => {
  const r = validarProduccion(valida, { obligatorio: true, hoy: HOY });
  assert.equal(r.cantidadEstimadaKg, 1200);
  assert.equal(r.estadoGrano, "baba");
  assert.equal(r.fechaSiembra.toISOString().slice(0, 10), "2018-05-01");
  assert.equal(r.fechaEstimadaCosecha.toISOString().slice(0, 10), "2027-01-20");
  assert.equal(validarProduccion({ ...valida, cantidadEstimada: "2,5", unidadEstimada: "quintales" }, { hoy: HOY }).cantidadEstimadaKg, 113.4);
});

test("en la ficha del productor los datos son opcionales", () => {
  assert.deepEqual(validarProduccion({}, { hoy: HOY }), { cantidadEstimadaKg: null, estadoGrano: null, fechaSiembra: null, fechaEstimadaCosecha: null });
  assert.throws(() => validarProduccion({}, { obligatorio: true, hoy: HOY }), /cantidad aproximada/);
  assert.throws(() => validarProduccion({ ...valida, estadoGrano: "" }, { obligatorio: true, hoy: HOY }), /seco o en baba/);
});

test("rechaza fechas y cantidades fuera de lugar", () => {
  const malo = (cambio, texto) => assert.throws(() => validarProduccion({ ...valida, ...cambio }, { hoy: HOY }), texto);
  malo({ fechaSiembra: "2027-02-01" }, /posterior a hoy/);
  malo({ fechaSiembra: "1900-01-01" }, /desde 1950/);
  malo({ fechaSiembra: "no-es-fecha" }, /no es válida/);
  malo({ fechaEstimadaCosecha: "2017-01-01" }, /posterior a la siembra/);
  malo({ fechaEstimadaCosecha: "2029-06-01" }, /próximos 2 años/);
  malo({ cantidadEstimada: "-3" }, /mayor que cero/);
  malo({ cantidadEstimada: "500000" }, /demasiado alta/);
  malo({ unidadEstimada: "libras" }, /kg o quintales/);
  malo({ estadoGrano: "tostado" }, /seco.*baba/);
});

test("al editar la ficha, la producción se valida y se guarda en kg", async () => {
  let guardado;
  Productor.findByIdAndUpdate = async (_id, datos) => { guardado = datos; return { _id, ...datos }; };

  const ok = respuesta();
  await actualizarProductor({ params: { id: "p1" }, body: { produccion: { ...valida, cantidadEstimada: "10", unidadEstimada: "quintales" } } }, ok);
  assert.equal(ok.estado, 200, ok.datos?.mensaje);
  assert.equal(guardado.produccion.cantidadEstimadaKg, 453.59);

  const malo = respuesta();
  await actualizarProductor({ params: { id: "p1" }, body: { produccion: { ...valida, fechaSiembra: "2030-01-01" } } }, malo);
  assert.equal(malo.estado, 400);
});
